// src/utils/creditos.js
import { prisma } from "../prisma.js";

export async function ensureWallet(userId) {
    return prisma.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, saldoCreditos: 0 },
    });
}

export async function getSaldoCreditos(userId) {
    await ensureWallet(userId);
    const w = await prisma.wallet.findUnique({ where: { userId } });
    return w?.saldoCreditos ?? 0;
}

export async function debitarCreditosTx({
    userId,
    valor,
    origem,
    refId = null,
    prismaTx = null,
}) {
    const tx = prismaTx || prisma;

    if (!userId) throw new Error("userId obrigatório");
    const v = Number(valor || 0);
    if (!Number.isInteger(v) || v <= 0) throw new Error("valor inválido");

    await ensureWallet(userId);

    const saldo = await tx.wallet.findUnique({
        where: { userId },
        select: { saldoCreditos: true },
    });

    const atual = saldo?.saldoCreditos ?? 0;

    if (atual < v) {
        const err = new Error("Saldo insuficiente");
        err.statusCode = 402;
        err.code = "SALDO_INSUFICIENTE";
        err.saldoCreditos = atual;
        err.custo = v;
        throw err;
    }

    await tx.wallet.update({
        where: { userId },
        data: { saldoCreditos: { decrement: v } },
    });

    await tx.walletTx.create({
        data: {
            userId,
            tipo: "DEBIT",
            origem,
            valor: v,
            refId,
        },
    });

    const novo = await tx.wallet.findUnique({
        where: { userId },
        select: { saldoCreditos: true },
    });

    return { saldoCreditos: novo?.saldoCreditos ?? 0 };
}
