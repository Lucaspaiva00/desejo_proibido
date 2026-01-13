import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { premiumMe, ativarPremium, cancelarPremium } from "../controllers/premium.controller.js";

const router = Router();

router.get("/me", auth, premiumMe);
router.post("/ativar", auth, ativarPremium);
router.post("/cancelar", auth, cancelarPremium);

export default router;
