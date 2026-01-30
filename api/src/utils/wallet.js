// src/utils/wallet.js
import { prisma } from "../prisma.js";

export function getChatUnlockCost() {
    const v = Number(process.env.CHAT_UNLOCK_CREDITS || 10);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 10;
}

export async function ensureWallet(userId) {
    return prisma.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, saldoCreditos: 0 },
    });
}

export async function isChatUnlocked(conversaId) {
    const tx = await prisma.walletTx.findFirst({
        where: {
            origem: "CHAT_UNLOCK",
            tipo: "DEBIT",
            refId: conversaId,
        },
        select: { id: true },
    });
    return !!tx;
}

export async function debitCreditsOrThrow({ userId, amount, origem, refId }) {
    if (!Number.isInteger(amount) || amount <= 0) {
        const err = new Error("Valor inválido para débito");
        err.statusCode = 400;
        throw err;
    }

    return prisma.$transaction(async (tx) => {
        // garante wallet
        const wallet = await tx.wallet.upsert({
            where: { userId },
            update: {},
            create: { userId, saldoCreditos: 0 },
        });

        if (wallet.saldoCreditos < amount) {
            const err = new Error("Saldo insuficiente");
            err.statusCode = 402;
            throw err;
        }

        const updated = await tx.wallet.update({
            where: { userId },
            data: { saldoCreditos: { decrement: amount } },
        });

        await tx.walletTx.create({
            data: {
                userId,
                tipo: "DEBIT",
                origem,
                valor: amount,
                refId: refId || null,
            },
        });

        return updated;
    });
}
