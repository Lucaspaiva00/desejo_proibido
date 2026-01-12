import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { criarPerfil, atualizarPerfil, meuPerfil } from "../controllers/perfil.controller.js";

const router = Router();

router.get("/me", auth, meuPerfil);
router.post("/", auth, criarPerfil);
router.put("/", auth, atualizarPerfil);

export default router;
