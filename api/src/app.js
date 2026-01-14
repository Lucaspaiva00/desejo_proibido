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
import skipRoutes from "./routes/skip.routes.js";
import bloqueioRoutes from "./routes/bloqueio.routes.js";
import denunciaRoutes from "./routes/denuncia.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import termosRoutes from "./routes/termos.routes.js";
import premiumRoutes from "./routes/premium.routes.js";
import pagamentoRoutes from "./routes/pagamento.routes.js";
import adminRoutes from "./routes/admin.routes.js";

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
app.use("/skips", skipRoutes);
app.use("/bloqueios", bloqueioRoutes);
app.use("/denuncias", denunciaRoutes);
app.use("/usuarios", usuarioRoutes)
app.use("/termos", termosRoutes);
app.use("/premium", premiumRoutes);
app.use("/pagamentos", pagamentoRoutes);
app.use("/admin", adminRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
