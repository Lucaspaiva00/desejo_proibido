// src/utils/auditoria.js
import { prisma } from "../prisma.js";

export function logAcesso(
    req,
    { usuarioId = null, email = null, evento, status = null, detalhe = null } = {}
) {
    // NÃO travar request por auditoria
    prisma.logAcesso
        .create({
            data: {
                usuarioId,
                email,
                evento,
                rota: req.originalUrl || req.url || null,
                metodo: req.method || null,
                status,
                ip: req.ip || null,
                userAgent: req.headers["user-agent"] || null,
                detalhe,
            },
        })
        .catch((e) => {
            console.error("Falha ao gravar LogAcesso:", e?.message || e);
        });
}

export function logDenuncia(
    req,
    {
        denunciaId = null,
        denuncianteId = null,
        denunciadoId = null,
        adminId = null,
        tipo,
        statusAntes = null,
        statusDepois = null,
        motivo = null,
        detalhes = null,
    } = {}
) {
    prisma.logDenuncia
        .create({
            data: {
                denunciaId,
                denuncianteId,
                denunciadoId,
                adminId,
                tipo,
                statusAntes,
                statusDepois,
                motivo,
                detalhes,
                ip: req.ip || null,
                userAgent: req.headers["user-agent"] || null,
            },
        })
        .catch((e) => {
            console.error("Falha ao gravar LogDenuncia:", e?.message || e);
        });
}