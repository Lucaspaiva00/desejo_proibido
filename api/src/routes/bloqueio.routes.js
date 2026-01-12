import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { bloquear, desbloquear, meusBloqueios } from "../controllers/bloqueio.controller.js";

const router = Router();

router.get("/meus", auth, meusBloqueios);
router.post("/:paraUsuarioId", auth, bloquear);
router.delete("/:paraUsuarioId", auth, desbloquear);

export default router;
