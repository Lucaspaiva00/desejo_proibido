import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { buscar, preferencias, salvarPreferencias } from "../controllers/busca.controller.js";

const router = Router();
router.use(auth);

// GET /busca?...
router.get("/", buscar);

// GET /busca/preferencias
router.get("/preferencias", preferencias);

// PUT /busca/preferencias
router.put("/preferencias", salvarPreferencias);

export default router;
