// src/routes/mensagem.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    enviarMensagem,
    enviarFoto,
    enviarAudio,
    desbloquearMidia,
    obterMidia,
    encaminharMidia,
    apagarMensagem,
    editarMensagem,
} from "../controllers/mensagem.controller.js";
import { traduzirMensagem } from "../controllers/mensagem.translate.controller.js";

const router = Router();
router.use(auth);

// texto
router.post("/", enviarMensagem);

// mídia
router.post("/foto", enviarFoto);
router.post("/audio", enviarAudio);

// encaminhar mídia
router.post("/encaminhar", encaminharMidia);

// apagar mensagem
router.delete("/:id", apagarMensagem);

// tradução
router.get("/:id/traduzir", traduzirMensagem);

// paywall mídia
router.post("/:id/desbloquear", desbloquearMidia);
router.get("/:id/midia", obterMidia);

router.put("/:id", editarMensagem);

export default router;