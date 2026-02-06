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

router.post("/abrir", abrirConversaPorMatch);

router.get("/:id/status", statusConversa);
router.post("/:id/liberar", liberarChat);

// compat (front antigo)
router.get("/:id", statusConversa);
router.post("/:id", liberarChat);

router.get("/:id/mensagens", mensagensDaConversa);

export default router;
