import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    listarConversas,
    mensagensDaConversa,
    abrirConversaPorMatch,
} from "../controllers/conversa.controller.js";

const router = Router();

router.use(auth);

router.get("/", listarConversas);

// ✅ alias compatível (se algum front chamar)
router.get("/minhas", listarConversas);

// ✅ abrir conversa via matchId
router.post("/abrir", abrirConversaPorMatch);

router.get("/:id/mensagens", mensagensDaConversa);

export default router;
