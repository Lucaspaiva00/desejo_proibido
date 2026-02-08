// src/routes/ligacaoVideo.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    iniciarChamadaPorConversa,
    aceitarChamada,
    recusarChamada,
    finalizarChamada,
    statusChamada,
} from "../controllers/ligacaoVideo.controller.js";

const router = Router();

router.use(auth);

// inicia dentro de uma conversa (exige chat liberado)
router.post("/iniciar", iniciarChamadaPorConversa);

// status pra reabrir/reconectar
router.get("/:id/status", statusChamada);

// ações do alvo
router.post("/:id/aceitar", aceitarChamada);
router.post("/:id/recusar", recusarChamada);

// qualquer participante finaliza
router.post("/:id/finalizar", finalizarChamada);

export default router;
