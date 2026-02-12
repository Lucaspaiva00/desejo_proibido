// src/controllers/upload.controller.js
import path from "path";

/**
 * Monta URL pública pro arquivo servido por:
 * app.use("/uploads", express.static(...))
 *
 * Ex: https://desejoproibido.app/uploads/arquivo.jpg
 */
function publicUrl(req, filename) {
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
    const host = (req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
    return `${proto}://${host}/uploads/${filename}`;
}

function assertFile(req) {
    if (!req.file) {
        const err = new Error("Nenhum arquivo enviado (field deve ser 'file').");
        err.statusCode = 400;
        throw err;
    }
    return req.file;
}

export async function uploadFoto(req, res) {
    try {
        const file = assertFile(req);

        // valida tipo (opcional, mas ajuda)
        const ext = path.extname(file.filename).toLowerCase();
        const ok = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
        if (!ok) {
            return res.status(415).json({ erro: "Formato inválido. Envie imagem (jpg/png/webp/gif)." });
        }

        const url = publicUrl(req, file.filename);
        return res.json({
            ok: true,
            tipo: "foto",
            filename: file.filename,
            url,
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ erro: e.message || "Erro no upload de foto" });
    }
}

export async function uploadAudioFile(req, res) {
    try {
        const file = assertFile(req);

        // valida tipo (opcional)
        const ext = path.extname(file.filename).toLowerCase();
        const ok = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"].includes(ext);
        if (!ok) {
            return res.status(415).json({ erro: "Formato inválido. Envie áudio (mp3/wav/m4a/aac/ogg/webm)." });
        }

        const url = publicUrl(req, file.filename);
        return res.json({
            ok: true,
            tipo: "audio",
            filename: file.filename,
            url,
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ erro: e.message || "Erro no upload de áudio" });
    }
}
