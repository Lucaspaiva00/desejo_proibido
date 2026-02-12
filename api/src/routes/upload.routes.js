// src/routes/upload.routes.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { uploadFoto, uploadAudioFile } from "../controllers/upload.controller.js";

const router = Router();

// garante pasta uploads
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase() || "";
        const safeExt = ext.slice(0, 10);
        const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB (MULTER) — nginx também tem que permitir
    },
});

// rotas
router.post("/foto", upload.single("file"), uploadFoto);
router.post("/audio", upload.single("file"), uploadAudioFile);

export default router;
