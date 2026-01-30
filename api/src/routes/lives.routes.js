import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import * as livesController from "../controllers/lives.controller.js";

const router = Router();

router.get("/", auth, livesController.listarLives);
router.post("/iniciar", auth, livesController.iniciarLive);
router.post("/:id/entrar", auth, livesController.entrarLive);
router.post("/:id/sair", auth, livesController.sairLive);
router.post("/:id/tick", auth, livesController.tickLive);

// opcional (recomendado)
router.post("/:id/encerrar", auth, livesController.encerrarLive);

export default router;
