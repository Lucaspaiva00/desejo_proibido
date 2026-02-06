import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
    listarPacotes,
    checkoutCreditos,
} from "../controllers/pagamentos.controller.js";

const router = Router();

router.get("/pacotes", listarPacotes);
router.post("/checkout", auth, checkoutCreditos);

export default router;
