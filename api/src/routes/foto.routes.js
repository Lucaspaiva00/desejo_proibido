import { Router } from "express";
import multer from "multer";
import path from "path";
import { auth } from "../middlewares/auth.middleware.js";
import { uploadFoto, listarMinhasFotos, definirPrincipal, removerFoto } from "../controllers/foto.controller.js";

const router = Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

router.get("/minhas", auth, listarMinhasFotos);
router.post("/upload", auth, upload.single("foto"), uploadFoto);
router.patch("/:id/principal", auth, definirPrincipal);
router.delete("/:id", auth, removerFoto);

export default router;
