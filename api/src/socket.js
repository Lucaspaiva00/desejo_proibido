// src/socket.js
import { prisma } from "./prisma.js";
import { verificarToken } from "./utils/jwt.js";
import { debitarCreditosTx, getSaldoCreditos } from "./utils/creditos.js";

const CUSTO_POR_MINUTO = 10;

// memória (simples e eficiente)
const userSockets = new Map();      // userId -> Set(socketId)
const callTimers = new Map();       // sessaoId -> intervalId

function addUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
}

function emitToUser(io, userId, event, payload) {
  const set = userSockets.get(userId);
  if (!set) return;
  for (const sid of set) io.to(sid).emit(event, payload);
}

async function finalizeSession(io, sessaoId, motivo = "FINALIZADA") {
  const sessao = await prisma.sessaoLigacao.findUnique({ where: { id: sessaoId } });
  if (!sessao) return;

  if (sessao.status === "FINALIZADA" || sessao.status === "RECUSADA") return;

  const agora = new Date();
  const inicio = sessao.aceitouEm ?? sessao.iniciadoEm;

  const segundos = Math.max(
    0,
    Math.floor((agora.getTime() - new Date(inicio).getTime()) / 1000)
  );

  // minutos totais arredondados pra cima
  const minutosTotais = Math.max(0, Math.ceil(segundos / 60));

  // já cobrados via timer:
  const cobrados = sessao.minutosCobrados ?? 0;
  const faltantes = Math.max(0, minutosTotais - cobrados);

  // cobra o que faltou (se houver)
  if (faltantes > 0) {
    const custo = faltantes * CUSTO_POR_MINUTO;
    try {
      await prisma.$transaction(async (tx) => {
        await debitarCreditosTx({
          userId: sessao.usuarioId,     // cobramos do caller
          valor: custo,
          origem: "VIDEO_CALL",
          refId: sessao.id,
          prismaTx: tx,
        });

        await tx.sessaoLigacao.update({
          where: { id: sessao.id },
          data: { minutosCobrados: { increment: faltantes } },
        });
      });
    } catch {
      // se não conseguiu cobrar, a sessão já está sendo finalizada de qualquer forma
    }
  }

  await prisma.sessaoLigacao.update({
    where: { id: sessao.id },
    data: {
      status: "FINALIZADA",
      finalizadoEm: agora,
      segundosConsumidos: segundos,
    },
  });

  // mata timer
  const t = callTimers.get(sessaoId);
  if (t) {
    clearInterval(t);
    callTimers.delete(sessaoId);
  }

  // avisa os dois lados
  if (sessao.roomId) {
    io.to(sessao.roomId).emit("call:ended", {
      sessaoId,
      motivo,
      segundosConsumidos: segundos,
      minutosTotais,
    });
  }

  const saldo = await getSaldoCreditos(sessao.usuarioId);
  emitToUser(io, sessao.usuarioId, "wallet:update", { saldoCreditos: saldo });
}

async function startBillingTimer(io, sessaoId) {
  if (callTimers.has(sessaoId)) return;

  const intervalId = setInterval(async () => {
    try {
      const sessao = await prisma.sessaoLigacao.findUnique({ where: { id: sessaoId } });
      if (!sessao) return;
      if (sessao.status !== "ATIVA") return;

      // cobra 1 minuto
      await prisma.$transaction(async (tx) => {
        await debitarCreditosTx({
          userId: sessao.usuarioId,
          valor: CUSTO_POR_MINUTO,
          origem: "VIDEO_CALL_MINUTE",
          refId: sessao.id,
          prismaTx: tx,
        });

        await tx.sessaoLigacao.update({
          where: { id: sessao.id },
          data: { minutosCobrados: { increment: 1 } },
        });
      });

      const saldo = await getSaldoCreditos(sessao.usuarioId);
      emitToUser(io, sessao.usuarioId, "wallet:update", { saldoCreditos: saldo });
    } catch (e) {
      // saldo insuficiente -> encerra
      await finalizeSession(io, sessaoId, "SALDO_INSUFICIENTE");
    }
  }, 60000);

  callTimers.set(sessaoId, intervalId);
}

export function registerSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        "";

      if (!token) return next(new Error("unauthorized"));

      const payload = verificarToken(String(token));
      socket.userId = payload.id;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    addUserSocket(userId, socket.id);

    socket.on("joinRoom", async ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    // sinalização WebRTC
    socket.on("call:offer", ({ roomId, sdp, sessaoId }) => {
      if (!roomId || !sdp) return;
      socket.to(roomId).emit("call:offer", { sdp, sessaoId });
    });

    socket.on("call:answer", ({ roomId, sdp, sessaoId }) => {
      if (!roomId || !sdp) return;
      socket.to(roomId).emit("call:answer", { sdp, sessaoId });
    });

    socket.on("call:ice", ({ roomId, candidate, sessaoId }) => {
      if (!roomId || !candidate) return;
      socket.to(roomId).emit("call:ice", { candidate, sessaoId });
    });

    socket.on("call:hangup", async ({ sessaoId }) => {
      if (!sessaoId) return;
      await finalizeSession(io, sessaoId, "HANGUP");
    });

    socket.on("disconnect", () => {
      removeUserSocket(userId, socket.id);
    });

    // expõe helpers para controllers via io
    socket.emit("socket:ready", { ok: true });
  });

  // anexar helpers no io (pra controller usar)
  io._dp = {
    emitToUser: (userId, event, payload) => emitToUser(io, userId, event, payload),
    startBillingTimer: (sessaoId) => startBillingTimer(io, sessaoId),
    finalizeSession: (sessaoId, motivo) => finalizeSession(io, sessaoId, motivo),
  };
}
