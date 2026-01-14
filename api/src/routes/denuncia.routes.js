import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { criarDenuncia,denunciar, minhasDenuncias } from "../controllers/denuncia.controller.js";

const router = Router();

router.post("/", auth, criarDenuncia);
router.post("/", auth, denunciar);
router.get("/minhas", auth, minhasDenuncias); // opcional

export default router;
