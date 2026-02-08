// src/app.js
import express, { Router } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";

import perfilRoutes from "./routes/perfil.routes.js";
import authRoutes from "./routes/auth.routes.js";
import fotoRoutes from "./routes/foto.routes.js";
import curtidaRoutes from "./routes/curtida.routes.js";
import matchRoutes from "./routes/match.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import conversaRoutes from "./routes/conversa.routes.js";
import mensagemRoutes from "./routes/mensagem.routes.js";
import skipRoutes from "./routes/skip.routes.js";
import bloqueioRoutes from "./routes/bloqueio.routes.js";
import denunciaRoutes from "./routes/denuncia.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import termosRoutes from "./routes/termos.routes.js";
import premiumRoutes from "./routes/premium.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import presenteRoutes from "./routes/presente.routes.js";
import buscaRoutes from "./routes/busca.routes.js";
import ligacaoVideoRoutes from "./routes/ligacaoVideo.routes.js";
import livesRoutes from "./routes/lives.routes.js";
import pagamentosRoutes from "./routes/pagamentos.routes.js";
import carteiraRoutes from "./routes/carteira.routes.js";
import creditosRoutes from "./routes/creditos.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// router principal
const v1 = Router();

// auth primeiro
v1.use("/auth", authRoutes);

// demais rotas
v1.use("/perfil", perfilRoutes);
v1.use("/fotos", fotoRoutes);
v1.use("/curtidas", curtidaRoutes);
v1.use("/matches", matchRoutes);
v1.use("/feed", feedRoutes);
v1.use("/conversas", conversaRoutes);
v1.use("/mensagens", mensagemRoutes);
v1.use("/skips", skipRoutes);
v1.use("/bloqueios", bloqueioRoutes);
v1.use("/denuncias", denunciaRoutes);
v1.use("/usuarios", usuarioRoutes);
v1.use("/termos", termosRoutes);
v1.use("/premium", premiumRoutes);
v1.use("/admin", adminRoutes);
v1.use("/presentes", presenteRoutes);
v1.use("/busca", buscaRoutes);

// ✅ SOMENTE VIDEO
v1.use("/ligacoes/video", ligacaoVideoRoutes);

v1.use("/lives", livesRoutes);
v1.use("/carteira", carteiraRoutes);
v1.use("/creditos", creditosRoutes);

// ✅ PAGAMENTOS
v1.use("/pagamentos", pagamentosRoutes);

// health (sem /api)
app.get("/health", (req, res) => res.json({ ok: true }));

// rotas sem /api
app.use(v1);

// mesmas rotas com /api
app.use("/api", v1);

// health (com /api)
app.get("/api/health", (req, res) => res.json({ ok: true }));
