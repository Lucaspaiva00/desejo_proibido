import { prisma } from "../prisma.js";
import { logAcesso } from "../utils/auditoria.js";
import { calcIdade } from "../utils/calcIdade.js";
import { gerarRoomId } from "../utils/room.js";

/**
 * Regras seguras:
 * - Listagem: só usuárias ativas, com perfil, genero F, filtra bloqueios + skips (dos 2 lados)
 * - Chamada: 1 sessão ativa/pendente por par; checa minutos; cria roomId; status TOCANDO
 * - Aceitar/Recusar: só o alvo pode; status válido
 * - Finalizar: qualquer participante pode; calcula duração no servidor; cobra minutos do caller (usuarioId)
 */

const STATUS_VALIDOS_ATIVOS = ["PENDENTE", "TOCANDO", "ATIVA"];
const TIPO_VIDEO = "VIDEO";

// GET /ligacoes/video/mulheres
export async function listarMulheres(req, res) {
  const meId = req.usuario.id;

  try {
    const pref = await prisma.preferenciaBusca.findUnique({
      where: { usuarioId: meId },
    });

    const idadeMin = pref?.idadeMin ?? 18;
    const idadeMax = pref?.idadeMax ?? 99;

    // 1) ids bloqueados (nos 2 sentidos)
    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        OR: [{ deUsuarioId: meId }, { paraUsuarioId: meId }],
      },
      select: { deUsuarioId: true, paraUsuarioId: true },
    });

    const bloqueadosIds = new Set();
    for (const b of bloqueios) {
      if (b.deUsuarioId !== meId) bloqueadosIds.add(b.deUsuarioId);
      if (b.paraUsuarioId !== meId) bloqueadosIds.add(b.paraUsuarioId);
    }

    // 2) ids skipados (nos 2 sentidos)
    const skips = await prisma.skip.findMany({
      where: {
        OR: [{ deUsuarioId: meId }, { paraUsuarioId: meId }],
      },
      select: { deUsuarioId: true, paraUsuarioId: true },
    });

    const skipadosIds = new Set();
    for (const s of skips) {
      if (s.deUsuarioId !== meId) skipadosIds.add(s.deUsuarioId);
      if (s.paraUsuarioId !== meId) skipadosIds.add(s.paraUsuarioId);
    }

    const excluirIds = [...new Set([...bloqueadosIds, ...skipadosIds, meId])];

    const mulheres = await prisma.usuario.findMany({
      where: {
        id: { notIn: excluirIds },
        ativo: true,
        // invisíveis não aparecem
        isInvisivel: false,
        modoInvisivel: false,

        perfil: {
          is: {
            genero: "F",
            ...(pref?.cidade ? { cidade: pref.cidade } : {}),
            ...(pref?.estado ? { estado: pref.estado } : {}),
            ...(pref?.somenteVerificados ? { verificado: true } : {}),
          },
        },

        ...(pref?.somenteComFoto ? { fotos: { some: { principal: true } } } : {}),
      },
      select: {
        id: true,
        boostAte: true,
        perfil: {
          select: {
            nome: true,
            cidade: true,
            estado: true,
            nascimento: true,
            verificado: true,
          },
        },
        fotos: {
          where: { principal: true },
          take: 1,
          select: { url: true },
        },
      },
      orderBy: [{ boostAte: "desc" }, { atualizadoEm: "desc" }],
      take: 60,
    });

    const items = mulheres
      .map((u) => {
        const idade = calcIdade(u.perfil?.nascimento);
        return {
          id: u.id,
          nome: u.perfil?.nome ?? "Sem nome",
          idade,
          cidade: u.perfil?.cidade ?? null,
          estado: u.perfil?.estado ?? null,
          verificada: !!u.perfil?.verificado,
          foto: u.fotos?.[0]?.url ?? null,
          boost: u.boostAte ? new Date(u.boostAte) > new Date() : false,
        };
      })
      .filter((u) => (u.idade == null ? true : u.idade >= idadeMin && u.idade <= idadeMax));

    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_LISTAR_MULHERES", status: 200 });

    return res.json({ items });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_LISTAR_MULHERES_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao listar mulheres" });
  }
}

// POST /ligacoes/video/iniciar  body: { alvoId }
export async function iniciarChamada(req, res) {
  const meId = req.usuario.id;
  const { alvoId } = req.body;

  try {
    if (!alvoId) return res.status(400).json({ erro: "alvoId é obrigatório" });
    if (alvoId === meId) return res.status(400).json({ erro: "Você não pode chamar a si mesmo" });

    const [me, alvo] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: meId }, select: { id: true, minutosDisponiveis: true, ativo: true } }),
      prisma.usuario.findUnique({ where: { id: alvoId }, select: { id: true, ativo: true, isInvisivel: true, modoInvisivel: true } }),
    ]);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário desativado" });
    if (!alvo?.ativo) return res.status(404).json({ erro: "Alvo não encontrado/inativo" });

    // (segurança) se a usuária estiver invisível, não inicia
    if (alvo.isInvisivel || alvo.modoInvisivel) {
      return res.status(404).json({ erro: "Usuário indisponível" });
    }

    if ((me.minutosDisponiveis ?? 0) <= 0) {
      await logAcesso(req, { usuarioId: meId, evento: "VIDEO_SEM_MINUTOS", status: 402 });
      return res.status(402).json({ erro: "Sem minutos disponíveis" });
    }

    // trava duplicação
    const existente = await prisma.sessaoLigacao.findFirst({
      where: {
        tipo: TIPO_VIDEO,
        OR: [
          { usuarioId: meId, alvoId },
          { usuarioId: alvoId, alvoId: meId },
        ],
        status: { in: STATUS_VALIDOS_ATIVOS },
      },
      select: { id: true, status: true },
    });

    if (existente) {
      return res.status(409).json({ erro: "Já existe uma chamada em andamento", sessaoId: existente.id, status: existente.status });
    }

    const roomId = gerarRoomId();

    const sessao = await prisma.sessaoLigacao.create({
      data: {
        usuarioId: meId,
        alvoId,
        tipo: TIPO_VIDEO,
        roomId,
        status: "TOCANDO",
      },
      select: { id: true, roomId: true, status: true, iniciadoEm: true },
    });

    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_INICIAR", status: 200, detalhe: `sessao=${sessao.id}` });

    return res.json({ sessaoId: sessao.id, roomId: sessao.roomId, status: sessao.status });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_INICIAR_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao iniciar chamada" });
  }
}

// GET /ligacoes/video/pendentes (para o lado "mulher" ver convites)
export async function chamadasPendentes(req, res) {
  const meId = req.usuario.id;

  try {
    const pendentes = await prisma.sessaoLigacao.findMany({
      where: {
        alvoId: meId,
        tipo: TIPO_VIDEO,
        status: "TOCANDO",
      },
      orderBy: { iniciadoEm: "desc" },
      take: 20,
      select: {
        id: true,
        roomId: true,
        status: true,
        iniciadoEm: true,
        usuario: { select: { id: true, perfil: { select: { nome: true } } } },
      },
    });

    return res.json({
      items: pendentes.map((s) => ({
        sessaoId: s.id,
        roomId: s.roomId,
        status: s.status,
        iniciadoEm: s.iniciadoEm,
        de: { id: s.usuario.id, nome: s.usuario.perfil?.nome ?? "Sem nome" },
      })),
    });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_PENDENTES_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao buscar pendentes" });
  }
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
      select: { id: true, status: true, roomId: true, aceitouEm: true },
    });

    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_ACEITAR", status: 200, detalhe: `sessao=${id}` });

    return res.json({ ok: true, sessaoId: updated.id, status: updated.status, roomId: updated.roomId });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_ACEITAR_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao aceitar chamada" });
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
    if (!["TOCANDO", "PENDENTE"].includes(sessao.status)) return res.status(400).json({ erro: "Status inválido" });

    const updated = await prisma.sessaoLigacao.update({
      where: { id },
      data: { status: "RECUSADA", finalizadoEm: new Date() },
      select: { id: true, status: true },
    });

    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_RECUSAR", status: 200, detalhe: `sessao=${id}` });

    return res.json({ ok: true, status: updated.status });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_RECUSAR_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao recusar chamada" });
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
    if (sessao.status === "FINALIZADA" || sessao.status === "RECUSADA") {
      return res.json({ ok: true, status: sessao.status, minutosCobrados: sessao.minutosCobrados, segundosConsumidos: sessao.segundosConsumidos });
    }

    const agora = new Date();
    const inicio = sessao.aceitouEm ?? sessao.iniciadoEm;

    // calcula no servidor (mais seguro)
    const segundos = Math.max(0, Math.floor((agora.getTime() - new Date(inicio).getTime()) / 1000));
    const minutos = Math.max(0, Math.ceil(segundos / 60));

    const updated = await prisma.$transaction(async (tx) => {
      // cobra do caller (usuarioId)
      const caller = await tx.usuario.findUnique({
        where: { id: sessao.usuarioId },
        select: { minutosDisponiveis: true },
      });

      const disponiveis = caller?.minutosDisponiveis ?? 0;
      const minutosCobrados = Math.min(disponiveis, minutos);

      if (minutosCobrados > 0) {
        await tx.usuario.update({
          where: { id: sessao.usuarioId },
          data: { minutosDisponiveis: { decrement: minutosCobrados } },
        });

        // (opcional) registra extrato
        await tx.creditoMinuto.create({
          data: {
            usuarioId: sessao.usuarioId,
            tipo: "DEBITO",
            minutos: minutosCobrados,
            refTipo: "VIDEO",
            refId: sessao.id,
            detalhes: `Chamada vídeo - ${segundos}s`,
          },
        });
      }

      return tx.sessaoLigacao.update({
        where: { id: sessao.id },
        data: {
          status: "FINALIZADA",
          finalizadoEm: agora,
          segundosConsumidos: segundos,
          minutosCobrados,
        },
        select: {
          id: true,
          status: true,
          segundosConsumidos: true,
          minutosCobrados: true,
        },
      });
    });

    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_FINALIZAR", status: 200, detalhe: `sessao=${id} mins=${updated.minutosCobrados}` });

    return res.json({
      ok: true,
      status: updated.status,
      segundosConsumidos: updated.segundosConsumidos,
      minutosCobrados: updated.minutosCobrados,
    });
  } catch (e) {
    await logAcesso(req, { usuarioId: meId, evento: "VIDEO_FINALIZAR_ERRO", status: 500, detalhe: e.message });
    return res.status(500).json({ erro: "Erro ao finalizar chamada" });
  }
}
