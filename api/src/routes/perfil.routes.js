import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { me, salvarPerfil, verPerfilPublico } from "../controllers/perfil.controller.js";

const router = Router();

router.use(auth);

router.get("/me", me);
router.put("/", salvarPerfil);
router.get("/publico/:id", verPerfilPublico);

export default router;
