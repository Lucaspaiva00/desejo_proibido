import { prisma } from "../prisma.js";

/**
 * PREMIUM EFETIVO:
 * - assinatura: usuario.plano === "PREMIUM"
 * OU
 * - comprou créditos: wallet.saldoCreditos > 0
 */
export async function premiumMe(req, res) {
    try {
        const userId = req.usuario.id;

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, email: true, plano: true, role: true },
        });

        if (!u) return res.status(401).json({ erro: "Usuário inválido" });

        // ✅ garante wallet (igual vocês fazem em /usuarios/me)
        await prisma.wallet.upsert({
            where: { userId },
            update: {},
            create: { userId, saldoCreditos: 0 },
        });

        // ⚠️ se "userId" não for unique no schema, troque findUnique por findFirst
        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            select: { saldoCreditos: true },
        });

        const saldoCreditos = wallet?.saldoCreditos ?? 0;

        const premiumEfetivo = u.plano === "PREMIUM" || saldoCreditos > 0;

        return res.json({
            id: u.id,
            email: u.email,
            role: u.role,
            plano: u.plano,
            isPremium: premiumEfetivo,
            saldoCreditos,
        });
    } catch (e) {
        return res.status(500).json({
            erro: "Erro ao consultar premium",
            detalhe: e.message,
        });
    }
}

export async function ativarPremium(req, res) {
    try {
        const u = await prisma.usuario.update({
            where: { id: req.usuario.id },
            data: { plano: "PREMIUM" },
            select: { id: true, email: true, plano: true },
        });

        return res.json({ ok: true, msg: "✅ Premium ativado", usuario: u });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao ativar premium", detalhe: e.message });
    }
}

export async function cancelarPremium(req, res) {
    try {
        const u = await prisma.usuario.update({
            where: { id: req.usuario.id },
            data: { plano: "FREE" },
            select: { id: true, email: true, plano: true },
        });

        return res.json({ ok: true, msg: "✅ Premium cancelado", usuario: u });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao cancelar premium", detalhe: e.message });
    }
}
