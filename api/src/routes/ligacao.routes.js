import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { iniciarLigacao, finalizarLigacao, saldoMinutos } from "../controllers/ligacao.controller.js";

const router = Router();
router.use(auth);

router.get("/saldo", saldoMinutos);
router.post("/iniciar", iniciarLigacao);
router.post("/finalizar", finalizarLigacao);

export default router;
