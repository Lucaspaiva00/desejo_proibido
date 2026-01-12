import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { meusMatches } from "../controllers/match.controller.js";

const router = Router();

router.get("/minhas", auth, meusMatches);

export default router;
