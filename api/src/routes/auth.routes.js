import { Router } from "express";
import { registrar, login, me } from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/registrar", registrar);
router.post("/login", login);
router.get("/me", auth, me);

export default router;
