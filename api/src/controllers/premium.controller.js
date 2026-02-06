// src/controllers/premium.controller.js
import { prisma } from "../prisma.js";
import { getPremiumStatus } from "../utils/wallet.js";

/**
 * GET /premium/me
 * Retorna status premium efetivo do usuário logado (Opção B)
 */
export async function premiumMe(req, res) {
    const userId = req.usuario.id;

    const { usuario, saldoCreditos, premiumEfetivo } = await getPremiumStatus(userId);

    if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });

    return res.json({
        id: usuario.id,
        email: usuario.email,
        isPremium: premiumEfetivo, // ✅ calculado
        plano: usuario.plano,
        role: usuario.role,
        saldoCreditos,
    });
}

/**
 * POST /premium/ativar
 * Ativa assinatura premium (não depende de créditos)
 */
export async function ativarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { plano: "PREMIUM", isPremium: true }, // pode manter por compat
        select: { id: true, email: true, plano: true, isPremium: true },
    });

    return res.json({
        ok: true,
        msg: "✅ Premium (assinatura) ativado com sucesso",
        usuario: u,
    });
}

/**
 * POST /premium/cancelar
 * Volta para FREE (mas se ainda tiver créditos, premiumEfetivo continua true no /premium/me)
 */
export async function cancelarPremium(req, res) {
    const u = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: { plano: "FREE", isPremium: false }, // compat
        select: { id: true, email: true, plano: true, isPremium: true },
    });

    return res.json({
        ok: true,
        msg: "✅ Assinatura Premium cancelada. (Se ainda houver créditos, você continua com Premium efetivo.)",
        usuario: u,
    });
}
