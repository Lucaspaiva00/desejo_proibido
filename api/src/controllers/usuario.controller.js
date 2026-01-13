import { prisma } from "../prisma.js";

export async function verPerfilPublico(req, res) {
    const meuId = req.usuario.id;
    const { id } = req.params;

    if (!id) return res.status(400).json({ erro: "id é obrigatório" });
    if (id === meuId) return res.status(400).json({ erro: "Use /perfil/me para seu próprio perfil" });

    // opcional: impedir ver quem te bloqueou / quem você bloqueou
    const bloqueado = await prisma.bloqueio.findFirst({
        where: {
            OR: [
                { deUsuarioId: meuId, paraUsuarioId: id },
                { deUsuarioId: id, paraUsuarioId: meuId }
            ]
        }
    });
    if (bloqueado) return res.status(403).json({ erro: "Acesso indisponível" });

    const usuario = await prisma.usuario.findUnique({
        where: { id },
        select: {
            id: true,
            perfil: true,
            fotos: { orderBy: { principal: "desc" } }
        }
    });

    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
    if (!usuario.perfil) return res.status(404).json({ erro: "Usuário sem perfil" });

    const fotoPrincipal = usuario.fotos?.find(f => f.principal)?.url || null;

    return res.json({
        id: usuario.id,
        perfil: usuario.perfil,
        fotoPrincipal,
        fotos: usuario.fotos.map(f => ({ id: f.id, url: f.url, principal: f.principal }))
    });
}
