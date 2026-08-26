import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import {
  financeiroCriadora,
  listarMeusSaques,
  solicitarAprovacaoCriadora,
  solicitarSaque,
  statusCriadora,
} from "../controllers/criadora.controller.js";

const router = Router();
router.use(auth);
router.get("/status", statusCriadora);
router.post("/solicitar", solicitarAprovacaoCriadora);
router.get("/financeiro", financeiroCriadora);
router.get("/saques", listarMeusSaques);
router.post("/saques", solicitarSaque);
export default router;
