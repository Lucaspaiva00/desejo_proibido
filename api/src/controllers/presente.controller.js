// src/controllers/presente.controller.js
import { prisma } from "../prisma.js";
import { ensureWallet, debitWallet } from "../utils/wallet.js";

export async function listarPresentes(req, res) {
  try {
    const itens = await prisma.presente.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "desc" },
    });
    return res.json(itens);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar presentes", detalhe: e.message });
  }
}

export async function enviarPresente(req, res) {
  try {
    const userId = req.usuario.id;
    const { conversaId, presenteId } = req.body;

    if (!conversaId || !presenteId) {
      return res.status(400).json({ erro: "conversaId e presenteId são obrigatórios" });
    }

    const presente = await prisma.presente.findUnique({ where: { id: presenteId } });
    if (!presente || !presente.ativo) {
      return res.status(404).json({ erro: "Presente inválido" });
    }

    // ✅ valida conversa + match + participação ANTES de debitar
    const conversa = await prisma.conversa.findUnique({
      where: { id: conversaId },
      select: {
        match: { select: { usuarioAId: true, usuarioBId: true } },
      },
    });
    if (!conversa?.match) return res.status(404).json({ erro: "Conversa inválida" });

    const isParte =
      conversa.match.usuarioAId === userId || conversa.match.usuarioBId === userId;
    if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

    const paraUsuarioId =
      conversa.match.usuarioAId === userId ? conversa.match.usuarioBId : conversa.match.usuarioAId;

    await ensureWallet(userId);

    // debita créditos (se custoCreditos > 0)
    const custo = Number(presente.custoCreditos || 0);

    let saldoDepois = null;
    if (custo > 0) {
      const r = await debitWallet(userId, custo, { origem: "PRESENTE", refId: presenteId });
      // seu wallet.js retorna { ok, saldoAntes, saldoDepois }
      saldoDepois = r?.saldoDepois ?? null;
    }

    const enviado = await prisma.presenteEnviado.create({
      data: {
        presenteId,
        conversaId,
        deUsuarioId: userId,
        paraUsuarioId,
        minutos: presente.minutos || 0,
        custoCreditos: custo,
      },
    });

    // cria mensagem do tipo PRESENTE
    await prisma.mensagem.create({
      data: {
        conversaId,
        autorId: userId,
        tipo: "PRESENTE",
        texto: null,
        metaJson: {
          presenteId,
          nome: presente.nome,
          imagemUrl: presente.imagemUrl || null,
          custoCreditos: custo,
          minutos: presente.minutos || 0,
        },
      },
    });

    // opcional mas recomendado: atualiza o "atualizadoEm" da conversa
    await prisma.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    });

    // ✅ devolve saldo pro front (se teve débito)
    return res.json({
      ok: true,
      enviado,
      saldoCreditos: saldoDepois, // pode vir null se custo=0
    });
  } catch (e) {
    // ✅ saldo insuficiente não é 500
    if (e?.code === "SALDO_INSUFICIENTE") {
      return res.status(402).json({
        code: "SALDO_INSUFICIENTE",
        erro: "Saldo insuficiente para enviar este presente",
        saldoCreditos: e?.saldoCreditos ?? 0,
      });
    }

    console.error("❌ enviarPresente:", e);
    return res.status(500).json({ erro: "Erro ao enviar presente", detalhe: e.message });
  }
}
