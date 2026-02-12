// src/controllers/upload.controller.js
import { uploadPhotoWithThumb, uploadAudio } from "../utils/cloudinary.js";

/**
 * POST /uploads/foto  (multipart/form-data file=...)
 * retorna { mediaPath, thumbPath }
 */
export async function uploadFoto(req, res) {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ erro: "Envie um arquivo (file)" });

        const { mediaPath, thumbPath } = await uploadPhotoWithThumb({
            buffer: file.buffer,
            filename: file.originalname || "photo",
        });

        return res.json({ mediaPath, thumbPath });
    } catch (e) {
        return res.status(500).json({ erro: "Erro upload foto", detalhe: e.message });
    }
}

/**
 * POST /uploads/audio (multipart/form-data file=...)
 * retorna { mediaPath }
 */
export async function uploadAudioFile(req, res) {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ erro: "Envie um arquivo (file)" });

        const { mediaPath } = await uploadAudio({
            buffer: file.buffer,
            filename: file.originalname || "audio",
        });

        return res.json({ mediaPath });
    } catch (e) {
        return res.status(500).json({ erro: "Erro upload áudio", detalhe: e.message });
    }
}
