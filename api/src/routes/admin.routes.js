import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import {
    atualizarCriadora,
    dashboardOperacional,
    encerrarLiveAdmin,
    listarCriadoras,
    listarLivesAdmin,
    listarSaques,
    processarSaque,
} from "../controllers/admin.creator.controller.js";
import {
    listarDenuncias,
    detalheDenuncia,
    atualizarStatusDenuncia,
    banGlobal,
    desbanir,
    verUsuarioAdmin,
    listarAcoesAdmin,
    listarLogsAcesso,
    listarLogsDenuncia,
} from "../controllers/admin.controller.js";

const router = Router();

// tudo aqui exige auth + admin
router.use(auth, adminOnly);
router.get("/dashboard-operacional", dashboardOperacional);
router.get("/criadoras", listarCriadoras);
router.put("/criadoras/:id/status", atualizarCriadora);
router.get("/saques", listarSaques);
router.put("/saques/:id", processarSaque);
router.get("/lives", listarLivesAdmin);
router.post("/lives/:id/encerrar", encerrarLiveAdmin);

router.get("/logs/acessos", listarLogsAcesso);
router.get("/logs/denuncias", listarLogsDenuncia);
router.get("/denuncias", listarDenuncias);
router.get("/denuncias/:id", detalheDenuncia);
router.put("/denuncias/:id/status", atualizarStatusDenuncia);

router.post("/ban-global", banGlobal);
router.post("/desbanir", desbanir);

router.get("/usuarios/:id", verUsuarioAdmin);
router.get("/acoes", listarAcoesAdmin);

export default router;
