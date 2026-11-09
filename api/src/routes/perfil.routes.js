import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { me, salvarPerfil, verPerfilPublico, consultarLocalizacao, salvarLocalizacao, removerLocalizacao } from "../controllers/perfil.controller.js";

const router = Router();

router.use(auth);

router.get("/me", me);
router.put("/", salvarPerfil);
router.get("/localizacao", consultarLocalizacao);
router.put("/localizacao", salvarLocalizacao);
router.delete("/localizacao", removerLocalizacao);
router.get("/publico/:id", verPerfilPublico);

export default router;
