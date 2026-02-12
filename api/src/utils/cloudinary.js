// src/utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Monta URL pública com transformation opcional
 */
export function buildPublicUrl({ publicId, resourceType = "image", format = "", transformation = "" }) {
    const t = transformation ? `${transformation}/` : "";
    const fmt = format ? `.${format}` : "";
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${t}${publicId}${fmt}`;
}

/**
 * Upload buffer -> Cloudinary
 */
export function uploadBuffer({ buffer, folder = "dp", resourceType = "image", filename = "file" }) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
                public_id: undefined,
                use_filename: true,
                unique_filename: true,
                filename_override: filename,
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );

        stream.end(buffer);
    });
}

/**
 * Upload de foto + gera thumb blur via eager
 * Retorna:
 * - mediaPath: publicId.format
 * - thumbPath: publicId_thumb.jpg (gerado eager)
 */
export async function uploadPhotoWithThumb({ buffer, folder = "dp/photos", filename = "photo" }) {
    const r = await cloudinary.uploader.upload(`data:image/jpeg;base64,${buffer.toString("base64")}`, {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: filename,

        // gera thumb blur (eager)
        eager: [
            { width: 480, crop: "limit", effect: "blur:1200", quality: "auto", fetch_format: "jpg" },
        ],
        eager_async: false,
    });

    // r.public_id, r.format
    // eager[0].public_id nem sempre vem; vem URL.
    // Então: vamos usar a URL eager e extrair publicId do caminho:
    const eagerUrl = r.eager?.[0]?.secure_url || r.eager?.[0]?.url || null;

    let thumbPublicId = null;
    if (eagerUrl) {
        // .../upload/.../<thumbPublicId>.jpg
        const m = eagerUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.jpg/i);
        if (m && m[1]) thumbPublicId = m[1];
    }

    const mediaPath = `${r.public_id}.${r.format}`;
    const thumbPath = thumbPublicId ? `${thumbPublicId}.jpg` : "";

    return { mediaPath, thumbPath };
}

/**
 * Upload de áudio (resource_type: video no Cloudinary)
 * Retorna mediaPath: publicId.format
 */
export async function uploadAudio({ buffer, folder = "dp/audios", filename = "audio" }) {
    const r = await uploadBuffer({
        buffer,
        folder,
        resourceType: "video",
        filename,
    });

    const publicId = r.public_id;
    const format = r.format || "mp3";
    return { mediaPath: `${publicId}.${format}` };
}
