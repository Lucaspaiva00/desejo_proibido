import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { me, salvarPerfil, verPerfilPublico } from "../controllers/perfil.controller.js";

const router = Router();

router.get("/me", auth, me);
router.put("/", auth, salvarPerfil);
router.get("/publico/:id", auth, verPerfilPublico);

export default router;
