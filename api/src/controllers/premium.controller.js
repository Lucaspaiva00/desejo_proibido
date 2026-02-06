import { prisma } from "../prisma.js";

/**
 * PREMIUM EFETIVO:
 * - plano === "PREMIUM" (assinatura)
 * OU
 * - wallet.saldoCreditos > 0 (comprou créditos)
 */
export async function premiumMe(req, res) {
    try {
        const userId = req.usuario.id;

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, email: true, plano: true, role: true, isPremium: true },
        });

        if (!u) return res.status(401).json({ erro: "Usuário inválido" });

        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            select: { saldoCreditos: true },
        });

        const saldoCreditos = wallet?.saldoCreditos ?? 0;

        const premiumEfetivo =
            u.plano === "PREMIUM" || saldoCreditos > 0;

        return res.json({
            id: u.id,
            email: u.email,
            role: u.role,

            // ✅ o front deve usar isso
            isPremium: premiumEfetivo,

            // opcional
            plano: u.plano,
            saldoCreditos,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao consultar premium", detalhe: e.message });
    }
}

// Mantive suas rotas de ativar/cancelar (assinatura manual) se quiser continuar usando:
export async function ativarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { isPremium: true, plano: "PREMIUM" },
        select: { id: true, email: true, isPremium: true, plano: true },
    });

    return res.json({
        ok: true,
        msg: "✅ Premium ativado com sucesso",
        usuario: u,
    });
}

export async function cancelarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { isPremium: false, plano: "FREE" },
        select: { id: true, email: true, isPremium: true, plano: true },
    });

    return res.json({
        ok: true,
        msg: "✅ Premium cancelado. Você voltou ao plano FREE.",
        usuario: u,
    });
}
