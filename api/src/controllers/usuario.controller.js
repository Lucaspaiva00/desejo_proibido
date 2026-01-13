import { prisma } from "../prisma.js";

/**
 * GET /usuarios/me
 * Retorna dados da conta logada (pra UI saber Premium/Invisível)
 */
export async function me(req, res) {
    const u = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: {
            id: true,
            email: true,
            ativo: true,
            isPremium: true,
            isInvisivel: true,
            criadoEm: true,
            atualizadoEm: true,
        },
    });

    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });
    return res.json(u);
}

/**
 * PUT /usuarios/invisivel
 * body: { ativo: true|false }  (se não enviar, faz toggle)
 * Regras:
 * - Só Premium pode ativar/desativar modo invisível
 */
export async function setInvisivel(req, res) {
    const meuId = req.usuario.id;

    const usuario = await prisma.usuario.findUnique({
        where: { id: meuId },
        select: { id: true, isPremium: true, isInvisivel: true },
    });

    if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });

    if (!usuario.isPremium) {
        return res.status(403).json({
            erro: "Recurso disponível apenas para Premium",
            premium: false,
        });
    }

    const { ativo } = req.body || {};

    const novoValor =
        typeof ativo === "boolean" ? ativo : !Boolean(usuario.isInvisivel);

    const atualizado = await prisma.usuario.update({
        where: { id: meuId },
        data: { isInvisivel: novoValor },
        select: { id: true, isPremium: true, isInvisivel: true },
    });

    return res.json({
        ok: true,
        isInvisivel: atualizado.isInvisivel,
    });
}
