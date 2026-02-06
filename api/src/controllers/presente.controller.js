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

    await ensureWallet(userId);

    // debita créditos (se custoCreditos > 0)
    const custo = presente.custoCreditos || 0;
    if (custo > 0) {
      await debitWallet(userId, custo, { origem: "PRESENTE", refId: presenteId });
    }

    // Descobre o outro participante pela conversa
    const conversa = await prisma.conversa.findUnique({
      where: { id: conversaId },
      select: {
        match: { select: { usuarioAId: true, usuarioBId: true } },
      },
    });
    if (!conversa?.match) return res.status(404).json({ erro: "Conversa inválida" });

    const paraUsuarioId =
      conversa.match.usuarioAId === userId ? conversa.match.usuarioBId : conversa.match.usuarioAId;

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

    // opcional: criar mensagem do tipo PRESENTE
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

    return res.json({ ok: true, enviado });
  } catch (e) {
    console.error("❌ enviarPresente:", e);
    return res.status(500).json({ erro: "Erro ao enviar presente", detalhe: e.message });
  }
}
