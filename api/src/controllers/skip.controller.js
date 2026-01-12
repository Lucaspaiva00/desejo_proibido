import { prisma } from "../prisma.js";

export async function pular(req, res) {
    const deUsuarioId = req.usuario.id;
    const { paraUsuarioId } = req.params;

    if (!paraUsuarioId) return res.status(400).json({ erro: "paraUsuarioId é obrigatório" });
    if (paraUsuarioId === deUsuarioId) return res.status(400).json({ erro: "Você não pode pular a si mesmo" });

    const existe = await prisma.usuario.findUnique({ where: { id: paraUsuarioId } });
    if (!existe) return res.status(404).json({ erro: "Usuário alvo não encontrado" });

    // salva skip (se já existir, mantém)
    const skip = await prisma.skip.upsert({
        where: { deUsuarioId_paraUsuarioId: { deUsuarioId, paraUsuarioId } },
        update: {},
        create: { deUsuarioId, paraUsuarioId }
    });

    return res.status(201).json(skip);
}
