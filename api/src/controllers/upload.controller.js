// src/controllers/upload.controller.js
import path from "path";
import fs from "fs/promises";
import { uploadPhotoWithThumb, uploadAudio } from "../utils/cloudinary.js";

function assertFile(req) {
    if (!req.file) {
        const err = new Error("Nenhum arquivo enviado (field deve ser 'file').");
        err.statusCode = 400;
        throw err;
    }
    return req.file;
}

export async function uploadFoto(req, res) {
    let file;
    try {
        file = assertFile(req);

        const ext = path.extname(file.originalname || "").toLowerCase();
        const ok = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
        if (!ok) return res.status(415).json({ erro: "Formato inválido. Envie imagem (jpg/png/webp/gif)." });

        const buffer = await fs.readFile(file.path);

        const { mediaPath, thumbPath } = await uploadPhotoWithThumb({
            buffer,
            folder: "desejoproibido/chat/photos",
            filename: file.originalname || "photo",
        });

        return res.json({
            ok: true,
            tipo: "foto",
            mediaPath,
            thumbPath: thumbPath || mediaPath, // fallback
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ erro: e.message || "Erro no upload de foto" });
    } finally {
        // limpa arquivo local salvo pelo multer
        try {
            if (file?.path) await fs.unlink(file.path);
        } catch { }
    }
}

export async function uploadAudioFile(req, res) {
    let file;
    try {
        file = assertFile(req);

        const mt = String(file.mimetype || "").toLowerCase();
        const ok =
            mt.startsWith("audio/") ||
            mt === "video/webm" ||
            mt === "application/octet-stream";

        if (!ok) {
            return res.status(415).json({ erro: `Formato inválido: ${file.mimetype}` });
        }

        const buffer = await fs.readFile(file.path);

        const { mediaPath } = await uploadAudio({
            buffer,
            folder: "desejoproibido/chat/audios",
            filename: Date.now(),
        });

        return res.json({ ok: true, tipo: "audio", mediaPath });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ erro: e.message || "Erro no upload de áudio" });
    } finally {
        try { if (file?.path) await fs.unlink(file.path); } catch { }
    }
}