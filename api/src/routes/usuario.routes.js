import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { me, setInvisivel, ativarBoost } from "../controllers/usuario.controller.js";

const router = Router();

router.get("/me", auth, me);
router.put("/invisivel", auth, setInvisivel);
router.put("/boost", auth, ativarBoost);

export default router;
