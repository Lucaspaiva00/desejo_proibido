// src/utils/antiContato.js

function normalizeText(s = "") {
    return String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

// Detecta telefone/whatsapp mesmo com espaços, parênteses, hífen, etc.
function hasPhoneLike(text) {
    const t = normalizeText(text);

    // pega sequências com muitos dígitos, ignorando separadores comuns
    const digits = t.replace(/[^0-9]/g, "");
    if (digits.length >= 9 && digits.length <= 14) return true;

    // padrões comuns BR/INT (ex: (19) 99689-2382, +55 11 99999-9999)
    const phonePattern =
        /(\+?\d{1,3}\s*)?(\(?\d{2,3}\)?\s*)?\d{4,5}[-\s]?\d{4}/;

    return phonePattern.test(t);
}

function hasInstagram(text) {
    const t = normalizeText(text);

    if (t.includes("instagram.com")) return true;
    if (t.includes("insta") || t.includes("instagram") || t.includes("ig")) {
        // se citar insta + tiver @algo, considera tentativa
        if (/@[a-z0-9._]{3,}/.test(t)) return true;
    }

    // @usuario isolado — só bloqueia se tiver contexto de rede
    if (/@[a-z0-9._]{3,}/.test(t) && /(insta|instagram|ig|segue|follow|perfil)/.test(t)) {
        return true;
    }

    return false;
}

function hasOtherContact(text) {
    const t = normalizeText(text);

    // e-mail
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return true;

    // links / redes comuns
    const bad =
        /(wa\.me|api\.whatsapp|whatsapp|t\.me|telegram|discord\.gg|discord|facebook|fb\.com|x\.com|twitter|snapchat|tiktok|linktr\.ee)/;

    if (bad.test(t)) return true;

    // qualquer URL (opcional). Se quiser bloquear TODO link, descomenta:
    // if (/(https?:\/\/|www\.)\S+/i.test(t)) return true;

    return false;
}

export function containsContato(text) {
    if (!text) return false;
    return hasPhoneLike(text) || hasInstagram(text) || hasOtherContact(text);
}

export function contatoReason(text) {
    const t = normalizeText(text || "");
    if (hasPhoneLike(t)) return "telefone/whatsapp";
    if (hasInstagram(t)) return "instagram";
    if (hasOtherContact(t)) return "contato/link/email";
    return "contato";
}
