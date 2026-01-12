import { prisma } from "../prisma.js";

export async function minhasConversas(req, res) {
    const meuId = req.usuario.id;

    const conversas = await prisma.conversa.findMany({
        where: {
            match: {
                OR: [{ usuarioAId: meuId }, { usuarioBId: meuId }]
            }
        },
        orderBy: { atualizadoEm: "desc" },
        include: {
            match: {
                include: {
                    usuarioA: { select: { id: true, perfil: true, fotos: { where: { principal: true }, take: 1 } } },
                    usuarioB: { select: { id: true, perfil: true, fotos: { where: { principal: true }, take: 1 } } }
                }
            },
            mensagens: {
                orderBy: { criadoEm: "desc" },
                take: 1
            }
        }
    });

    const payload = conversas.map((c) => {
        const outro = c.match.usuarioAId === meuId ? c.match.usuarioB : c.match.usuarioA;
        const ultima = c.mensagens?.[0] || null;

        return {
            conversaId: c.id,
            matchId: c.matchId,
            atualizadoEm: c.atualizadoEm,
            outroUsuario: {
                id: outro.id,
                perfil: outro.perfil,
                fotoPrincipal: outro.fotos?.[0]?.url || null
            },
            ultimaMensagem: ultima
                ? { id: ultima.id, texto: ultima.texto, autorId: ultima.autorId, criadoEm: ultima.criadoEm }
                : null
        };
    });

    return res.json(payload);
}
