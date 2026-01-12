import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { minhasConversas } from "../controllers/conversa.controller.js";

const router = Router();

router.get("/minhas", auth, minhasConversas);

export default router;
