// src/utils/tokens.js
import crypto from "crypto";

export function gerarTokenRaw(bytes = 32) {
    return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(raw) {
    return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export function addMinutes(date, minutes) {
    return new Date(date.getTime() + Number(minutes) * 60 * 1000);
}

export function safeInt(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
