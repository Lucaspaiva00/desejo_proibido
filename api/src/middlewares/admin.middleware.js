import { prisma } from "../prisma.js";

export async function adminOnly(req, res, next) {
    try {
        const userId = req.usuario?.id;
        if (!userId) return res.status(401).json({ erro: "Não autenticado" });

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { role: true, ativo: true },
        });

        if (!u || !u.ativo) return res.status(401).json({ erro: "Usuário inválido" });
        if (u.role !== "ADMIN") return res.status(403).json({ erro: "Acesso restrito (ADMIN)" });

        return next();
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao validar admin" });
    }
}
