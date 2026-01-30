// API/src/routes/pagamentos.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import {
    listarPacotes,
    checkoutCreditos,
    statusPagamento,
    webhookMercadoPago,
} from "../controllers/pagamentos.controller.js";

const router = Router();

router.get("/pacotes", listarPacotes);
router.post("/checkout", auth, checkoutCreditos);
router.get("/status/:id", auth, statusPagamento);

// webhook não usa auth
router.post("/webhook/mercadopago", webhookMercadoPago);

export default router;
