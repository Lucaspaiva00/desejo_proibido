import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { listarPresentes, enviarPresente } from "../controllers/presente.controller.js";

const router = Router();
router.use(auth);

router.get("/", listarPresentes);
router.post("/enviar", enviarPresente);

export default router;
