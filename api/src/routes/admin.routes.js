import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import {
    listarDenuncias,
    detalheDenuncia,
    atualizarStatusDenuncia,
    banGlobal,
    desbanir,
    verUsuarioAdmin,
    listarAcoesAdmin,
} from "../controllers/admin.controller.js";

const router = Router();

// tudo aqui exige auth + admin
router.use(auth, adminOnly);

router.get("/denuncias", listarDenuncias);
router.get("/denuncias/:id", detalheDenuncia);
router.put("/denuncias/:id/status", atualizarStatusDenuncia);

router.post("/ban-global", banGlobal);
router.post("/desbanir", desbanir);

router.get("/usuarios/:id", verUsuarioAdmin);
router.get("/acoes", listarAcoesAdmin);

export default router;
