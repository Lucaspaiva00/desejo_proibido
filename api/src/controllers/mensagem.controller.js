import { prisma } from "../prisma.js";
import { z } from "zod";

const enviarSchema = z.object({
    texto: z.string().min(1).max(2000)
});

async function validarAcessoConversa(conversaId, meuId) {
    const conversa = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true }
    });

    if (!conversa) return { ok: false, status: 404, erro: "Conversa não encontrada" };

    const { usuarioAId, usuarioBId } = conversa.match;
    if (usuarioAId !== meuId && usuarioBId !== meuId) {
        return { ok: false, status: 403, erro: "Sem permissão para esta conversa" };
    }

    return { ok: true, conversa };
}

export async function listarMensagens(req, res) {
    const meuId = req.usuario.id;
    const { conversaId } = req.params;

    const check = await validarAcessoConversa(conversaId, meuId);
    if (!check.ok) return res.status(check.status).json({ erro: check.erro });

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const skip = (page - 1) * limit;

    const mensagens = await prisma.mensagem.findMany({
        where: { conversaId },
        orderBy: { criadoEm: "desc" },
        skip,
        take: limit,
        include: {
            autor: { select: { id: true } }
        }
    });

    return res.json({
        page,
        limit,
        total: mensagens.length,
        data: mensagens
    });
}

export async function enviarMensagem(req, res) {
    const meuId = req.usuario.id;
    const { conversaId } = req.params;

    const parsed = enviarSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: parsed.error.flatten() });
    }

    const check = await validarAcessoConversa(conversaId, meuId);
    if (!check.ok) return res.status(check.status).json({ erro: check.erro });

    const msg = await prisma.mensagem.create({
        data: {
            conversaId,
            autorId: meuId,
            texto: parsed.data.texto
        }
    });

    // “bump” na conversa (atualizadoEm)
    await prisma.conversa.update({
        where: { id: conversaId },
        data: { atualizadoEm: new Date() }
    });

    return res.status(201).json(msg);
}
