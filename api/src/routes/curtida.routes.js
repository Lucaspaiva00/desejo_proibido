import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { curtir, listarCurtidos } from "../controllers/curtida.controller.js";

const router = Router();

router.get("/minhas", auth, listarCurtidos);

router.post("/:paraUsuarioId", auth, curtir);

export default router;
