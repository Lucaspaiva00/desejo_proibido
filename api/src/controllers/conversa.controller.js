import { prisma } from "../prisma.js";

const CHAT_CUSTO_CREDITOS = Number(process.env.CHAT_CUSTO_CREDITOS || 10);

async function getSaldoCreditos(userId) {
    const w = await prisma.wallet.findUnique({ where: { userId } });
    return w?.saldoCreditos ?? 0;
}

async function isChatLiberadoParaUsuario(conversaId, userId) {
    const tx = await prisma.walletTx.findFirst({
        where: { userId, origem: "CHAT_UNLOCK", refId: conversaId },
        select: { id: true },
    });
    return !!tx;
}

export async function statusConversa(req, res) {
    const userId = req.usuario.id;
    const { id: conversaId } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

    const isParte =
        conv.match.usuarioAId === userId ||
        conv.match.usuarioBId === userId;

    if (!isParte) return res.status(403).json({ erro: "Sem acesso" });

    const chatLiberado = await isChatLiberadoParaUsuario(conversaId, userId);
    const saldoCreditos = await getSaldoCreditos(userId);

    return res.json({
        chatLiberado,
        custoCreditos: CHAT_CUSTO_CREDITOS,
        saldoCreditos,
    });
}

export async function liberarChat(req, res) {
    const userId = req.usuario.id;
    const { id: conversaId } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

    const isParte =
        conv.match.usuarioAId === userId ||
        conv.match.usuarioBId === userId;

    if (!isParte) return res.status(403).json({ erro: "Sem acesso" });

    const jaLiberado = await isChatLiberadoParaUsuario(conversaId, userId);
    const saldo = await getSaldoCreditos(userId);

    // ✅ JÁ LIBERADO
    if (jaLiberado) {
        return res.json({
            chatLiberado: true,
            custoCreditos: CHAT_CUSTO_CREDITOS,
            saldoCreditos: saldo,
        });
    }

    // ✅ CUSTO ZERO → LIBERA SEM DEBITAR
    if (CHAT_CUSTO_CREDITOS === 0) {
        await prisma.walletTx.create({
            data: {
                userId,
                tipo: "DEBITO",
                origem: "CHAT_UNLOCK",
                valor: 0,
                refId: conversaId,
            },
        });

        return res.json({
            chatLiberado: true,
            custoCreditos: 0,
            saldoCreditos: saldo,
        });
    }

    // ❌ SALDO INSUFICIENTE
    if (saldo < CHAT_CUSTO_CREDITOS) {
        return res.status(402).json({
            chatLiberado: false,
            erro: "Saldo insuficiente",
            custoCreditos: CHAT_CUSTO_CREDITOS,
            saldoCreditos: saldo,
        });
    }

    // ✅ DEBITA E LIBERA
    await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
            where: { userId },
            data: { saldoCreditos: { decrement: CHAT_CUSTO_CREDITOS } },
        });

        await tx.walletTx.create({
            data: {
                userId,
                tipo: "DEBITO",
                origem: "CHAT_UNLOCK",
                valor: CHAT_CUSTO_CREDITOS,
                refId: conversaId,
            },
        });

        await tx.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "SISTEMA",
                texto: "🔓 Chat liberado com créditos.",
            },
        });
    });

    const novoSaldo = await getSaldoCreditos(userId);

    return res.json({
        chatLiberado: true,
        custoCreditos: CHAT_CUSTO_CREDITOS,
        saldoCreditos: novoSaldo,
    });
}
