// src/controllers/mensagem.controller.js
import { prisma } from "../prisma.js";
import { isChatUnlocked, isPremiumEfetivo, debitWallet, ensureWallet, getSaldoCreditos } from "../utils/wallet.js";
import { buildPublicUrl } from "../utils/cloudinary.js";

// ============================
// Config
// ============================
const DEFAULT_FOTO_UNLOCK_COST = Number(process.env.FOTO_UNLOCK_COST || 5);   // ✅ padrão 5
const DEFAULT_AUDIO_UNLOCK_COST = Number(process.env.AUDIO_UNLOCK_COST || 0);

// ✅ custo por mensagem TEXTO (o que você pediu)
const MSG_SEND_COST = Number(process.env.MSG_SEND_COST || 5);

// ============================
// Helpers locais
// ============================
async function alreadyUnlockedMedia(userId, mensagemId) {
    const tx = await prisma.walletTx.findFirst({
        where: { userId, origem: "MIDIA_UNLOCK", tipo: "DEBIT", refId: String(mensagemId) },
        select: { id: true },
    });
    return !!tx;
}

async function debitForMediaUnlockTx({ userId, mensagemId, valor }) {
    await ensureWallet(userId);

    return prisma.$transaction(async (tx) => {
        const w = await tx.wallet.findUnique({ where: { userId } });
        const saldo = w?.saldoCreditos ?? 0;

        if (saldo < valor) {
            const err = new Error("Saldo insuficiente");
            err.status = 402;
            err.code = "SALDO_INSUFICIENTE";
            throw err;
        }

        await tx.wallet.update({
            where: { userId },
            data: { saldoCreditos: { decrement: valor } },
        });

        await tx.walletTx.create({
            data: { userId, tipo: "DEBIT", origem: "MIDIA_UNLOCK", valor, refId: String(mensagemId) },
        });

        const w2 = await tx.wallet.findUnique({ where: { userId } });
        return { saldoCreditos: w2?.saldoCreditos ?? 0 };
    });
}

function assertParteDaConversa(conv, userId) {
    const match = conv?.match;
    if (!match) return false;
    return match.usuarioAId === userId || match.usuarioBId === userId;
}

function splitPath(p) {
    const s = String(p || "").trim();
    if (!s) return { publicId: null, format: null };
    const lastDot = s.lastIndexOf(".");
    if (lastDot <= 0) return { publicId: s, format: null };
    return { publicId: s.slice(0, lastDot), format: s.slice(lastDot + 1) };
}

// ============================
// Anti-contato (só TEXTO)
// ============================
function normalizeText(s = "") {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function hasPhoneLike(text) {
    const t = normalizeText(text);
    const digits = t.replace(/[^0-9]/g, "");
    if (digits.length >= 9 && digits.length <= 14) return true;
    const phonePattern = /(\+?\d{1,3}\s*)?(\(?\d{2,3}\)?\s*)?\d{4,5}[-\s]?\d{4}/;
    return phonePattern.test(t);
}
function hasInstagram(text) {
    const t = normalizeText(text);
    if (t.includes("instagram.com")) return true;
    const hasAtUser = /@[a-z0-9._]{3,}/.test(t);
    const hasContext = /(insta|instagram|ig|segue|follow|perfil|arroba)/.test(t);
    if (hasAtUser && hasContext) return true;
    if (/(me chama|chama no|passo|te mando|te passo).*(insta|instagram|ig)/.test(t)) return true;
    return false;
}
function hasOtherContact(text) {
    const t = normalizeText(text);
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return true;
    const bad = /(wa\.me|api\.whatsapp|whatsapp|wpp|zap|t\.me|telegram|discord\.gg|discord|facebook|fb\.com|x\.com|twitter|snapchat|tiktok|linktr\.ee)/;
    if (bad.test(t)) return true;
    if (/(https?:\/\/|www\.)\S+/i.test(t)) return true;
    return false;
}
function containsContato(text) {
    if (!text) return false;
    return hasPhoneLike(text) || hasInstagram(text) || hasOtherContact(text);
}
function contatoReason(text) {
    const t = normalizeText(text || "");
    if (hasPhoneLike(t)) return "telefone/whatsapp";
    if (hasInstagram(t)) return "instagram";
    if (hasOtherContact(t)) return "contato/link/email";
    return "contato";
}

// ============================
// TEXT: POST /mensagens
// ============================
export async function enviarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, texto } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!texto || !String(texto).trim()) return res.status(400).json({ erro: "texto é obrigatório" });

        const textoLimpo = String(texto).trim();

        if (containsContato(textoLimpo)) {
            return res.status(400).json({
                erro: "Não é permitido enviar dados de contato (WhatsApp, Instagram, links ou e-mail).",
                code: "CONTATO_BLOQUEADO",
                motivo: contatoReason(textoLimpo),
            });
        }

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);

        // se não é premium efetivo, precisa estar com chat liberado
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para enviar mensagens.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        // ✅ COBRANÇA POR MENSAGEM TEXTO (5 créditos)
        // - se custo 0, não debita
        // - se não tem saldo, retorna 402
        if (MSG_SEND_COST > 0) {
            try {
                await debitWallet(userId, MSG_SEND_COST, { origem: "MSG_SEND", refId: conversaId });
            } catch (e) {
                const st = e?.status || e?.statusCode;
                if (st === 402 || e?.code === "SALDO_INSUFICIENTE") {
                    const saldo = await getSaldoCreditos(userId);
                    return res.status(402).json({
                        code: "SALDO_INSUFICIENTE",
                        erro: "Saldo insuficiente para enviar mensagem.",
                        custo: MSG_SEND_COST,
                        saldoCreditos: saldo,
                    });
                }
                throw e;
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "TEXTO",
                texto: textoLimpo,
                textoOriginal: textoLimpo,
                idiomaOriginal,
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        const saldoCreditos = await getSaldoCreditos(userId);
        return res.status(201).json({ ...msg, saldoCreditos, msgCost: MSG_SEND_COST });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar mensagem", detalhe: e.message });
    }
}

// ============================
// FOTO: POST /mensagens/foto
// body: { conversaId, mediaPath, thumbPath?, custoMoedas? }
// ============================
export async function enviarFoto(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, mediaPath, thumbPath, custoMoedas } = req.body || {};

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!mediaPath) return res.status(400).json({ erro: "mediaPath é obrigatório (Cloudinary publicId.format)" });

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({ erro: "Chat bloqueado. Libere o chat com créditos para enviar.", code: "CHAT_LOCKED" });
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();
        const custo = Number.isFinite(Number(custoMoedas)) ? Number(custoMoedas) : DEFAULT_FOTO_UNLOCK_COST;

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "FOTO",
                texto: "📷 Foto",
                textoOriginal: "📷 Foto",
                idiomaOriginal,

                // ✅ Cloudinary vindo do FRONT: publicId.format
                mediaPath: String(mediaPath),
                // ✅ se não mandar thumbPath, usa o próprio mediaPath
                thumbPath: String(thumbPath || mediaPath),

                bloqueada: true,
                custoMoedas: custo > 0 ? custo : 0,

                metaJson: { kind: "photo", locked: true },
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar foto", detalhe: e.message });
    }
}

// ============================
// AUDIO: POST /mensagens/audio
// body: { conversaId, mediaPath, duracao? }
// ============================
export async function enviarAudio(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, mediaPath, duracao } = req.body || {};

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!mediaPath) return res.status(400).json({ erro: "mediaPath é obrigatório (Cloudinary publicId.format)" });

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({ erro: "Chat bloqueado. Libere o chat com créditos para enviar.", code: "CHAT_LOCKED" });
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "AUDIO",
                texto: "🎙️ Áudio",
                textoOriginal: "🎙️ Áudio",
                idiomaOriginal,

                // ✅ Cloudinary vindo do FRONT: publicId.format (resource_type video)
                mediaPath: String(mediaPath),
                mediaDuracao: Number.isFinite(Number(duracao)) ? Number(duracao) : null,

                bloqueada: false,
                custoMoedas: DEFAULT_AUDIO_UNLOCK_COST > 0 ? DEFAULT_AUDIO_UNLOCK_COST : 0,
                metaJson: { kind: "audio" },
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar áudio", detalhe: e.message });
    }
}

// ============================
// DESBLOQUEAR: POST /mensagens/:id/desbloquear
// ============================
export async function desbloquearMidia(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: mensagemId } = req.params;

        const m = await prisma.mensagem.findUnique({
            where: { id: String(mensagemId) },
            select: {
                id: true,
                conversaId: true,
                tipo: true,
                autorId: true,
                bloqueada: true,
                custoMoedas: true,
            },
        });

        if (!m) return res.status(404).json({ erro: "Mensagem não encontrada" });
        if (m.tipo !== "FOTO" && m.tipo !== "AUDIO") return res.status(400).json({ erro: "Mensagem não é mídia" });

        // autor não paga pela própria mídia
        if (String(m.autorId) === String(userId)) {
            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: true, saldoCreditos: saldo });
        }

        const conv = await prisma.conversa.findUnique({
            where: { id: m.conversaId },
            include: { match: true },
        });
        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
        if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(m.conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para desbloquear mídia.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        const ja = await alreadyUnlockedMedia(userId, m.id);
        if (ja) {
            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: true, saldoCreditos: saldo });
        }

        const custo = Number(m.custoMoedas || 0);
        if (custo <= 0) {
            await prisma.walletTx.create({
                data: { userId, tipo: "DEBIT", origem: "MIDIA_UNLOCK", valor: 0, refId: String(m.id) },
            });

            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: false, saldoCreditos: saldo });
        }

        const r = await debitForMediaUnlockTx({ userId, mensagemId: m.id, valor: custo });

        return res.json({ ok: true, jaLiberado: false, saldoCreditos: r.saldoCreditos });
    } catch (e) {
        const status = e?.status || 500;
        if (status === 402) {
            return res.status(402).json({ code: e?.code || "SALDO_INSUFICIENTE", erro: e.message || "Saldo insuficiente" });
        }
        return res.status(500).json({ erro: "Erro ao desbloquear mídia", detalhe: e.message });
    }
}

// ============================
// OBTER MÍDIA: GET /mensagens/:id/midia
// ============================
export async function obterMidia(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: mensagemId } = req.params;

        const m = await prisma.mensagem.findUnique({
            where: { id: String(mensagemId) },
            select: {
                id: true,
                conversaId: true,
                tipo: true,
                autorId: true,
                mediaPath: true,
                thumbPath: true,
                bloqueada: true,
                custoMoedas: true,
                mediaDuracao: true,
            },
        });

        if (!m) return res.status(404).json({ erro: "Mensagem não encontrada" });

        const conv = await prisma.conversa.findUnique({
            where: { id: m.conversaId },
            include: { match: true },
        });
        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
        if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

        // FOTO
        if (m.tipo === "FOTO") {
            const isAutor = String(m.autorId) === String(userId);
            const unlocked = isAutor ? true : await alreadyUnlockedMedia(userId, m.id);

            const { publicId: tId, format: tFmt } = splitPath(m.thumbPath);
            const thumbUrl = tId
                ? buildPublicUrl({
                    publicId: tId,
                    resourceType: "image",
                    format: tFmt || "jpg",
                    // ✅ se quiser blur real: coloque isso no seu buildPublicUrl ou passe transformation aqui
                })
                : null;

            if (!unlocked) {
                return res.json({
                    tipo: "FOTO",
                    locked: true,
                    custoMoedas: Number(m.custoMoedas || 0),
                    thumbUrl,
                });
            }

            const { publicId, format } = splitPath(m.mediaPath);
            const url = publicId ? buildPublicUrl({ publicId, resourceType: "image", format: format || "jpg" }) : null;

            return res.json({ tipo: "FOTO", locked: false, url, thumbUrl });
        }

        // AUDIO
        if (m.tipo === "AUDIO") {
            const { publicId, format } = splitPath(m.mediaPath);
            const audioUrl = publicId
                ? buildPublicUrl({ publicId, resourceType: "video", format: format || "mp3" })
                : null;

            return res.json({ tipo: "AUDIO", locked: false, audioUrl, duracao: m.mediaDuracao ?? null });
        }

        return res.status(400).json({ erro: "Mensagem não é mídia" });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao obter mídia", detalhe: e.message });
    }
}