import "dotenv/config";
import http from "http";
import { Server as IOServer } from "socket.io";
import { app } from "./app.js";
import { registerSockets } from "./socket.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new IOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

registerSockets(io);

server.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
