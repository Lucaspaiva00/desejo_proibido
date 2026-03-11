// src/utils/antiContato.js

const HARD_BLOCK_KEYWORDS = [
    "whatsapp", "whats", "wpp", "zap", "zapp",
    "instagram", "insta", "ig",
    "telegram", "discord",
    "facebook", "messenger",
    "twitter", "x.com", "snapchat", "tiktok", "kwai",
    "linkedin", "youtube", "gmail", "hotmail", "outlook", "icloud", "yahoo",
    "email", "e-mail", "arroba", "perfil", "usuario", "user", "contato",
    "telefone", "celular", "numero", "site", "link", "canal", "privado"
];

const SOCIAL_DOMAINS = [
    "instagram.com", "wa.me", "api.whatsapp", "t.me", "telegram.me",
    "discord.gg", "facebook.com", "fb.com", "x.com", "twitter.com",
    "snapchat.com", "tiktok.com", "linktr.ee", "youtube.com", "youtu.be"
];

const EMAIL_HINTS = [
    "gmail", "hotmail", "outlook", "icloud", "yahoo", "proton", "live"
];

const CONTACT_PHRASES = [
    "me chama", "me chama la", "me chama lá", "me chama depois",
    "me procura", "me adiciona", "me segue", "fala comigo",
    "fala comigo la", "fala comigo lá",
    "me manda mensagem", "me manda msg",
    "anota ai", "anota aí", "salva ai", "salva aí",
    "passo meu", "te passo", "te mando", "meu contato",
    "meu numero", "meu número", "meu telefone", "meu celular",
    "chama no zap", "fala no zap", "me chama no zap",
    "me chama no whats", "me chama no whatsapp",
    "me chama no insta", "me chama no instagram", "me chama no ig"
];

function normalizeText(s = "") {
    return String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function compactText(s = "") {
    return normalizeText(s)
        .replace(/\s+/g, "")
        .replace(/[@]/g, "a")
        .replace(/[|!]/g, "i")
        .replace(/[$]/g, "s")
        .replace(/[0]/g, "o")
        .replace(/[1]/g, "i")
        .replace(/[2]/g, "z")
        .replace(/[3]/g, "e")
        .replace(/[4]/g, "a")
        .replace(/[5]/g, "s")
        .replace(/[6]/g, "g")
        .replace(/[7]/g, "t")
        .replace(/[8]/g, "b")
        .replace(/[9]/g, "g");
}

function stripToAlphaNum(s = "") {
    return compactText(s).replace(/[^a-z0-9]/g, "");
}

function digitsOnly(s = "") {
    return String(s).replace(/\D/g, "");
}

function tokenize(text = "") {
    return normalizeText(text)
        .split(/[\s,;:(){}\[\]<>/"'\\|]+/)
        .map((x) => x.trim())
        .filter(Boolean);
}

function containsAny(text, arr) {
    const t = normalizeText(text);
    return arr.some((item) => t.includes(normalizeText(item)));
}

function compactContainsAny(text, arr) {
    const c = compactText(text);
    return arr.some((item) => c.includes(compactText(item)));
}

function hasPhoneLike(text) {
    const t = normalizeText(text);
    const d = digitsOnly(text);

    if (d.length >= 8) return true;

    const patterns = [
        /(\+?\d{1,3}[\s().-]*)?(\(?\d{2,3}\)?[\s().-]*)?\d{4,5}[\s().-]*\d{4}/,
        /\b\d{8,14}\b/,
    ];

    return patterns.some((rx) => rx.test(t));
}

function hasTooManyDigits(text) {
    const d = digitsOnly(text);
    return d.length >= 6;
}

function hasEmail(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return true;
    if (EMAIL_HINTS.some((x) => c.includes(x))) return true;

    return false;
}

function hasUrl(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    if (/(https?:\/\/|www\.)\S+/i.test(t)) return true;
    if (/\b[a-z0-9-]+\.(com|com\.br|net|org|io|gg|me|app|dev|site|online|store|link)\b/i.test(t)) return true;
    if (/\b[a-z0-9-]+\.(com|combr|net|org|io|gg|me|app|dev|site|online|store|link)\b/i.test(c)) return true;
    if (SOCIAL_DOMAINS.some((x) => c.includes(compactText(x)))) return true;

    return false;
}

function hasWhatsapp(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    return (
        /(whatsapp|whats|wpp|zap|zapp)/.test(t) ||
        /(whatsapp|whats|wpp|zap|zapp)/.test(c) ||
        /(wa\.me|api\.whatsapp)/.test(t)
    );
}

function hasInstagram(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    return (
        /(instagram|insta|ig|arroba)/.test(t) ||
        /(instagram|insta|arroba)/.test(c) ||
        /instagram\.com/.test(t)
    );
}

function hasTelegram(text) {
    const t = normalizeText(text);
    const c = compactText(text);
    return /(telegram|t\.me)/.test(t) || /telegram/.test(c);
}

function hasDiscord(text) {
    const t = normalizeText(text);
    const c = compactText(text);
    return /(discord|discord\.gg)/.test(t) || /discord/.test(c);
}

function hasOtherSocial(text) {
    const t = normalizeText(text);
    const c = compactText(text);

    return (
        /(facebook|fb\.com|messenger|twitter|x\.com|snapchat|tiktok|kwai|linkedin|youtube|linktr\.ee|onlyfans|privacy)/.test(t) ||
        /(facebook|messenger|twitter|snapchat|tiktok|kwai|linkedin|youtube|linktree|onlyfans|privacy)/.test(c)
    );
}

function hasAtUsername(text) {
    const t = normalizeText(text);
    return /@[a-z0-9._-]{2,}/.test(t);
}

function hasBareUsername(text) {
    const tokens = tokenize(text);

    return tokens.some((tk) => {
        if (tk.length < 4) return false;
        if (/^\d+$/.test(tk)) return false;
        if (/^[a-z0-9._-]+$/.test(tk) && /[._-]/.test(tk)) return true;
        return false;
    });
}

function hasSuspiciousUserPattern(text) {
    const t = normalizeText(text);

    const patterns = [
        /(arroba|user|usuario|perfil|contato)[\s:=-]*[a-z0-9._-]{3,}/,
        /(me chama|me procura|me adiciona|me segue|me manda mensagem).{0,30}[a-z0-9._-]{3,}/,
        /(meu insta|meu instagram|meu ig|meu whatsapp|meu whats|meu zap|meu telegram|meu discord|meu email).{0,30}[a-z0-9._@.-]{3,}/,
    ];

    return patterns.some((rx) => rx.test(t));
}

function hasMaskedContact(text) {
    const c = compactText(text);
    const a = stripToAlphaNum(text);

    const suspiciousMasks = [
        "meuchamanozap",
        "meuchamanowhats",
        "meuchamanoinsta",
        "meuchamanonoig",
        "meuinsta",
        "meuinstagram",
        "meuig",
        "meuwhats",
        "meuwhatsapp",
        "meuzap",
        "meutelegram",
        "meudiscord",
        "meuemail",
        "meucontato",
        "meunumero",
        "meutelefone",
        "meucelular",
        "arroba",
        "instagram",
        "whatsapp",
        "telegram",
        "discord",
    ];

    return suspiciousMasks.some((item) => c.includes(item) || a.includes(item));
}

function hasForbiddenPhrase(text) {
    return containsAny(text, CONTACT_PHRASES) || compactContainsAny(text, CONTACT_PHRASES);
}

function hasKeywordBurst(text) {
    const t = normalizeText(text);
    let count = 0;

    for (const kw of HARD_BLOCK_KEYWORDS) {
        if (t.includes(normalizeText(kw))) count++;
        if (count >= 2) return true;
    }

    return false;
}

function looksLikeContactOnly(text) {
    const t = normalizeText(text);

    return (
        /^\s*@[a-z0-9._-]{2,}\s*$/.test(t) ||
        /^\s*[a-z0-9._-]{5,}\s*$/.test(t) ||
        /^\s*\+?\d[\d\s().-]{6,}\s*$/.test(t)
    );
}

function scoreSuspicion(text) {
    let score = 0;

    if (hasPhoneLike(text)) score += 10;
    if (hasTooManyDigits(text)) score += 4;
    if (hasEmail(text)) score += 10;
    if (hasUrl(text)) score += 10;
    if (hasWhatsapp(text)) score += 10;
    if (hasInstagram(text)) score += 10;
    if (hasTelegram(text)) score += 9;
    if (hasDiscord(text)) score += 9;
    if (hasOtherSocial(text)) score += 8;
    if (hasAtUsername(text)) score += 9;
    if (hasBareUsername(text)) score += 5;
    if (hasSuspiciousUserPattern(text)) score += 10;
    if (hasMaskedContact(text)) score += 10;
    if (hasForbiddenPhrase(text)) score += 10;
    if (hasKeywordBurst(text)) score += 6;
    if (looksLikeContactOnly(text)) score += 10;

    return score;
}

export function containsContato(text) {
    if (!text) return false;

    if (scoreSuspicion(text) >= 8) return true;

    return false;
}

export function contatoReason(text) {
    if (hasPhoneLike(text)) return "telefone";
    if (hasTooManyDigits(text)) return "numeros suspeitos";
    if (hasEmail(text)) return "email";
    if (hasUrl(text)) return "link";
    if (hasWhatsapp(text)) return "whatsapp";
    if (hasInstagram(text)) return "instagram";
    if (hasTelegram(text)) return "telegram";
    if (hasDiscord(text)) return "discord";
    if (hasOtherSocial(text)) return "rede social";
    if (hasAtUsername(text)) return "arroba";
    if (hasBareUsername(text)) return "username";
    if (hasSuspiciousUserPattern(text)) return "padrao suspeito";
    if (hasMaskedContact(text)) return "contato mascarado";
    if (hasForbiddenPhrase(text)) return "frase de contato";
    if (hasKeywordBurst(text)) return "multiplos termos suspeitos";
    if (looksLikeContactOnly(text)) return "contato direto";
    return "contato";
}