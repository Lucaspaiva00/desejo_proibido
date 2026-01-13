import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { criarCheckoutPremium, webhookMercadoPago } from "../controllers/pagamento.controller.js";

const router = Router();

// cria checkout (precisa estar logado)
router.post("/premium", auth, criarCheckoutPremium);

// webhook do MP (NÃO usa auth)
router.post("/webhook", webhookMercadoPago);

export default router;
