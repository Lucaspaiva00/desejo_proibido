import { Router } from "express";
import { webhookWoo } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/woocommerce", webhookWoo);

export default router;
