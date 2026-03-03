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
 * ✅ Thumb borrado (SEM gerar arquivo físico)
 * Usa transformação na própria URL
 */
export function buildThumbBlurUrl({ publicId, format = "jpg" }) {
    return buildPublicUrl({
        publicId,
        resourceType: "image",
        format,
        transformation: "w_520,q_60,e_blur:2000",
    });
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
 * Upload de áudio
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