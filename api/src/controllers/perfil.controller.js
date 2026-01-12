import { prisma } from "../prisma.js";
import { z } from "zod";

const criarPerfilSchema = z.object({
    nome: z.string().min(2, "Nome muito curto"),
    bio: z.string().max(1000).optional().nullable(),
    cidade: z.string().max(80).optional().nullable(),
    estado: z.string().max(2).optional().nullable() // "SP"
});

const atualizarPerfilSchema = criarPerfilSchema.partial();

export async function criarPerfil(req, res) {
    const parsed = criarPerfilSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.flatten() });
    }

    const usuarioId = req.usuario.id;

    const jaTem = await prisma.perfil.findUnique({ where: { usuarioId } });
    if (jaTem) return res.status(409).json({ erro: "Perfil já existe. Use PUT /perfil" });

    const perfil = await prisma.perfil.create({
        data: { usuarioId, ...parsed.data }
    });

    return res.status(201).json(perfil);
}

export async function atualizarPerfil(req, res) {
    const parsed = atualizarPerfilSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.flatten() });
    }

    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfil.update({
        where: { usuarioId },
        data: parsed.data
    });

    return res.json(perfil);
}

export async function meuPerfil(req, res) {
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfil.findUnique({
        where: { usuarioId }
    });

    return res.json(perfil);
}
