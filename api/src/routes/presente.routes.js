import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { listarPresentes, enviarPresente } from "../controllers/presente.controller.js";

const router = Router();

router.get("/", auth, listarPresentes);
router.post("/enviar", auth, enviarPresente);

export default router;
