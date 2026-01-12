import { prisma } from "../prisma.js";

export async function meusMatches(req, res) {
    const meuId = req.usuario.id;

    const matches = await prisma.match.findMany({
        where: {
            OR: [{ usuarioAId: meuId }, { usuarioBId: meuId }]
        },
        orderBy: { criadoEm: "desc" },
        include: {
            usuarioA: {
                select: {
                    id: true,
                    email: true,
                    perfil: true,
                    fotos: { where: { principal: true } }
                }
            },
            usuarioB: {
                select: {
                    id: true,
                    email: true,
                    perfil: true,
                    fotos: { where: { principal: true } }
                }
            }
        }
    });

    // transforma pra retornar "o outro usuário"
    const payload = matches.map((m) => {
        const outro = m.usuarioAId === meuId ? m.usuarioB : m.usuarioA;
        return {
            matchId: m.id,
            criadoEm: m.criadoEm,
            outroUsuario: {
                id: outro.id,
                perfil: outro.perfil,
                fotoPrincipal: outro.fotos?.[0]?.url || null
            }
        };
    });

    return res.json(payload);
}
