import { prisma } from "../prisma.js";

/**
 * GET /conversas
 * Lista as conversas do usuário logado a partir dos matches.
 * Se o match ainda não tem conversa, cria automaticamente.
 */
export async function listarConversas(req, res) {
    try {
        const userId = req.usuario.id;

        // pega matches onde eu sou A ou B
        const matches = await prisma.match.findMany({
            where: {
                OR: [{ usuarioAId: userId }, { usuarioBId: userId }],
            },
            orderBy: { criadoEm: "desc" },
            include: {
                conversa: true,
                usuarioA: {
                    select: {
                        id: true,
                        email: true,
                        perfil: true,
                        fotos: { orderBy: { principal: "desc" } },
                    },
                },
                usuarioB: {
                    select: {
                        id: true,
                        email: true,
                        perfil: true,
                        fotos: { orderBy: { principal: "desc" } },
                    },
                },
            },
        });

        // garante que exista conversa para cada match
        const convIds = [];
        for (const m of matches) {
            if (m.conversa?.id) {
                convIds.push(m.conversa.id);
                continue;
            }

            const conv = await prisma.conversa.create({
                data: { matchId: m.id },
            });
            convIds.push(conv.id);
        }

        // busca as conversas já com mensagens (pra pegar última mensagem)
        const conversas = await prisma.conversa.findMany({
            where: {
                id: { in: convIds },
            },
            orderBy: { atualizadoEm: "desc" },
            include: {
                match: {
                    include: {
                        usuarioA: {
                            select: {
                                id: true,
                                email: true,
                                perfil: true,
                                fotos: { orderBy: { principal: "desc" } },
                            },
                        },
                        usuarioB: {
                            select: {
                                id: true,
                                email: true,
                                perfil: true,
                                fotos: { orderBy: { principal: "desc" } },
                            },
                        },
                    },
                },
                mensagens: {
                    orderBy: { criadoEm: "desc" },
                    take: 1,
                    select: { id: true, texto: true, criadoEm: true },
                },
            },
        });

        // normaliza pro formato que seu front está esperando
        const out = conversas.map((c) => {
            const a = c.match.usuarioA;
            const b = c.match.usuarioB;

            const outro = a.id === userId ? b : a;

            return {
                id: c.id,
                matchId: c.matchId,
                atualizadoEm: c.atualizadoEm,
                outroUsuarioId: outro.id,
                outro,
                ultimaMensagem: c.mensagens?.[0] ? c.mensagens[0] : null,
            };
        });

        return res.json(out);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao listar conversas", detalhe: e.message });
    }
}

/**
 * GET /conversas/:id/mensagens
 */
export async function mensagensDaConversa(req, res) {
    try {
        const userId = req.usuario.id;
        const { id } = req.params;

        // valida que o usuário faz parte do match dessa conversa
        const conv = await prisma.conversa.findUnique({
            where: { id },
            include: {
                match: { select: { usuarioAId: true, usuarioBId: true } },
            },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const msgs = await prisma.mensagem.findMany({
            where: { conversaId: id },
            orderBy: { criadoEm: "asc" },
            include: {
                autor: { select: { id: true, email: true } },
            },
        });

        return res.json(msgs);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar mensagens", detalhe: e.message });
    }
}

/**
 * POST /conversas/abrir
 * body: { matchId }
 * Cria conversa se não existir e devolve conversaId
 */
export async function abrirConversaPorMatch(req, res) {
    try {
        const userId = req.usuario.id;
        const { matchId } = req.body;

        if (!matchId) return res.status(400).json({ erro: "matchId é obrigatório" });

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { conversa: true },
        });

        if (!match) return res.status(404).json({ erro: "Match não encontrado" });

        const isParte = match.usuarioAId === userId || match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a este match" });

        if (match.conversa?.id) {
            return res.json({ conversaId: match.conversa.id });
        }

        const conversa = await prisma.conversa.create({
            data: { matchId: match.id },
        });

        return res.json({ conversaId: conversa.id });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao abrir conversa", detalhe: e.message });
    }
}
