// src/server.js
import "dotenv/config";
import http from "http";
import { Server as IOServer } from "socket.io";
import { app, isCorsOriginAllowed } from "./app.js";
import { registerSockets } from "./socket.js";

const PORT = Number(process.env.PORT || 3333);

// cria servidor HTTP
const server = http.createServer(app);

// socket.io
const io = new IOServer(server, {
  path: "/api/socket.io",
  cors: {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin não permitida no Socket.IO: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// expõe io no app
app.set("io", io);

// registra sockets
registerSockets(io);

// listen SOMENTE aqui
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API + Socket rodando na porta ${PORT}`);
});
