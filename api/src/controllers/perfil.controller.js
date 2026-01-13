import { prisma } from "../prisma.js";

export async function me(req, res) {
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfil.findUnique({
        where: { usuarioId },
    });

    return res.json(perfil); // pode ser null
}

// PUT /perfil  (cria ou atualiza)
export async function salvarPerfil(req, res) {
    const usuarioId = req.usuario.id;
    const { nome, bio, cidade, estado } = req.body;

    if (!nome) return res.status(400).json({ erro: "nome é obrigatório" });
    if (!estado || String(estado).length !== 2) {
        return res.status(400).json({ erro: "estado deve ter 2 letras (ex: SP)" });
    }

    const perfil = await prisma.perfil.upsert({
        where: { usuarioId },
        update: {
            nome,
            bio: bio ?? null,
            cidade: cidade ?? null,
            estado: String(estado).toUpperCase(),
        },
        create: {
            usuarioId,
            nome,
            bio: bio ?? null,
            cidade: cidade ?? null,
            estado: String(estado).toUpperCase(),
        },
    });

    return res.json(perfil);
}

/**
 * GET /perfil/publico/:id
 * - bloqueios bloqueiam
 * - se alvo estiver invisível, só mostra se for match
 */
export async function verPerfilPublico(req, res) {
    const meuId = req.usuario.id;
    const { id } = req.params;

    if (!id) return res.status(400).json({ erro: "id é obrigatório" });
    if (id === meuId) {
        return res.status(400).json({ erro: "Use /perfil/me para seu próprio perfil" });
    }

    const bloqueado = await prisma.bloqueio.findFirst({
        where: {
            OR: [
                { deUsuarioId: meuId, paraUsuarioId: id },
                { deUsuarioId: id, paraUsuarioId: meuId },
            ],
        },
    });
    if (bloqueado) return res.status(403).json({ erro: "Acesso indisponível" });

    const usuario = await prisma.usuario.findUnique({
        where: { id },
        select: {
            id: true,
            isInvisivel: true,
            perfil: true,
            fotos: { orderBy: { principal: "desc" } },
        },
    });

    if (!usuario || !usuario.perfil) {
        return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    if (usuario.isInvisivel) {
        const match = await prisma.match.findFirst({
            where: {
                OR: [
                    { usuarioAId: meuId, usuarioBId: id },
                    { usuarioAId: id, usuarioBId: meuId },
                ],
            },
        });

        if (!match) return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    const fotoPrincipal = usuario.fotos?.find((f) => f.principal)?.url || null;

    return res.json({
        id: usuario.id,
        perfil: usuario.perfil,
        fotoPrincipal,
        fotos: usuario.fotos.map((f) => ({ id: f.id, url: f.url, principal: f.principal })),
    });
}
