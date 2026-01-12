import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { curtir } from "../controllers/curtida.controller.js";

const router = Router();

router.post("/:paraUsuarioId", auth, curtir);

export default router;
