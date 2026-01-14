import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { listarMatches } from "../controllers/match.controller.js";

const router = Router();

router.use(auth);

// ✅ o front chama GET /matches
router.get("/", listarMatches);

// ✅ alias (se você quiser usar também)
router.get("/minhas", listarMatches);

export default router;
