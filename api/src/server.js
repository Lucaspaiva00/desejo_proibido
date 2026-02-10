// src/server.js
import "dotenv/config";
import http from "http";
import { Server as IOServer } from "socket.io";
import { app } from "./app.js";
import { registerSockets } from "./socket.js";

const PORT = Number(process.env.PORT || 3333);

// cria servidor HTTP
const server = http.createServer(app);

// socket.io
const io = new IOServer(server, {
  cors: {
    origin: "*", // se quiser travar depois, pode
    methods: ["GET", "POST"],
  },
});

// expõe io no app (caso algum controller precise)
app.set("io", io);

// registra sockets
registerSockets(io);

// ⚠️ LISTEN APENAS AQUI
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API rodando em porta ${PORT}`);
});
