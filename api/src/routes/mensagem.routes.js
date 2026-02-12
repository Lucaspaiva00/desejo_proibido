// src/routes/mensagem.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    enviarMensagem,
    enviarFoto,
    enviarAudio,
    desbloquearMidia,
    obterMidia,
} from "../controllers/mensagem.controller.js";

const router = Router();
router.use(auth);

// texto
router.post("/", enviarMensagem);

// mídia
router.post("/foto", enviarFoto);
router.post("/audio", enviarAudio);

// paywall mídia
router.post("/:id/desbloquear", desbloquearMidia);
router.get("/:id/midia", obterMidia);

export default router;
