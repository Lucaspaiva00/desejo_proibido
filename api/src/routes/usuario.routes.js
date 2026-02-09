// src/routes/usuario.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    me,
    setInvisivel,
    ativarBoost,
    getUsuarioById,
    atualizarMeuIdioma,
} from "../controllers/usuario.controller.js";

const router = Router();

router.get("/me", auth, me);
router.put("/invisivel", auth, setInvisivel);
router.put("/boost", auth, ativarBoost);
router.patch("/me/idioma", auth, atualizarMeuIdioma);

// ⚠️ sempre por último
router.get("/:id", auth, getUsuarioById);

export default router;
