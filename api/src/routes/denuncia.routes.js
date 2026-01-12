import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { denunciar, minhasDenuncias } from "../controllers/denuncia.controller.js";

const router = Router();

router.post("/", auth, denunciar);
router.get("/minhas", auth, minhasDenuncias); // opcional

export default router;
