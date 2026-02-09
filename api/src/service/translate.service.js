// src/services/translate.service.js
import { prisma } from "../prisma.js";

const PROVIDER = String(process.env.TRANSLATE_PROVIDER || "libretranslate").toLowerCase();
const LIBRE_URL = process.env.LIBRETRANSLATE_URL || "http://127.0.0.1:5001/translate";
const LIBRE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || "";

function canTranslate(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if (t.length <= 1) return false;
    return true;
}

async function translateLibre(text, from, to) {
    const payload = {
        q: text,
        source: from || "auto",
        target: to,
        format: "text",
    };
    if (LIBRE_API_KEY) payload.api_key = LIBRE_API_KEY;

    const r = await fetch(LIBRE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!r.ok) {
        const raw = await r.text().catch(() => "");
        throw new Error(`LibreTranslate erro: ${r.status} ${raw}`);
    }

    const data = await r.json();
    return data?.translatedText || text;
}

async function translateText(text, from, to) {
    if (!canTranslate(text)) return String(text || "");
    if (!to) return String(text || "");
    if (from && to && from === to) return String(text || "");

    if (PROVIDER === "libretranslate") {
        return translateLibre(text, from || "auto", to);
    }

    // fallback sem quebrar
    return String(text || "");
}

export async function getOrCreateTranslation({
    mensagemId,
    idiomaDestino,
    textoOriginal,
    idiomaOriginal,
}) {
    if (!mensagemId) return null;
    if (!idiomaDestino) return null;

    const to = String(idiomaDestino || "").toLowerCase().trim();
    const from = String(idiomaOriginal || "auto").toLowerCase().trim();
    const original = String(textoOriginal || "").trim();

    if (!original) return null;
    if (from === to) return original;

    const existing = await prisma.mensagemTraducao.findUnique({
        where: { mensagemId_idioma: { mensagemId, idioma: to } },
        select: { texto: true },
    });

    if (existing?.texto) return existing.texto;

    let translated = original;
    try {
        translated = await translateText(original, from, to);
    } catch {
        translated = original;
    }

    await prisma.mensagemTraducao.create({
        data: {
            mensagemId,
            idioma: to,
            texto: translated,
        },
    });

    return translated;
}
