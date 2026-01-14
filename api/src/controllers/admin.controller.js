import { prisma } from "../prisma.js";
import { logDenuncia } from "../utils/auditoria.js";

// helper: log de ação
async function logAcaoAdmin({ adminId, alvoId, tipo, motivo, detalhes }) {
    return prisma.acaoAdmin.create({
        data: {
            adminId,
            alvoId: alvoId ?? null,
            tipo,
            motivo: motivo ?? null,
            detalhes: detalhes ?? null,
        },
    });
}

/**
 * GET /admin/denuncias?status=ABERTA&page=1&limit=20
 */
export async function listarDenuncias(req, res) {
    const status = req.query.status || "ABERTA";
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [total, items] = await Promise.all([
        prisma.denuncia.count({ where }),
        prisma.denuncia.findMany({
            where,
            orderBy: { criadoEm: "desc" },
            skip,
            take: limit,
            include: {
                denunciante: { select: { id: true, email: true } },
                denunciado: { select: { id: true, email: true } },
            },
        }),
    ]);

    return res.json({ page, limit, total, data: items });
}

/**
 * GET /admin/denuncias/:id
 */
export async function detalheDenuncia(req, res) {
    const { id } = req.params;

    const d = await prisma.denuncia.findUnique({
        where: { id },
        include: {
            denunciante: {
                select: {
                    id: true,
                    email: true,
                    perfil: true,
                },
            },
            denunciado: {
                select: {
                    id: true,
                    email: true,
                    perfil: true,
                    banGlobal: true,
                },
            },
        },
    });

    if (!d) return res.status(404).json({ erro: "Denúncia não encontrada" });

    return res.json(d);
}

/**
 * PUT /admin/denuncias/:id/status
 * body: { status: "EM_ANALISE" | "RESOLVIDA" | "IGNORADA", detalhes?: string }
 */
export async function atualizarStatusDenuncia(req, res) {
    const adminId = req.usuario.id;
    const { id } = req.params;
    const { status, detalhes } = req.body;

    if (!status) return res.status(400).json({ erro: "status é obrigatório" });

    const existe = await prisma.denuncia.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ erro: "Denúncia não encontrada" });

    const statusAntes = existe.status;

    const updated = await prisma.denuncia.update({
        where: { id },
        data: { status },
    });

    await logAcaoAdmin({
        adminId,
        alvoId: existe.denunciadoId,
        tipo: "DENUNCIA_STATUS",
        motivo: `Denúncia ${id} -> ${status}`,
        detalhes: detalhes ?? null,
    });

    await logDenuncia(req, {
        denunciaId: id,
        denuncianteId: existe.denuncianteId,
        denunciadoId: existe.denunciadoId,
        adminId,
        tipo: "STATUS_ALTERADO",
        statusAntes,
        statusDepois: status,
        motivo: `Status atualizado`,
        detalhes: detalhes ?? null,
    });

    return res.json(updated);
}


/**
 * POST /admin/ban-global
 * body: { usuarioId, motivo?, ate? }  // ate ISO string opcional
 */
export async function banGlobal(req, res) {
    const adminId = req.usuario.id;
    const { usuarioId, motivo, ate } = req.body;

    if (!usuarioId) return res.status(400).json({ erro: "usuarioId é obrigatório" });

    const alvo = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, ativo: true },
    });
    if (!alvo) return res.status(404).json({ erro: "Usuário alvo não encontrado" });

    const dataAte = ate ? new Date(ate) : null;

    const ban = await prisma.banGlobal.upsert({
        where: { usuarioId },
        update: { ativo: true, motivo: motivo ?? null, ate: dataAte },
        create: { usuarioId, ativo: true, motivo: motivo ?? null, ate: dataAte },
    });

    await prisma.usuario.update({
        where: { id: usuarioId },
        data: { ativo: false },
    });

    await logAcaoAdmin({
        adminId,
        alvoId: usuarioId,
        tipo: "BAN_GLOBAL",
        motivo: motivo ?? "Ban global aplicado",
        detalhes: dataAte ? `Até: ${dataAte.toISOString()}` : null,
    });

    await logDenuncia(req, {
        denunciadoId: usuarioId,
        adminId,
        tipo: "BAN_APLICADO",
        motivo: motivo ?? "Ban global aplicado",
        detalhes: dataAte ? `Até: ${dataAte.toISOString()}` : null,
    });

    return res.json({ ok: true, ban });
}


/**
 * POST /admin/desbanir
 * body: { usuarioId, motivo? }
 */
export async function desbanir(req, res) {
    const adminId = req.usuario.id;
    const { usuarioId, motivo } = req.body;

    if (!usuarioId) return res.status(400).json({ erro: "usuarioId é obrigatório" });

    const ban = await prisma.banGlobal.findUnique({ where: { usuarioId } });
    if (!ban) return res.status(404).json({ erro: "Esse usuário não está banido" });

    const updated = await prisma.banGlobal.update({
        where: { usuarioId },
        data: { ativo: false, ate: null },
    });

    await prisma.usuario.update({
        where: { id: usuarioId },
        data: { ativo: true },
    });

    await logAcaoAdmin({
        adminId,
        alvoId: usuarioId,
        tipo: "DESBANIR",
        motivo: motivo ?? "Desbanido",
        detalhes: null,
    });

    await logDenuncia(req, {
        denunciadoId: usuarioId,
        adminId,
        tipo: "DESBANIDO",
        motivo: motivo ?? "Desbanido",
        detalhes: null,
    });

    return res.json({ ok: true, ban: updated });
}


/**
 * GET /admin/usuarios/:id
 */
export async function verUsuarioAdmin(req, res) {
    const { id } = req.params;

    const u = await prisma.usuario.findUnique({
        where: { id },
        include: {
            perfil: true,
            fotos: { orderBy: { principal: "desc" } },
            banGlobal: true,
        },
    });

    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });

    return res.json(u);
}

/**
 * GET /admin/acoes?page=1&limit=30
 */
export async function listarAcoesAdmin(req, res) {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
        prisma.acaoAdmin.count(),
        prisma.acaoAdmin.findMany({
            orderBy: { criadoEm: "desc" },
            skip,
            take: limit,
            include: {
                admin: { select: { id: true, email: true } },
                alvo: { select: { id: true, email: true } },
            },
        }),
    ]);

    return res.json({ page, limit, total, data: items });
}

export async function listarLogsAcesso(req, res) {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const skip = (page - 1) * limit;

    const evento = req.query.evento || null;
    const where = evento ? { evento } : {};

    const [total, items] = await Promise.all([
        prisma.logAcesso.count({ where }),
        prisma.logAcesso.findMany({
            where,
            orderBy: { criadoEm: "desc" },
            skip,
            take: limit,
            include: { usuario: { select: { id: true, email: true } } },
        }),
    ]);

    return res.json({ page, limit, total, data: items });
}

export async function listarLogsDenuncia(req, res) {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const skip = (page - 1) * limit;

    const tipo = req.query.tipo || null;
    const where = tipo ? { tipo } : {};

    const [total, items] = await Promise.all([
        prisma.logDenuncia.count({ where }),
        prisma.logDenuncia.findMany({
            where,
            orderBy: { criadoEm: "desc" },
            skip,
            take: limit,
        }),
    ]);

    return res.json({ page, limit, total, data: items });
}
