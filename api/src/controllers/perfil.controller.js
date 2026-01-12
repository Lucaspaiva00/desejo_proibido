import { prisma } from "../prisma.js";

export async function me(req, res) {
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfil.findUnique({
        where: { usuarioId }
    });

    return res.json(perfil); // pode ser null, ok
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
            estado: String(estado).toUpperCase()
        },
        create: {
            usuarioId,
            nome,
            bio: bio ?? null,
            cidade: cidade ?? null,
            estado: String(estado).toUpperCase()
        }
    });

    return res.json(perfil);
}
