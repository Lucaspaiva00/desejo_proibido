import { prisma } from "../prisma.js";

/**
 * GET /matches
 * Lista os matches do usuário logado e já devolve "outro usuário" pronto pro front.
 * Também garante que existe uma conversa para cada match.
 */
export async function listarMatches(req, res) {
    try {
        const userId = req.usuario.id;

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

        // garante conversa em todos os matches
        const out = [];
        for (const m of matches) {
            let conversaId = m.conversa?.id;

            if (!conversaId) {
                const conv = await prisma.conversa.create({
                    data: { matchId: m.id },
                });
                conversaId = conv.id;
            }

            const outro = m.usuarioA.id === userId ? m.usuarioB : m.usuarioA;

            out.push({
                id: m.id,
                criadoEm: m.criadoEm,
                conversaId,
                outroUsuarioId: outro.id,
                outro,
            });
        }

        return res.json(out);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao listar matches", detalhe: e.message });
    }
}
