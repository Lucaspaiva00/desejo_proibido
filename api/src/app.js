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
import uploadRoutes from "./routes/upload.routes.js";

import { langMiddleware } from "./middlewares/lang.middleware.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// static uploads (arquivos)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// router principal
const api = Router();

// auth primeiro
api.use("/auth", authRoutes);

// ✅ idioma para o resto do sistema
api.use(langMiddleware);

// ✅ ROTAS DE UPLOAD (multer) — TEM QUE SER /upload (singular)
// Assim o front chama: /api/upload/foto e /api/upload/audio
api.use("/upload", uploadRoutes);

// demais rotas
api.use("/perfil", perfilRoutes);
api.use("/fotos", fotoRoutes);
api.use("/curtidas", curtidaRoutes);
api.use("/matches", matchRoutes);
api.use("/feed", feedRoutes);
api.use("/conversas", conversaRoutes);
api.use("/mensagens", mensagemRoutes);
api.use("/skips", skipRoutes);
api.use("/bloqueios", bloqueioRoutes);
api.use("/denuncias", denunciaRoutes);
api.use("/usuarios", usuarioRoutes);
api.use("/termos", termosRoutes);
api.use("/premium", premiumRoutes);
api.use("/admin", adminRoutes);
api.use("/presentes", presenteRoutes);
api.use("/busca", buscaRoutes);

// ✅ SOMENTE VIDEO
api.use("/ligacoes/video", ligacaoVideoRoutes);

api.use("/lives", livesRoutes);
api.use("/carteira", carteiraRoutes);
api.use("/creditos", creditosRoutes);

// ✅ PAGAMENTOS
api.use("/pagamentos", pagamentosRoutes);

// health
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ✅ monta API só em /api (padrão)
app.use("/api", api);
