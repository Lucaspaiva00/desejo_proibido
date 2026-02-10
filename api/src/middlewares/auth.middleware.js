// src/middlewares/auth.middleware.js
import { verificarToken } from "../utils/jwt.js";
import { prisma } from "../prisma.js";
import { logAcesso } from "../utils/auditoria.js";

export async function auth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        await logAcesso(req, { evento: "TOKEN_AUSENTE", status: 401 });
        return res.status(401).json({ erro: "Token ausente" });
    }

    const [tipo, token] = header.split(" ");
    if (tipo !== "Bearer" || !token) {
        await logAcesso(req, { evento: "TOKEN_INVALIDO", status: 401, detalhe: "Formato inválido" });
        return res.status(401).json({ erro: "Formato do token inválido" });
    }

    try {
        const payload = verificarToken(token);

        const u = await prisma.usuario.findUnique({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                ativo: true,
                role: true,
                banGlobal: { select: { ativo: true, ate: true, motivo: true } },
            },
        });

        if (!u) {
            await logAcesso(req, { evento: "USUARIO_INVALIDO", status: 401, detalhe: "Usuário não encontrado" });
            return res.status(401).json({ erro: "Usuário inválido" });
        }

        if (!u.ativo) {
            await logAcesso(req, { usuarioId: u.id, email: u.email, evento: "DESATIVADO", status: 403 });
            return res.status(403).json({ erro: "Usuário desativado" });
        }

        const ban = u.banGlobal;
        if (ban?.ativo) {
            const agora = new Date();
            const dentroDoPrazo = !ban.ate || new Date(ban.ate) > agora;
            if (dentroDoPrazo) {
                await logAcesso(req, {
                    usuarioId: u.id,
                    email: u.email,
                    evento: "BANIDO",
                    status: 403,
                    detalhe: ban.motivo || "banGlobal ativo",
                });
                return res.status(403).json({ erro: "Usuário banido" });
            }
        }

        req.usuario = { id: u.id, email: u.email, role: u.role };
        return next();
    } catch (e) {
        await logAcesso(req, { evento: "TOKEN_INVALIDO", status: 401, detalhe: "expirado ou inválido" });
        return res.status(401).json({ erro: "Token inválido ou expirado" });
    }
}
