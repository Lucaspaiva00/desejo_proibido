// src/controllers/mensagem.controller.js
import { prisma } from "../prisma.js";
import { isChatUnlocked, isPremiumEfetivo } from "../utils/wallet.js";

// ============================
// Anti-contato (WhatsApp/Instagram/Links/Email)
// ============================
function normalizeText(s = "") {
    return String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function hasPhoneLike(text) {
    const t = normalizeText(text);

    const digits = t.replace(/[^0-9]/g, "");
    if (digits.length >= 9 && digits.length <= 14) return true;

    const phonePattern =
        /(\+?\d{1,3}\s*)?(\(?\d{2,3}\)?\s*)?\d{4,5}[-\s]?\d{4}/;

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

    const bad =
        /(wa\.me|api\.whatsapp|whatsapp|wpp|zap|t\.me|telegram|discord\.gg|discord|facebook|fb\.com|x\.com|twitter|snapchat|tiktok|linktr\.ee)/;

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
// Controller
// ============================
export async function enviarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, texto } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!texto || !String(texto).trim())
            return res.status(400).json({ erro: "texto é obrigatório" });

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
            include: {
                match: { select: { usuarioAId: true, usuarioBId: true } },
            },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);

        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para enviar mensagens.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                texto: textoLimpo,
                textoOriginal: textoLimpo,
                idiomaOriginal,
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar mensagem", detalhe: e.message });
    }
}
