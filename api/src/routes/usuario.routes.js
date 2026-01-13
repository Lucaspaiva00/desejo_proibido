import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { verPerfilPublico } from "../controllers/usuario.controller.js";

const router = Router();

// ver perfil público de um usuário
router.get("/:id", auth, verPerfilPublico);

export default router;