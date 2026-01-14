import { Router } from "express";
import { webhookWoo } from "../controllers/woo.controller.js";

const router = Router();

// não usa auth, porque webhook não tem token do app.
// a segurança é o header x-webhook-secret.
router.post("/woo", webhookWoo);

export default router;
