// src/utils/wallet.js
import { prisma } from "../prisma.js";

/**
 * Garante que existe wallet para o usuário
 */
export async function ensureWallet(userId) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, saldoCreditos: 0 },
  });
}

/**
 * Retorna saldo de créditos
 */
export async function getSaldoCreditos(userId) {
  await ensureWallet(userId);
  const w = await prisma.wallet.findUnique({ where: { userId } });
  return w?.saldoCreditos ?? 0;
}

/**
 * Chat liberado POR USUÁRIO (correto)
 */
export async function isChatUnlocked(conversaId, userId) {
  const tx = await prisma.walletTx.findFirst({
    where: {
      userId,
      origem: "CHAT_UNLOCK",
      tipo: "DEBIT",
      refId: conversaId,
    },
    select: { id: true },
  });
  return !!tx;
}

/**
 * Premium efetivo (Opção B):
 * - Assinante PREMIUM => true
 * - OU tem créditos na wallet => true
 */
export async function isPremiumEfetivo(userId) {
  const [u, w] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { plano: true },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: { saldoCreditos: true },
    }),
  ]);

  const saldo = w?.saldoCreditos ?? 0;
  return u?.plano === "PREMIUM" || saldo > 0;
}

/**
 * Retorna pacote de status pro front
 */
export async function getPremiumStatus(userId) {
  const [u, w] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plano: true, role: true, ativo: true, criadoEm: true },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: { saldoCreditos: true },
    }),
  ]);

  const saldoCreditos = w?.saldoCreditos ?? 0;
  const premiumEfetivo = (u?.plano === "PREMIUM") || saldoCreditos > 0;

  return {
    usuario: u,
    saldoCreditos,
    premiumEfetivo,
  };
}

/**
 * Debita créditos da wallet + registra transação
 */
export async function debitWallet(userId, amount, meta = {}) {
  const valor = Number(amount || 0);
  if (!userId) throw new Error("debitWallet: userId inválido");
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("debitWallet: amount inválido");

  await ensureWallet(userId);

  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.findUnique({
      where: { userId },
      select: { saldoCreditos: true },
    });

    const saldoAtual = w?.saldoCreditos ?? 0;
    if (saldoAtual < valor) {
      const err = new Error("Saldo insuficiente");
      err.code = "SALDO_INSUFICIENTE";
      throw err;
    }

    const saldoDepois = saldoAtual - valor;

    await tx.wallet.update({
      where: { userId },
      data: { saldoCreditos: saldoDepois },
    });

    // auditoria (exige tabela WalletTx no banco)
    await tx.walletTx.create({
      data: {
        userId,
        tipo: "DEBIT",
        valorCreditos: valor,
        origem: meta.origem || "OUTRO",
        refId: meta.refId || null,
        metaJson: meta || {},
      },
    });

    return { ok: true, saldoAntes: saldoAtual, saldoDepois };
  });
}
