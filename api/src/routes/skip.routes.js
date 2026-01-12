import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { pular } from "../controllers/skip.controller.js";

const router = Router();

router.post("/:paraUsuarioId", auth, pular);

export default router;
