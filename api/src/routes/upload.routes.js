// src/routes/upload.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import multer from "multer";
import { uploadFoto, uploadAudioFile } from "../controllers/upload.controller.js";

const router = Router();
router.use(auth);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

router.post("/foto", upload.single("file"), uploadFoto);
router.post("/audio", upload.single("file"), uploadAudioFile);

export default router;
