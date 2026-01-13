import { Router } from "express";
import { termosAtivos } from "../controllers/termos.controller.js";

const router = Router();

router.get("/ativos", termosAtivos);

export default router;
