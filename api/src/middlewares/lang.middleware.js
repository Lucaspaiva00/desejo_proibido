// src/middlewares/lang.middleware.js
const SUPPORTED = new Set(["pt", "en", "es", "fr", "de", "it"]);

function normalizeLang(raw) {
    if (!raw) return null;
    const x = String(raw).toLowerCase().trim();
    if (!x) return null;

    const base = x.split(",")[0].split(";")[0].split("-")[0].trim();
    if (!base) return null;

    // se quiser restringir só aos suportados, troque a linha abaixo por:
    // return SUPPORTED.has(base) ? base : "pt";
    return SUPPORTED.has(base) ? base : base;
}

function parseAcceptLanguage(header) {
    if (!header) return null;
    const first = String(header).split(",")[0];
    return normalizeLang(first);
}

export function langMiddleware(req, _res, next) {
    const qLang = normalizeLang(req.query?.lang);
    const userLang = normalizeLang(req.usuario?.idioma);
    const headerLang = parseAcceptLanguage(req.headers["accept-language"]);

    req.lang = qLang || userLang || headerLang || "pt";
    next();
}
