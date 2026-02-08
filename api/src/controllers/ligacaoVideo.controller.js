// src/controllers/ligacaoVideo.controller.js
import { prisma } from "../prisma.js";
import { isChatUnlocked } from "../utils/wallet.js";
import { getSaldoCreditos } from "../utils/creditos.js";
import { gerarRoomId } from "../utils/room.js";

const CUSTO_POR_MINUTO = 10;
const TIPO_VIDEO = "VIDEO";

function ceilMinutos(segundos) {
  const s = Math.max(0, Number(segundos || 0));
  return Math.ceil(s / 60);
}

// POST /ligacoes/video/iniciar  body: { conversaId }
export async function iniciarChamadaPorConversa(req, res) {
  const meId = req.usuario.id;
  const { conversaId } = req.body || {};

  try {
    if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });

    const conversa = await prisma.conversa.findUnique({
      where: { id: conversaId },
      include: { match: true },
    });

    if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada" });

    const a = conversa.match.usuarioAId;
    const b = conversa.match.usuarioBId;

    if (![a, b].includes(meId)) {
      return res.status(403).json({ erro: "Você não pertence a esta conversa" });
    }

    // ✅ exige unlock do chat para ligar
    const unlocked = await isChatUnlocked(conversaId, meId);
    if (!unlocked) {
      return res.status(402).json({
        erro: "Chat bloqueado. Libere o chat com créditos para fazer ligação.",
        code: "CHAT_LOCKED",
      });
    }

    const alvoId = meId === a ? b : a;

    // checa saldo mínimo para iniciar (1 minuto)
    const saldo = await getSaldoCreditos(meId);
    if (saldo < CUSTO_POR_MINUTO) {
      return res.status(402).json({
        erro: "Saldo insuficiente para iniciar ligação.",
        code: "SALDO_INSUFICIENTE",
        saldoCreditos: saldo,
        custoMinimo: CUSTO_POR_MINUTO,
      });
    }

    // trava duplicação por par
    const existente = await prisma.sessaoLigacao.findFirst({
      where: {
        tipo: TIPO_VIDEO,
        OR: [
          { usuarioId: meId, alvoId },
          { usuarioId: alvoId, alvoId: meId },
        ],
        status: { in: ["TOCANDO", "ATIVA"] },
      },
      select: { id: true, status: true },
    });

    if (existente) {
      return res.status(409).json({
        erro: "Já existe uma chamada em andamento",
        sessaoId: existente.id,
        status: existente.status,
      });
    }

    const roomId = gerarRoomId();

    const sessao = await prisma.sessaoLigacao.create({
      data: {
        usuarioId: meId,     // caller
        alvoId,              // callee
        tipo: TIPO_VIDEO,
        roomId,
        status: "TOCANDO",
      },
      select: { id: true, roomId: true, status: true, iniciadoEm: true },
    });

    // mensagem de sistema opcional
    await prisma.mensagem.create({
      data: {
        conversaId,
        autorId: meId,
        tipo: "SISTEMA",
        texto: "📹 Iniciou uma ligação de vídeo",
        metaJson: { sessaoId: sessao.id },
      },
    });

    // 🔔 avisa o alvo via socket (se online)
    const io = req.app.get("io");
    if (io?._dp) {
      const callerPerfil = await prisma.perfil.findUnique({
        where: { usuarioId: meId },
        select: { nome: true },
      });

      io._dp.emitToUser(alvoId, "call:incoming", {
        sessaoId: sessao.id,
        roomId: sessao.roomId,
        conversaId,
        de: { id: meId, nome: callerPerfil?.nome ?? "Usuário" },
      });
    }

    return res.json({
      ok: true,
      sessaoId: sessao.id,
      roomId: sessao.roomId,
      status: sessao.status,
      alvoId,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao iniciar chamada", detalhe: e.message });
  }
}

// GET /ligacoes/video/:id/status
export async function statusChamada(req, res) {
  const meId = req.usuario.id;
  const { id } = req.params;

  const sessao = await prisma.sessaoLigacao.findUnique({
    where: { id },
    select: {
      id: true,
      usuarioId: true,
      alvoId: true,
      roomId: true,
      status: true,
      iniciadoEm: true,
      aceitouEm: true,
      finalizadoEm: true,
      minutosCobrados: true,
      segundosConsumidos: true,
    },
  });

  if (!sessao) return res.status(404).json({ erro: "Sessão não encontrada" });

  const participa = sessao.usuarioId === meId || sessao.alvoId === meId;
  if (!participa) return res.status(403).json({ erro: "Sem permissão" });

  return res.json(sessao);
}

// POST /ligacoes/video/:id/aceitar
export async function aceitarChamada(req, res) {
  const meId = req.usuario.id;
  const { id } = req.params;

  try {
    const sessao = await prisma.sessaoLigacao.findUnique({ where: { id } });
    if (!sessao) return res.status(404).json({ erro: "Sessão não encontrada" });

    if (sessao.alvoId !== meId) return res.status(403).json({ erro: "Sem permissão" });
    if (sessao.tipo !== TIPO_VIDEO) return res.status(400).json({ erro: "Tipo inválido" });
    if (sessao.status !== "TOCANDO") return res.status(400).json({ erro: "Status inválido" });

    const updated = await prisma.sessaoLigacao.update({
      where: { id },
      data: { status: "ATIVA", aceitouEm: new Date() },
      select: { id: true, status: true, roomId: true, aceitouEm: true, usuarioId: true, alvoId: true },
    });

    // inicia cobrança no servidor (a cada 60s)
    const io = req.app.get("io");
    if (io?._dp) {
      io._dp.startBillingTimer(updated.id);
      io._dp.emitToUser(updated.usuarioId, "call:accepted", {
        sessaoId: updated.id,
        roomId: updated.roomId,
      });
    }

    return res.json({
      ok: true,
      sessaoId: updated.id,
      status: updated.status,
      roomId: updated.roomId,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao aceitar chamada", detalhe: e.message });
  }
}

// POST /ligacoes/video/:id/recusar
export async function recusarChamada(req, res) {
  const meId = req.usuario.id;
  const { id } = req.params;

  try {
    const sessao = await prisma.sessaoLigacao.findUnique({ where: { id } });
    if (!sessao) return res.status(404).json({ erro: "Sessão não encontrada" });

    if (sessao.alvoId !== meId) return res.status(403).json({ erro: "Sem permissão" });
    if (sessao.tipo !== TIPO_VIDEO) return res.status(400).json({ erro: "Tipo inválido" });
    if (!["TOCANDO"].includes(sessao.status)) return res.status(400).json({ erro: "Status inválido" });

    await prisma.sessaoLigacao.update({
      where: { id },
      data: { status: "RECUSADA", finalizadoEm: new Date() },
    });

    const io = req.app.get("io");
    if (io?._dp) {
      io._dp.emitToUser(sessao.usuarioId, "call:declined", { sessaoId: id });
    }

    return res.json({ ok: true, status: "RECUSADA" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao recusar chamada", detalhe: e.message });
  }
}

// POST /ligacoes/video/:id/finalizar
export async function finalizarChamada(req, res) {
  const meId = req.usuario.id;
  const { id } = req.params;

  try {
    const sessao = await prisma.sessaoLigacao.findUnique({ where: { id } });
    if (!sessao) return res.status(404).json({ erro: "Sessão não encontrada" });

    const participa = sessao.usuarioId === meId || sessao.alvoId === meId;
    if (!participa) return res.status(403).json({ erro: "Sem permissão" });

    if (sessao.tipo !== TIPO_VIDEO) return res.status(400).json({ erro: "Tipo inválido" });

    // se já finalizada
    if (sessao.status === "FINALIZADA" || sessao.status === "RECUSADA") {
      return res.json({
        ok: true,
        status: sessao.status,
        minutosCobrados: sessao.minutosCobrados,
        segundosConsumidos: sessao.segundosConsumidos,
      });
    }

    // encerra via socket helper (cobra restante e emite evento)
    const io = req.app.get("io");
    if (io?._dp) {
      await io._dp.finalizeSession(sessao.id, "FINALIZADA");
    } else {
      // fallback sem socket: finaliza simples (sem cobrança restante ideal)
      const agora = new Date();
      const inicio = sessao.aceitouEm ?? sessao.iniciadoEm;
      const segundos = Math.max(0, Math.floor((agora.getTime() - new Date(inicio).getTime()) / 1000));
      const minutos = ceilMinutos(segundos);

      await prisma.sessaoLigacao.update({
        where: { id: sessao.id },
        data: {
          status: "FINALIZADA",
          finalizadoEm: agora,
          segundosConsumidos: segundos,
          minutosCobrados: minutos,
        },
      });
    }

    const saldo = await getSaldoCreditos(sessao.usuarioId);

    return res.json({
      ok: true,
      status: "FINALIZADA",
      saldoCreditosCaller: saldo,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao finalizar chamada", detalhe: e.message });
  }
}
