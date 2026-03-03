// src/controllers/conversa.controller.js
import { prisma } from "../prisma.js";
import { getOrCreateTranslation } from "../services/translate.service.js";
import { buildPublicUrl, buildThumbBlurUrl } from "../utils/cloudinary.js";

const CHAT_UNLOCK_CREDITS = Number(process.env.CHAT_UNLOCK_CREDITS || 10);

// ==============================
// Wallet helpers
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
    });
    return !!tx;
}

function assertParteDaConversa(conv, userId) {
    const match = conv?.match;
    if (!match) return false;
    return match.usuarioAId === userId || match.usuarioBId === userId;
}

function shouldTranslateMessage(m) {
    return (m?.tipo || "TEXTO") === "TEXTO";
}

function splitPath(p) {
    const s = String(p || "").trim();
    if (!s) return { publicId: null, format: null };
    const lastDot = s.lastIndexOf(".");
    if (lastDot <= 0) return { publicId: s, format: null };
    return { publicId: s.slice(0, lastDot), format: s.slice(lastDot + 1) };
}

// ==============================
// MAP MENSAGEM (CORREÇÃO REAL)
// ==============================
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

    let locked = !!m.bloqueada;
    const custoMoedas = m.custoMoedas ?? 10;

    // autor nunca paga
    if (String(m.autorId) === String(viewerId)) {
        locked = false;
    }

    // ================= FOTO =================
    if (tipo === "FOTO") {

        const { publicId, format } = splitPath(m.mediaPath);

        if (publicId) {
            // 🔥 SEMPRE gera thumb blur dinâmico
            thumbUrl = buildThumbBlurUrl({
                publicId,
                format: format || "jpg",
            });
        }

        const canSeeOriginal =
            !locked || (await alreadyUnlockedMedia(viewerId, m.id));

        if (canSeeOriginal && publicId) {
            mediaUrl = buildPublicUrl({
                publicId,
                resourceType: "image",
                format: format || "jpg",
            });
            locked = false;
        } else {
            locked = true;
        }
    }

    // ================= AUDIO =================
    if (tipo === "AUDIO") {

        const { publicId, format } = splitPath(m.mediaPath);

        const canHearOriginal =
            !locked || (await alreadyUnlockedMedia(viewerId, m.id));

        if (canHearOriginal && publicId) {
            audioUrl = buildPublicUrl({
                publicId,
                resourceType: "video",
                format: format || "mp3",
            });
            locked = false;
        } else {
            locked = true;
        }
    }

    return {
        ...m,
        texto: m.texto ?? original,
        textoOriginal: m.textoOriginal ?? original,
        idiomaOriginal,
        textoExibido,
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

    const conversaIds = conversas.map(c => c.id);
    if (!conversaIds.length) return res.json([]);

    const unlocks = await prisma.walletTx.findMany({
        where: {
            userId,
            origem: "CHAT_UNLOCK",
            tipo: "DEBIT",
            refId: { in: conversaIds },
        },
    });

    const liberadas = new Set(unlocks.map(u => u.refId));

    return res.json(conversas.map(c => ({
        id: c.id,
        atualizadoEm: c.atualizadoEm,
        chatLiberado: liberadas.has(c.id),
        outroUsuarioId: c.match.usuarioAId === userId
            ? c.match.usuarioBId
            : c.match.usuarioAId,
    })));
}

// ==============================
// MENSAGENS DA CONVERSA
// ==============================
export async function mensagensDaConversa(req, res) {

    const userId = req.usuario.id;
    const idiomaDestino = req.lang || req.usuario?.idioma || "pt";
    const { id } = req.params;

    const conv = await prisma.conversa.findUnique({
        where: { id },
        include: { match: true },
    });

    if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
    if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

    const mensagens = await prisma.mensagem.findMany({
        where: { conversaId: id },
        orderBy: { criadoEm: "asc" },
    });

    const mapped = [];
    for (const m of mensagens) {
        mapped.push(await mapMensagemParaUsuario(m, idiomaDestino, userId));
    }

    res.json({ mensagens: mapped });
}