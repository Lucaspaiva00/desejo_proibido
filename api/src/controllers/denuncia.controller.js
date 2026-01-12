import { prisma } from "../prisma.js";
import { z } from "zod";

const criarSchema = z.object({
    denunciadoId: z.string().min(1),
    motivo: z.string().min(3).max(60),
    descricao: z.string().max(2000).optional().nullable()
});

export async function denunciar(req, res) {
    const denuncianteId = req.usuario.id;

    const parsed = criarSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.flatten() });
    }

    const { denunciadoId, motivo, descricao } = parsed.data;

    if (denunciadoId === denuncianteId) {
        return res.status(400).json({ erro: "Você não pode denunciar a si mesmo" });
    }

    const existe = await prisma.usuario.findUnique({ where: { id: denunciadoId } });
    if (!existe) return res.status(404).json({ erro: "Usuário denunciado não encontrado" });

    const denuncia = await prisma.denuncia.create({
        data: {
            denuncianteId,
            denunciadoId,
            motivo,
            descricao: descricao ?? null
        }
    });

    return res.status(201).json(denuncia);
}

// (opcional) listar minhas denúncias (pra debug/admin futuro)
export async function minhasDenuncias(req, res) {
    const denuncianteId = req.usuario.id;

    const lista = await prisma.denuncia.findMany({
        where: { denuncianteId },
        orderBy: { criadoEm: "desc" },
        include: {
            denunciado: {
                select: {
                    id: true,
                    perfil: true,
                    fotos: { where: { principal: true }, take: 1 }
                }
            }
        }
    });

    const payload = lista.map((d) => ({
        id: d.id,
        motivo: d.motivo,
        descricao: d.descricao,
        criadoEm: d.criadoEm,
        denunciado: {
            id: d.denunciado.id,
            perfil: d.denunciado.perfil,
            fotoPrincipal: d.denunciado.fotos?.[0]?.url || null
        }
    }));

    return res.json(payload);
}
