import { Router } from "express";
import {
  definirPrincipal,
  listarMinhasFotos,
  removerFoto,
  uploadFoto,
} from "../controllers/foto.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/minhas", auth, listarMinhasFotos);
router.post("/upload", auth, uploadFoto);
router.patch("/:id/principal", auth, definirPrincipal);
router.delete("/:id", auth, removerFoto);

export default router;
