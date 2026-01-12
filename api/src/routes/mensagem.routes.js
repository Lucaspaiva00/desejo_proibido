import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { listarMensagens, enviarMensagem } from "../controllers/mensagem.controller.js";

const router = Router();

router.get("/:conversaId", auth, listarMensagens);
router.post("/:conversaId", auth, enviarMensagem);

export default router;