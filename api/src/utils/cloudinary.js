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
export function buildPublicUrl({
    publicId,
    resourceType = "image",
    format = "",
    transformation = ""
}) {
    const t = transformation ? `${transformation}/` : "";
    const fmt = format ? `.${format}` : "";

    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${t}${publicId}${fmt}`;
}

/**
 * Thumb borrado dinâmico (preview)
 */
export function buildThumbBlurUrl({ publicId, format = "jpg" }) {
    return buildPublicUrl({
        publicId,
        resourceType: "image",
        format,
        transformation: "w_520,q_60,e_blur:2000"
    });
}

/**
 * Upload buffer -> Cloudinary
 */
export function uploadBuffer({
    buffer,
    folder = "dp",
    resourceType = "image",
    filename = "file"
}) {
    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
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
 * Upload de foto + geração de thumb blur
 */
export async function uploadPhotoWithThumb({
    buffer,
    folder = "dp/photos",
    filename = "photo"
}) {

    const r = await uploadBuffer({
        buffer,
        folder,
        resourceType: "image",
        filename
    });

    const publicId = r.public_id;
    const format = r.format || "jpg";

    return {
        mediaPath: `${publicId}.${format}`,
        thumbPath: `${publicId}.${format}`
    };
}

/**
 * Upload de áudio
 */
export async function uploadAudio({
    buffer,
    folder = "dp/audios",
    filename = "audio"
}) {

    const r = await uploadBuffer({
        buffer,
        folder,
        resourceType: "video", // Cloudinary trata áudio como video
        filename: `${Date.now()}`
    });

    const publicId = r.public_id;

    return {
        mediaPath: publicId + "." + (r.format || "webm")
    };
}