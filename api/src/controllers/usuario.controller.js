// src/controllers/usuario.controller.js
import { prisma } from "../prisma.js";

const CUSTO = 150;
const DURACAO_MIN = 30;

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function ensureWalletTx(tx, userId) {
    await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, saldoCreditos: 0 },
    });
}

async function debitarCreditosTx(tx, userId, valor, origem) {
    await ensureWalletTx(tx, userId);

    const w = await tx.wallet.findUnique({ where: { userId } });
    const saldo = w?.saldoCreditos ?? 0;

    if (saldo < valor) {
        const err = new Error("Saldo de créditos insuficiente");
        err.status = 402;
        throw err;
    }

    await tx.wallet.update({
        where: { userId },
        data: { saldoCreditos: { decrement: valor } },
    });

    await tx.walletTx.create({
        data: {
            userId,
            tipo: "DEBITO",
            origem, // "BOOST" | "INVISIVEL"
            valor,
        },
    });

    const w2 = await tx.wallet.findUnique({ where: { userId } });
    return w2?.saldoCreditos ?? 0;
}

async function normalizarExpiracoes(userId) {
    const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
            boostAte: true,
            invisivelAte: true,
            isInvisivel: true,
        },
    });
    if (!u) return;

    const now = new Date();
    const data = {};

    // boost expirado
    if (u.boostAte && u.boostAte <= now) data.boostAte = null;

    // invisível expirado
    if (u.invisivelAte && u.invisivelAte <= now) {
        data.invisivelAte = null;
        data.isInvisivel = false;
    }

    if (Object.keys(data).length) {
        await prisma.usuario.update({ where: { id: userId }, data });
    }
}

function calcPremiumAtivo(isPremium, saldoCreditos) {
    return !!isPremium || (saldoCreditos ?? 0) >= CUSTO;
}

// GET /usuarios/me
export async function me(req, res) {
    try {
        const userId = req.usuario.id;

        await normalizarExpiracoes(userId);

        // garante wallet
        await prisma.wallet.upsert({
            where: { userId },
            update: {},
            create: { userId, saldoCreditos: 0 },
        });

        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                ativo: true,
                isPremium: true,
                plano: true,
                isInvisivel: true,
                invisivelAte: true,
                boostAte: true,
                role: true,
                criadoEm: true,
            },
        });

        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            select: { saldoCreditos: true },
        });

        const saldoCreditos = wallet?.saldoCreditos ?? 0;

        return res.json({
            ...usuario,
            saldoCreditos,
            // ✅ novo: o front usa isso
            premiumAtivo: calcPremiumAtivo(usuario?.isPremium, saldoCreditos),
        });
    } catch (e) {
        return res
            .status(500)
            .json({ erro: "Erro ao buscar /usuarios/me", detalhe: e.message });
    }
}

// PUT /usuarios/invisivel  { ativo: true/false }
// - ativar: premiumAtivo + cobra 150 + 30min
// - desativar: desliga e zera invisivelAte (sem cobrar)
export async function setInvisivel(req, res) {
    try {
        const userId = req.usuario.id;
        const ativo = !!req.body?.ativo;

        await normalizarExpiracoes(userId);

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, isPremium: true, isInvisivel: true, invisivelAte: true },
        });

        if (!u) return res.status(401).json({ erro: "Usuário inválido" });

        // pega saldo
        const w0 = await prisma.wallet.findUnique({
            where: { userId },
            select: { saldoCreditos: true },
        });
        const saldo0 = w0?.saldoCreditos ?? 0;

        // ✅ troca: não é só isPremium, é premiumAtivo (isPremium OU saldo >= 150)
        const premiumAtivo = calcPremiumAtivo(u.isPremium, saldo0);

        if (!premiumAtivo) {
            return res.status(403).json({ erro: "Disponível apenas no Premium (ou com 150 créditos)" });
        }

        // desativar
        if (!ativo) {
            const atualizado = await prisma.usuario.update({
                where: { id: userId },
                data: { isInvisivel: false, invisivelAte: null },
                select: { id: true, isInvisivel: true, invisivelAte: true },
            });

            const w = await prisma.wallet.findUnique({
                where: { userId },
                select: { saldoCreditos: true },
            });

            return res.json({
                ...atualizado,
                custo: 0,
                saldoCreditos: w?.saldoCreditos ?? 0,
            });
        }

        const now = new Date();

        // se já está ativo e ainda válido, não cobra de novo
        if (u.isInvisivel && u.invisivelAte && u.invisivelAte > now) {
            const w = await prisma.wallet.findUnique({
                where: { userId },
                select: { saldoCreditos: true },
            });

            return res.json({
                id: u.id,
                isInvisivel: true,
                invisivelAte: u.invisivelAte,
                custo: 0,
                saldoCreditos: w?.saldoCreditos ?? 0,
                mensagem: "Já estava ativo",
            });
        }

        const invisivelAte = addMinutes(now, DURACAO_MIN);

        const result = await prisma.$transaction(async (tx) => {
            const saldoApos = await debitarCreditosTx(tx, userId, CUSTO, "INVISIVEL");

            const atualizado = await tx.usuario.update({
                where: { id: userId },
                data: { isInvisivel: true, invisivelAte },
                select: { id: true, isInvisivel: true, invisivelAte: true },
            });

            return { ...atualizado, custo: CUSTO, saldoCreditos: saldoApos };
        });

        return res.json(result);
    } catch (e) {
        const status = e.status || 500;
        return res.status(status).json({ erro: "Erro ao ativar invisível", detalhe: e.message });
    }
}

// PUT /usuarios/boost
// - premiumAtivo + cobra 150 + 30min
// - se já ativo: estende +30min e cobra novamente
export async function ativarBoost(req, res) {
    try {
        const userId = req.usuario.id;

        await normalizarExpiracoes(userId);

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, isPremium: true, boostAte: true },
        });

        if (!u) return res.status(401).json({ erro: "Usuário inválido" });

        // saldo
        const w0 = await prisma.wallet.findUnique({
            where: { userId },
            select: { saldoCreditos: true },
        });
        const saldo0 = w0?.saldoCreditos ?? 0;

        const premiumAtivo = calcPremiumAtivo(u.isPremium, saldo0);

        if (!premiumAtivo) {
            return res.status(403).json({ erro: "Boost disponível apenas no Premium (ou com 150 créditos)" });
        }

        const now = new Date();
        const base = u.boostAte && u.boostAte > now ? u.boostAte : now;
        const novoBoostAte = addMinutes(base, DURACAO_MIN);

        const result = await prisma.$transaction(async (tx) => {
            const saldoApos = await debitarCreditosTx(tx, userId, CUSTO, "BOOST");

            const atualizado = await tx.usuario.update({
                where: { id: userId },
                data: { boostAte: novoBoostAte },
                select: { id: true, boostAte: true },
            });

            return {
                ok: true,
                boostAte: atualizado.boostAte,
                custo: CUSTO,
                saldoCreditos: saldoApos,
                mensagem: `✅ Boost ativado até ${atualizado.boostAte.toLocaleString()}`,
            };
        });

        return res.json(result);
    } catch (e) {
        const status = e.status || 500;
        return res.status(status).json({ erro: "Erro ao ativar boost", detalhe: e.message });
    }
}

// GET /usuarios/:id (mantém)
export async function getUsuarioById(req, res) {
    try {
        const { id } = req.params;

        const u = await prisma.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                ativo: true,
                isPremium: true,
                isInvisivel: true,
                invisivelAte: true,
                boostAte: true,
                perfil: true,
                fotos: {
                    orderBy: { principal: "desc" },
                    select: { id: true, url: true, principal: true, criadoEm: true },
                },
            },
        });

        if (!u || !u.ativo) return res.status(404).json({ erro: "Usuário não encontrado" });
        return res.json(u);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}
