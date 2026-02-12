// src/controllers/conversa.controller.js
import { prisma } from "../prisma.js";
import { getOrCreateTranslation } from "../services/translate.service.js";
import { buildPublicUrl } from "../utils/cloudinary.js";

const CHAT_UNLOCK_CREDITS = Number(process.env.CHAT_UNLOCK_CREDITS || 10);

// ==============================
// Wallet helpers (local)
// ==============================
async function ensureWallet(userId) {
    return prisma.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, saldoCreditos: 0 },
    });
}

async function getSaldoCreditos(userId) {
    await ensureWallet(userId);
    const w = await prisma.wallet.findUnique({ where: { userId } });
    return w?.saldoCreditos ?? 0;
}

async function isChatLiberadoParaUsuario(conversaId, userId) {
    const tx = await prisma.walletTx.findFirst({
        where: { userId, origem: "CHAT_UNLOCK", tipo: "DEBIT", refId: conversaId },
        select: { id: true },
    });
    return !!tx;
}

async function alreadyUnlockedMedia(userId, mensagemId) {
    const tx = await prisma.walletTx.findFirst({
        where: {
            userId,
            origem: "MIDIA_UNLOCK",
            tipo: "DEBIT",
            refId: String(mensagemId),
        },
        select: { id: true },
    });
    return !!tx;
}

function assertParteDaConversa(conv, userId) {
    const match = conv?.match;
    if (!match) return false;
    return match.usuarioAId === userId || match.usuarioBId === userId;
}

function shouldTranslateMessage(m) {
    const tipo = m?.tipo || "TEXTO";
    return tipo === "TEXTO";
}

function splitPath(p) {
    const s = String(p || "").trim();
    if (!s) return { publicId: null, format: null };
    const lastDot = s.lastIndexOf(".");
    if (lastDot <= 0) return { publicId: s, format: null };
    return { publicId: s.slice(0, lastDot), format: s.slice(lastDot + 1) };
}

/**
 * ✅ Mapeia mensagem p/ front
 * - TEXTO: tradução
 * - FOTO: thumbUrl sempre; mediaUrl só se autor OU desbloqueou
 * - AUDIO: audioUrl sempre
 */
async function mapMensagemParaUsuario(m, idiomaDestino, viewerId) {
    const original = (m.textoOriginal ?? m.texto ?? "").trim();
    const idiomaOriginal = m.idiomaOriginal || "pt";

    let textoExibido = m.texto ?? original;

    if (shouldTranslateMessage(m) && original && idiomaDestino && idiomaDestino !== idiomaOriginal) {
        const t = await getOrCreateTranslation({
            mensagemId: m.id,
            idiomaDestino,
            textoOriginal: original,
            idiomaOriginal,
        });
        if (t) textoExibido = t;
    }

    const tipo = m.tipo || "TEXTO";

    let thumbUrl = null;
    let mediaUrl = null;
    let audioUrl = null;

    const custoMoedas = (m.custoMoedas ?? null);

    // se for o autor, nunca fica "locked" pra ele
    let locked = !!m.bloqueada;
    if (String(m.autorId) === String(viewerId)) locked = false;

    if (tipo === "FOTO") {
        const { publicId: tId, format: tFmt } = splitPath(m.thumbPath);
        if (tId) {
            thumbUrl = buildPublicUrl({
                publicId: tId,
                resourceType: "image",
                format: tFmt || "jpg",
                transformation: "",
            });
        }

        const canSeeOriginal = !locked || (await alreadyUnlockedMedia(viewerId, m.id));

        if (canSeeOriginal) {
            const { publicId, format } = splitPath(m.mediaPath);
            if (publicId) {
                mediaUrl = buildPublicUrl({
                    publicId,
                    resourceType: "image",
                    format: format || "jpg",
                    transformation: "",
                });
            }
        }
    }

    if (tipo === "AUDIO") {
        const { publicId, format } = splitPath(m.mediaPath);
        if (publicId) {
            audioUrl = buildPublicUrl({
                publicId,
                resourceType: "video", // cloudinary audio = resource_type video
                format: format || "mp3",
                transformation: "",
            });
        }
    }

    return {
        ...m,
        texto: m.texto ?? original,
        textoOriginal: m.textoOriginal ?? original,
        idiomaOriginal,
        textoExibido,

        // mídia
        thumbUrl,
        mediaUrl,
        audioUrl,

        locked,
        custoMoedas,
    };
}

// ==============================
// LISTAR CONVERSAS
// ==============================
export async function listarConversas(req, res) {
    const userId = req.usuario.id;
    const idiomaDestino = req.lang || req.usuario?.idioma || "pt";

    const conversas = await prisma.conversa.findMany({
        where: { match: { OR: [{ usuarioAId: userId }, { usuarioBId: userId }] } },
        orderBy: { atualizadoEm: "desc" },
        include: { match: true },
    });

    const conversaIds = conversas.map((c) => c.id);
    if (conversaIds.length === 0) return res.json([]);

    const ultimas = await prisma.mensagem.findMany({
        where: { conversaId: { in: conversaIds } },
        orderBy: { criadoEm: "desc" },
        distinct: ["conversaId"],
        select: {
            id: true,
            conversaId: true,
            texto: true,
            textoOriginal: true,
            idiomaOriginal: true,
            tipo: true,
            criadoEm: true,
        },
    });

    const outroIds = conversas.map((c) => {
        const a = c.match.usuarioAId;
        const b = c.match.usuarioBId;
        return a === userId ? b : a;
    });

    const outros = await prisma.usuario.findMany({
        where: { id: { in: outroIds } },
        include: { perfil: true, fotos: true },
    });

    const outroById = new Map();
    for (const u of outros) outroById.set(u.id, u);

    const unlocks = await prisma.walletTx.findMany({
        where: {
            userId,
            origem: "CHAT_UNLOCK",
            tipo: "DEBIT",
            refId: { in: conversaIds },
        },
        select: { refId: true },
    });

    const liberadasSet = new Set(unlocks.map((u) => u.refId));

    const lastByConversa = new Map();
    for (const m of ultimas) {
        const original = (m.textoOriginal ?? m.texto ?? "").trim();
        const from = m.idiomaOriginal || "pt";
        let textoExibido = m.texto ?? original;

        if (m.tipo === "TEXTO" && original && idiomaDestino && idiomaDestino !== from) {
            const t = await getOrCreateTranslation({
                mensagemId: m.id,
                idiomaDestino,
                textoOriginal: original,
                idiomaOriginal: from,
            });
            if (t) textoExibido = t;
        }

        lastByConversa.set(m.conversaId, {
            texto: m.texto ?? original,
            textoExibido,
            criadoEm: m.criadoEm,
        });
    }

    const data = conversas.map((c) => {
        const outroId = c.match.usuarioAId === userId ? c.match.usuarioBId : c.match.usuarioAId;
        const outro = outroById.get(outroId) || null;
        const ultima = lastByConversa.get(c.id) || null;

        return {
            id: c.id,
            atualizadoEm: c.atualizadoEm,
            chatLiberado: liberadasSet.has(c.id),
            outroUsuarioId: outroId,
            outro,
            ultimaMensagem: ultima,
        };
    });

    return res.json(data);
}

// ==============================
// MENSAGENS DA CONVERSA
// ==============================
export async function mensagensDaConversa(req, res) {
    const userId = req.usuario.id;
    const idiomaDestino = req.lang || req.usuario?.idioma || "pt";
    const { id: conversaId } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
    if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

    const mensagens = await prisma.mensagem.findMany({
        where: { conversaId },
        orderBy: { criadoEm: "asc" },
        take: 200,
        select: {
            id: true,
            conversaId: true,
            autorId: true,
            tipo: true,
            texto: true,
            textoOriginal: true,
            idiomaOriginal: true,
            metaJson: true,
            criadoEm: true,

            mediaPath: true,
            thumbPath: true,
            mediaDuracao: true,
            bloqueada: true,
            custoMoedas: true,
        },
    });

    const mapped = [];
    for (const m of mensagens) {
        mapped.push(await mapMensagemParaUsuario(m, idiomaDestino, userId));
    }

    return res.json({ mensagens: mapped, lang: idiomaDestino });
}

// ==============================
// ABRIR/CRIAR CONVERSA POR MATCH
// ==============================
export async function abrirConversaPorMatch(req, res) {
    const userId = req.usuario.id;
    const { matchId } = req.body || {};

    if (!matchId) return res.status(400).json({ erro: "matchId é obrigatório" });

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ erro: "Match não encontrado" });

    if (match.usuarioAId !== userId && match.usuarioBId !== userId) {
        return res.status(403).json({ erro: "Sem acesso" });
    }

    let conversa = await prisma.conversa.findFirst({ where: { matchId } });

    if (!conversa) {
        conversa = await prisma.conversa.create({ data: { matchId } });
    }

    return res.json(conversa);
}

// ==============================
// STATUS (CRÉDITOS)
// ==============================
export async function statusConversa(req, res) {
    const userId = req.usuario.id;
    const { id: conversaId } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
    if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

    const chatLiberado = await isChatLiberadoParaUsuario(conversaId, userId);
    const saldoCreditos = await getSaldoCreditos(userId);

    return res.json({
        chatLiberado,
        custoCreditos: CHAT_UNLOCK_CREDITS,
        saldoCreditos,
    });
}

// ==============================
// LIBERAR CHAT (CRÉDITOS)
// ==============================
export async function liberarChat(req, res) {
    const userId = req.usuario.id;
    const { id: conversaId } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
    if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

    await ensureWallet(userId);

    const jaLiberado = await isChatLiberadoParaUsuario(conversaId, userId);
    const saldo = await getSaldoCreditos(userId);

    if (jaLiberado) {
        return res.json({ chatLiberado: true, custoCreditos: CHAT_UNLOCK_CREDITS, saldoCreditos: saldo });
    }

    if (CHAT_UNLOCK_CREDITS <= 0) {
        await prisma.walletTx.create({
            data: { userId, tipo: "DEBIT", origem: "CHAT_UNLOCK", valor: 0, refId: conversaId },
        });

        const saldoCreditos = await getSaldoCreditos(userId);
        return res.json({ chatLiberado: true, custoCreditos: 0, saldoCreditos });
    }

    if (saldo < CHAT_UNLOCK_CREDITS) {
        return res.status(402).json({
            code: "CHAT_LOCKED",
            chatLiberado: false,
            erro: "Saldo insuficiente",
            custoCreditos: CHAT_UNLOCK_CREDITS,
            saldoCreditos: saldo,
        });
    }

    await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
            where: { userId },
            data: { saldoCreditos: { decrement: CHAT_UNLOCK_CREDITS } },
        });

        await tx.walletTx.create({
            data: { userId, tipo: "DEBIT", origem: "CHAT_UNLOCK", valor: CHAT_UNLOCK_CREDITS, refId: conversaId },
        });

        await tx.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "SISTEMA",
                texto: "🔓 Chat liberado com créditos.",
                textoOriginal: "🔓 Chat liberado com créditos.",
                idiomaOriginal: String(req.usuario?.idioma || "pt").toLowerCase(),
            },
        });
    });

    const novoSaldo = await getSaldoCreditos(userId);

    return res.json({
        chatLiberado: true,
        custoCreditos: CHAT_UNLOCK_CREDITS,
        saldoCreditos: novoSaldo,
    });
}
