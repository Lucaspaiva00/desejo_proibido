import { prisma } from "../prisma.js";

/**
 * GET /premium/me
 * Retorna status premium do usuário logado
 */
export async function premiumMe(req, res) {
    const u = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { id: true, email: true, isPremium: true, plano: true, role: true }
    });

    if (!u) return res.status(401).json({ erro: "Usuário inválido" });

    return res.json({
        id: u.id,
        email: u.email,
        isPremium: !!u.isPremium,
        plano: u.plano,
        role: u.role
    });
}

/**
 * POST /premium/ativar
 * Ativação simples (sem pagamento) - por enquanto
 */
export async function ativarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { isPremium: true, plano: "PREMIUM" },
        select: { id: true, email: true, isPremium: true, plano: true }
    });

    return res.json({
        ok: true,
        msg: "✅ Premium ativado com sucesso",
        usuario: u
    });
}

/**
 * POST /premium/cancelar
 * Volta para FREE
 */
export async function cancelarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { isPremium: false, plano: "FREE" },
        select: { id: true, email: true, isPremium: true, plano: true }
    });

    return res.json({
        ok: true,
        msg: "✅ Premium cancelado. Você voltou ao plano FREE.",
        usuario: u
    });
}
