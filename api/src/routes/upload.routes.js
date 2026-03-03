// src/routes/upload.routes.js
import { Router } from "express";
import multer from "multer";
import { auth } from "../middlewares/auth.middleware.js";
import { uploadFoto, uploadAudioFile } from "../controllers/upload.controller.js";

const router = Router();

// multer salva temporário em /tmp (servidor Linux)
const upload = multer({
    dest: "/tmp",
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
});

router.use(auth);

// rotas
router.post("/foto", upload.single("file"), uploadFoto);
router.post("/audio", upload.single("file"), uploadAudioFile);

export default router;