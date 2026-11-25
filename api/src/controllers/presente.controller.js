// src/controllers/presente.controller.js
import { prisma } from "../prisma.js";
import { ensureWallet } from "../utils/wallet.js";
import { splitCreatorCredits } from "../utils/creatorFinance.js";

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
    if (!Number.isInteger(custo) || custo < 0) return res.status(400).json({ erro: "Custo do presente inválido" });
    const split = splitCreatorCredits(custo);

    const { enviado, saldoDepois } = await prisma.$transaction(async (tx) => {
      if (custo > 0) {
        const debitado = await tx.wallet.updateMany({
          where: { userId, saldoCreditos: { gte: custo } },
          data: { saldoCreditos: { decrement: custo } },
        });
        if (debitado.count !== 1) {
          const error = new Error("Saldo insuficiente");
          error.code = "SALDO_INSUFICIENTE";
          throw error;
        }
        await tx.walletTx.create({ data: { userId, tipo: "DEBIT", origem: "PRESENTE", valor: custo, refId: presenteId } });
      }
      const enviado = await tx.presenteEnviado.create({
        data: { presenteId, conversaId, deUsuarioId: userId, paraUsuarioId, minutos: presente.minutos || 0, custoCreditos: custo },
      });
      if (custo > 0) {
        await tx.wallet.upsert({ where: { userId: paraUsuarioId }, update: {}, create: { userId: paraUsuarioId, saldoCreditos: 0 } });
        if (split.criadora > 0) {
          await tx.wallet.update({ where: { userId: paraUsuarioId }, data: { saldoCreditos: { increment: split.criadora } } });
          await tx.walletTx.create({ data: { userId: paraUsuarioId, tipo: "CREDIT", origem: "CHAT_PRESENTE_RECEBIDO", valor: split.criadora, refId: enviado.id } });
        }
        if (split.plataforma > 0) {
          await tx.platformRevenue.create({ data: { origem: "CHAT_PRESENTE_RECEBIDO", refId: enviado.id, payerId: userId, creatorId: paraUsuarioId, valorCreditos: split.plataforma, percentual: split.percentual, detalhes: `Presente ${presente.nome}, bruto ${custo}` } });
        }
        await tx.giftCredito.create({ data: { remetenteId: userId, destinatarioId: paraUsuarioId, valor: custo, refTipo: "CHAT", refId: enviado.id } });
      }
      await tx.mensagem.create({
        data: {
          conversaId, autorId: userId, tipo: "PRESENTE", texto: null,
          metaJson: { presenteId, nome: presente.nome, imagemUrl: presente.imagemUrl || null, custoCreditos: custo, minutos: presente.minutos || 0, valorRecebidoCreditos: split.criadora },
        },
      });
      await tx.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } });
      const wallet = await tx.wallet.findUnique({ where: { userId }, select: { saldoCreditos: true } });
      return { enviado, saldoDepois: wallet?.saldoCreditos ?? 0 };
    });

    // ✅ devolve saldo pro front (se teve débito)
    return res.json({
      ok: true,
      enviado,
      valorRecebidoCreditos: split.criadora,
      taxaPlataformaCreditos: split.plataforma,
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
