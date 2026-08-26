import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import {
    dashboardV2,
    listarUsuariosV2,
    detalheUsuarioV2,
    acaoUsuarioV2,
    financeiroV2,
    listarTransacoesV2,
    listarPagamentosV2,
    listarPresentesV2,
    criarPresenteV2,
    atualizarPresenteV2,
    configuracoesV2,
} from "../controllers/admin.v2.controller.js";
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
// Admin 2.0
router.get("/v2/dashboard", dashboardV2);
router.get("/v2/usuarios", listarUsuariosV2);
router.get("/v2/usuarios/:id", detalheUsuarioV2);
router.post("/v2/usuarios/:id/acao", acaoUsuarioV2);
router.get("/v2/financeiro", financeiroV2);
router.get("/v2/transacoes", listarTransacoesV2);
router.get("/v2/pagamentos", listarPagamentosV2);
router.get("/v2/presentes", listarPresentesV2);
router.post("/v2/presentes", criarPresenteV2);
router.put("/v2/presentes/:id", atualizarPresenteV2);
router.get("/v2/configuracoes", configuracoesV2);

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
