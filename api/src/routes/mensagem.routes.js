import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { enviarMensagem } from "../controllers/mensagem.controller.js";

const router = Router();

// /mensagens
router.use(auth);

// POST /mensagens
router.post("/", enviarMensagem);

export default router;
