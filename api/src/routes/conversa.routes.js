import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    listarConversas,
    mensagensDaConversa,
    abrirConversaPorMatch,
    statusConversa,
    liberarChat,
} from "../controllers/conversa.controller.js";

const router = Router();

router.use(auth);

router.get("/", listarConversas);
router.get("/minhas", listarConversas);

// abrir conversa via matchId
router.post("/abrir", abrirConversaPorMatch);

// ✅ PAYWALL CHAT (CRÉDITOS)
router.get("/:id/status", statusConversa);
router.post("/:id/liberar", liberarChat);

router.get("/:id/mensagens", mensagensDaConversa);

export default router;
