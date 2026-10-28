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
import criadoraRoutes from "./routes/criadora.routes.js";

import { langMiddleware } from "./middlewares/lang.middleware.js";

export const app = express();

// proxies / nginx (recomendado)
app.set("trust proxy", 1);

// CORS de emergência/compatibilidade para web local e produção.
// Mantido antes de helmet/cors para garantir os headers inclusive em erros e preflight.
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isCorsOriginAllowed(origin)) {
        if (origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
        }

        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
        );
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        );
        res.setHeader(
            "Access-Control-Expose-Headers",
            "Content-Length"
        );
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// middlewares base
app.use(helmet());

const corsAllowedOrigins = new Set([
    "https://desejoproibido.app",
    "https://www.desejoproibido.app",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8082",
    "http://127.0.0.1:8082",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
]);

export function isCorsOriginAllowed(origin) {
    // Apps nativos, curl e chamadas server-to-server normalmente não enviam Origin.
    if (!origin) return true;
    if (corsAllowedOrigins.has(origin)) return true;

    // Expo/web local pode mudar de porta durante desenvolvimento.
    try {
        const url = new URL(origin);
        const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        return localHost && (url.protocol === "http:" || url.protocol === "https:");
    } catch {
        return false;
    }
}

export const corsOptions = {
    origin(origin, callback) {
        if (isCorsOriginAllowed(origin)) return callback(null, true);
        return callback(new Error(`Origin não permitida por CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    exposedHeaders: ["Content-Length"],
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// static uploads (GET /uploads/...)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// router principal v1
const v1 = Router();

// health (SEM /api)
app.get("/health", (req, res) => res.json({ ok: true }));

// auth primeiro (sem idioma)
v1.use("/auth", authRoutes);

// idioma pro resto
v1.use(langMiddleware);

// demais rotas (APENAS UMA VEZ)
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

// uploads (rotas de POST etc) - deixe sob /api/uploads
v1.use("/uploads", uploadRoutes);

// SOMENTE VIDEO
v1.use("/ligacoes/video", ligacaoVideoRoutes);

v1.use("/lives", livesRoutes);
v1.use("/carteira", carteiraRoutes);
v1.use("/creditos", creditosRoutes);
v1.use("/criadora", criadoraRoutes);

// pagamentos
v1.use("/pagamentos", pagamentosRoutes);

// monta API (padronizado)
app.use("/api", v1);
app.use("/api/v1", v1);

// CARTEIRA
app.use("/api/carteira", carteiraRoutes);

// health com /api
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (req, res) => res.json({ ok: true }));


