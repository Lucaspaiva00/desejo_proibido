import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";

import {
    listarMulheres,
    iniciarChamada,
    chamadasPendentes,
    aceitarChamada,
    recusarChamada,
    finalizarChamada,
} from "../controllers/ligacaoVideo.controller.js";

const router = Router();

router.get("/mulheres", auth, listarMulheres);
router.post("/iniciar", auth, iniciarChamada);
router.get("/pendentes", auth, chamadasPendentes);
router.post("/:id/aceitar", auth, aceitarChamada);
router.post("/:id/recusar", auth, recusarChamada);
router.post("/:id/finalizar", auth, finalizarChamada);

export default router;
