import { prisma } from "../prisma.js";

function addHours(date, hours) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

// GET /usuarios/me
export async function me(req, res) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: {
            id: true,
            email: true,
            ativo: true,
            isPremium: true,
            isInvisivel: true,
            boostAte: true,
            role: true,
            criadoEm: true,
        },
    });

    return res.json(usuario);
}

// PUT /usuarios/invisivel  { ativo: true/false }
export async function setInvisivel(req, res) {
    const { ativo } = req.body;

    const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { id: true, isPremium: true },
    });

    if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });

    if (!usuario.isPremium) {
        return res.status(403).json({ erro: "Disponível apenas no Premium" });
    }

    const atualizado = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { isInvisivel: !!ativo },
        select: { id: true, isInvisivel: true, isPremium: true },
    });

    return res.json(atualizado);
}

// PUT /usuarios/boost  { horas?: 6 }
export async function ativarBoost(req, res) {
    const horas = Number(req.body?.horas || 6);

    const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { id: true, isPremium: true, boostAte: true },
    });

    if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });

    if (!usuario.isPremium) {
        return res.status(403).json({ erro: "Boost disponível apenas no Premium" });
    }

    const now = new Date();
    const base = usuario.boostAte && usuario.boostAte > now ? usuario.boostAte : now;
    const novoBoostAte = addHours(base, horas);

    const atualizado = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { boostAte: novoBoostAte },
        select: { id: true, boostAte: true },
    });

    return res.json({
        ok: true,
        boostAte: atualizado.boostAte,
        mensagem: `✅ Boost ativado até ${atualizado.boostAte.toLocaleString()}`,
    });
}

// GET /usuarios/:id
export async function getUsuarioById(req, res) {
    try {
        const { id } = req.params;

        const u = await prisma.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                email: true, // se quiser esconder depois, tira
                ativo: true,
                isPremium: true,
                isInvisivel: true,
                boostAte: true,
                perfil: true,
                fotos: {
                    orderBy: { principal: "desc" },
                    select: {
                        id: true,
                        url: true,
                        principal: true,
                        criadoEm: true,
                    },
                },
            },
        });

        if (!u || !u.ativo) {
            return res.status(404).json({ erro: "Usuário não encontrado" });
        }

        return res.json(u);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}
