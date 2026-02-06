// presente.controller.js
import { prisma } from "../prisma.js";
import { creditarMinutos } from "../utils/minutos.js";

export async function enviarPresente(req, res) {
  try {
    const deUsuarioId = req.usuario.id;
    const { conversaId, presenteId } = req.body;

    if (!conversaId || !presenteId) {
      return res.status(400).json({ erro: "conversaId e presenteId são obrigatórios" });
    }

    const conversa = await prisma.conversa.findUnique({
      where: { id: conversaId },
      include: { match: true },
    });
    if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada" });

    const a = conversa.match.usuarioAId;
    const b = conversa.match.usuarioBId;

    if (![a, b].includes(deUsuarioId)) {
      return res.status(403).json({ erro: "Você não pertence a esta conversa" });
    }

    const paraUsuarioId = deUsuarioId === a ? b : a;

    const presente = await prisma.presente.findUnique({ where: { id: presenteId } });
    if (!presente || !presente.ativo) {
      return res.status(404).json({ erro: "Presente inválido" });
    }

    const custo = Number(presente.custoCreditos || 0);

    // ✅ garante wallet do usuário (pra não dar erro no update)
    await prisma.wallet.upsert({
      where: { userId: deUsuarioId },
      update: {},
      create: { userId: deUsuarioId, saldoCreditos: 0 },
    });

    const envio = await prisma.$transaction(async (tx) => {
      // ✅ 1) valida saldo e debita
      if (custo > 0) {
        const w = await tx.wallet.findUnique({ where: { userId: deUsuarioId } });
        const saldo = w?.saldoCreditos ?? 0;

        if (saldo < custo) {
          const err = new Error("SALDO_INSUFICIENTE");
          err.code = "SALDO_INSUFICIENTE";
          throw err;
        }

        await tx.wallet.update({
          where: { userId: deUsuarioId },
          data: { saldoCreditos: { decrement: custo } },
        });

        await tx.walletTx.create({
          data: {
            userId: deUsuarioId,
            tipo: "DEBIT",
            origem: "PRESENTE",
            valor: custo,
            refId: conversaId, // ou envio.id depois; aqui usamos conversaId
          },
        });
      }

      // ✅ 2) registra envio
      const enviado = await tx.presenteEnviado.create({
        data: {
          presenteId,
          conversaId,
          deUsuarioId,
          paraUsuarioId,
          minutos: presente.minutos,
          custoCreditos: custo, // se você adicionou o campo
        },
      });

      // ✅ 3) mensagem no chat
      await tx.mensagem.create({
        data: {
          conversaId,
          autorId: deUsuarioId,
          tipo: "PRESENTE",
          texto: `🎁 Enviou ${presente.nome}`,
          metaJson: {
            presenteId: presente.id,
            nome: presente.nome,
            minutos: presente.minutos,
            imagemUrl: presente.imagemUrl,
            paraUsuarioId,
            custoCreditos: custo,
          },
        },
      });

      return enviado;
    });

    // ✅ 4) credita minutos no outro (fora ou dentro da tx; você já fazia fora)
    if (presente.minutos > 0) {
      await creditarMinutos({
        usuarioId: paraUsuarioId,
        minutos: presente.minutos,
        tipo: "CREDITO_PRESENTE",
        refTipo: "PRESENTE",
        refId: envio.id,
        detalhes: `Presente ${presente.nome}`,
      });
    }

    // ✅ devolve saldo atualizado pro front (melhor UX)
    const w2 = await prisma.wallet.findUnique({ where: { userId: deUsuarioId } });

    return res.json({
      ok: true,
      saldoCreditos: w2?.saldoCreditos ?? 0,
    });
  } catch (e) {
    if (e?.code === "SALDO_INSUFICIENTE" || e?.message === "SALDO_INSUFICIENTE") {
      return res.status(402).json({
        code: "SALDO_INSUFICIENTE",
        erro: "Saldo insuficiente para enviar este presente.",
      });
    }
    return res.status(500).json({ erro: e.message });
  }
}
