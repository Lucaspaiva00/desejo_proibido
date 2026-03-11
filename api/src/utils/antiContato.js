// src/utils/antiContato.js

function normalizeText(s = "") {
    return String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function compactText(s = "") {
    return normalizeText(s).replace(/\s+/g, "");
}

function hasPhoneLike(text) {
    const t = normalizeText(text);
    const digits = t.replace(/\D/g, "");

    // quantidade comum de telefone BR / internacional curto
    if (digits.length >= 9 && digits.length <= 14) return true;

    // formatos comuns
    const phonePattern =
        /(\+?\d{1,3}[\s.-]*)?(\(?\d{2,3}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/;

    return phonePattern.test(t);
}

function hasEmail(text) {
    const t = normalizeText(text);
    return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t);
}

function hasUrl(text) {
    const t = normalizeText(text);
    return /(https?:\/\/|www\.|[a-z0-9-]+\.(com|com\.br|net|org|io|me|gg|app|dev)\b)/i.test(t);
}

function hasWhatsapp(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    return (
        /(whatsapp|whats|wpp|zap|chama no zap|me chama no zap|fala no zap)/.test(t) ||
        /(wa\.me|api\.whatsapp)/.test(t) ||
        /(whats|wpp|zap)/.test(c)
    );
}

function hasInstagram(text) {
    const t = normalizeText(text);

    if (t.includes("instagram.com")) return true;

    const hasAtUser = /@[a-z0-9._]{3,}/.test(t);
    const hasContext = /(insta|instagram|ig|arroba|perfil|segue|follow|me segue|me chama no insta|me chama no ig)/.test(t);

    if (hasAtUser && hasContext) return true;

    // casos sem @
    if (/(meu insta|meu instagram|meu ig|arroba|insta e|instagram e|ig e)/.test(t)) return true;

    return false;
}

function hasTelegram(text) {
    const t = normalizeText(text);
    return /(telegram|t\.me)/.test(t);
}

function hasDiscord(text) {
    const t = normalizeText(text);
    return /(discord|discord\.gg)/.test(t);
}

function hasOtherSocial(text) {
    const t = normalizeText(text);

    return /(facebook|fb\.com|messenger|x\.com|twitter|snapchat|tiktok|linktr\.ee)/.test(t);
}

function hasSuspiciousUsername(text) {
    const t = normalizeText(text);

    // username dito em contexto suspeito, mesmo sem @
    return /(me chama|fala comigo|me adiciona|me procura|me segue|me manda mensagem).{0,25}([a-z0-9._]{4,})/.test(t);
}

export function containsContato(text) {
    if (!text) return false;

    return (
        hasPhoneLike(text) ||
        hasEmail(text) ||
        hasUrl(text) ||
        hasWhatsapp(text) ||
        hasInstagram(text) ||
        hasTelegram(text) ||
        hasDiscord(text) ||
        hasOtherSocial(text) ||
        hasSuspiciousUsername(text)
    );
}

export function contatoReason(text) {
    if (hasPhoneLike(text)) return "telefone/whatsapp";
    if (hasEmail(text)) return "email";
    if (hasWhatsapp(text)) return "whatsapp";
    if (hasInstagram(text)) return "instagram";
    if (hasTelegram(text)) return "telegram";
    if (hasDiscord(text)) return "discord";
    if (hasUrl(text)) return "link";
    if (hasOtherSocial(text)) return "rede social";
    if (hasSuspiciousUsername(text)) return "username/contato";
    return "contato";
}