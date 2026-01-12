import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";
import perfilRoutes from "./routes/perfil.routes.js";
import authRoutes from "./routes/auth.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import fotoRoutes from "./routes/foto.routes.js";
import curtidaRoutes from "./routes/curtida.routes.js";
import matchRoutes from "./routes/match.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import conversaRoutes from "./routes/conversa.routes.js";
import mensagemRoutes from "./routes/mensagem.routes.js";


export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/perfil", perfilRoutes);
app.use("/fotos", fotoRoutes);
app.use("/curtidas", curtidaRoutes);
app.use("/matches", matchRoutes);
app.use("/feed", feedRoutes);
app.use("/conversas", conversaRoutes);
app.use("/mensagens", mensagemRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
