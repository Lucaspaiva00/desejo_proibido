// src/socket.js
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { getSaldoCreditos } from "./utils/creditos.js";
import { debitWallet } from "./utils/wallet.js"; // se existir ok, senão fallback abaixo.

const CUSTO_POR_MINUTO = 10;

function getUserIdFromToken(token) {
  try {
    if (!token) return null;
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const decoded = jwt.verify(token, secret);
    const id = decoded?.id || decoded?.userId || decoded?.sub;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export function registerSockets(io) {
  // ============================
  // Helpers internos (_dp)
  // ============================
  const userSockets = new Map();   // userId -> Set(socketId)
  const billingTimers = new Map(); // sessaoId -> intervalId

  // ✅ PRESENÇA (online/offline real)
  const onlineUsers = new Map();   // userId -> { online: true, lastSeen: Date, updatedAt: ms }
  const PRESENCE_TIMEOUT_MS = Number(process.env.PRESENCE_TIMEOUT_MS || 30000);

  function nowISO() {
    return new Date().toISOString();
  }

  function markOnline(userId) {
    const key = String(userId);
    onlineUsers.set(key, { online: true, lastSeen: null, updatedAt: Date.now() });

    io.emit("presence:update", { userId: key, online: true, at: nowISO() });
  }

  function markOfflineIfNoSockets(userId) {
    const key = String(userId);
    const set = userSockets.get(key);

    // só marca offline se não tem mais nenhum socket conectado
    if (set && set.size > 0) return;

    onlineUsers.set(key, { online: false, lastSeen: new Date(), updatedAt: Date.now() });

    io.emit("presence:update", { userId: key, online: false, at: nowISO() });
  }

  function presenceSnapshot(userIds = []) {
    const out = [];
    for (const id of userIds) {
      const key = String(id);
      const p = onlineUsers.get(key);
      out.push({
        userId: key,
        online: !!p?.online,
        lastSeen: p?.lastSeen ? new Date(p.lastSeen).toISOString() : null,
      });
    }
    return out;
  }

  function addUserSocket(userId, socketId) {
    const key = String(userId);
    if (!userSockets.has(key)) userSockets.set(key, new Set());
    userSockets.get(key).add(socketId);

    // ✅ marcou online
    markOnline(key);
  }

  function removeUserSocket(userId, socketId) {
    const key = String(userId);
    const set = userSockets.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(key);

    // ✅ marca offline (se realmente ficou sem sockets)
    markOfflineIfNoSockets(key);
  }

  function emitToUser(userId, event, payload) {
    const key = String(userId);
    const set = userSockets.get(key);
    if (!set) return;
    for (const sid of set) {
      io.to(sid).emit(event, payload);
    }
  }

  async function safeDebit(userId, amount) {
    if (typeof debitWallet === "function") {
      return await debitWallet(userId, amount);
    }

    await prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, saldoCreditos: 0 },
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const saldo = Number(wallet?.saldoCreditos ?? 0);

    if (saldo < amount) {
      const err = new Error("SALDO_INSUFICIENTE");
      err.code = "SALDO_INSUFICIENTE";
      err.saldo = saldo;
      throw err;
    }

    const updated = await prisma.wallet.update({
      where: { userId },
      data: { saldoCreditos: { decrement: amount } },
      select: { saldoCreditos: true },
    });

    return { saldoCreditos: Number(updated?.saldoCreditos ?? 0) };
  }

  function stopBillingTimer(sessaoId) {
    const id = String(sessaoId);
    const t = billingTimers.get(id);
    if (t) clearInterval(t);
    billingTimers.delete(id);
  }

  async function finalizeSession(sessaoId, motivo = "FINALIZADA") {
    const id = String(sessaoId);

    stopBillingTimer(id);

    const sessao = await prisma.sessaoLigacao.findUnique({ where: { id } });
    if (!sessao) return;

    if (sessao.status === "FINALIZADA" || sessao.status === "RECUSADA") {
      return;
    }

    await prisma.sessaoLigacao.update({
      where: { id },
      data: { status: "FINALIZADA", finalizadoEm: new Date() },
    });

    io.to(sessao.roomId).emit("call:ended", { sessaoId: id, motivo });
    emitToUser(sessao.usuarioId, "call:ended", { sessaoId: id, motivo });
    emitToUser(sessao.alvoId, "call:ended", { sessaoId: id, motivo });
  }

  async function startBillingTimer(sessaoId) {
    const id = String(sessaoId);

    if (billingTimers.has(id)) return;

    const sessao = await prisma.sessaoLigacao.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        roomId: true,
        usuarioId: true,
        alvoId: true,
        aceitouEm: true,
        segundosConsumidos: true,
        minutosCobrados: true,
      },
    });

    if (!sessao) return;
    if (sessao.status !== "ATIVA") return;

    let segundos = Number(sessao.segundosConsumidos ?? 0);
    let minutosCobrados = Number(sessao.minutosCobrados ?? 0);

    const intervalId = setInterval(async () => {
      try {
        const s = await prisma.sessaoLigacao.findUnique({
          where: { id },
          select: { status: true, roomId: true, usuarioId: true, alvoId: true },
        });

        if (!s || s.status !== "ATIVA") {
          stopBillingTimer(id);
          return;
        }

        segundos += 1;

        if (segundos % 5 === 0) {
          await prisma.sessaoLigacao.update({
            where: { id },
            data: { segundosConsumidos: segundos },
          });
        }

        const minutosAtuais = Math.floor(segundos / 60);
        while (minutosCobrados < minutosAtuais) {
          const saldoAntes = await getSaldoCreditos(sessao.usuarioId);

          if (saldoAntes < CUSTO_POR_MINUTO) {
            await prisma.sessaoLigacao.update({
              where: { id },
              data: {
                status: "FINALIZADA",
                finalizadoEm: new Date(),
                segundosConsumidos: segundos,
                minutosCobrados,
              },
            });

            io.to(sessao.roomId).emit("call:ended", { sessaoId: id, motivo: "SALDO_INSUFICIENTE" });
            emitToUser(sessao.usuarioId, "call:ended", { sessaoId: id, motivo: "SALDO_INSUFICIENTE" });
            emitToUser(sessao.alvoId, "call:ended", { sessaoId: id, motivo: "SALDO_INSUFICIENTE" });

            stopBillingTimer(id);
            return;
          }

          const deb = await safeDebit(sessao.usuarioId, CUSTO_POR_MINUTO);

          minutosCobrados += 1;

          await prisma.sessaoLigacao.update({
            where: { id },
            data: { minutosCobrados, segundosConsumidos: segundos },
          });

          io.to(sessao.roomId).emit("wallet:update", { saldoCreditos: deb?.saldoCreditos });
          emitToUser(sessao.usuarioId, "wallet:update", { saldoCreditos: deb?.saldoCreditos });
        }
      } catch (e) {
        console.error("billing timer error:", e?.message || e);
      }
    }, 1000);

    billingTimers.set(id, intervalId);
  }

  // expõe helpers pro controller usar
  io._dp = {
    emitToUser,
    startBillingTimer,
    finalizeSession,
    stopBillingTimer,

    // ✅ presence helpers (se quiser usar em controller depois)
    presenceSnapshot,
  };

  // ============================
  // Presence cleanup (timeout)
  // ============================
  setInterval(() => {
    const now = Date.now();
    for (const [uid, p] of onlineUsers.entries()) {
      if (!p?.online) continue;

      // se está online, mas não tem sockets, corrige
      const set = userSockets.get(uid);
      if (!set || set.size === 0) {
        markOfflineIfNoSockets(uid);
        continue;
      }

      // se está online mas sem ping muito tempo, derruba (protege mobile/aba dormindo)
      const age = now - (p.updatedAt || now);
      if (age > PRESENCE_TIMEOUT_MS) {
        // mantém como online se ainda existe socket (pq socket vivo), senão offline
        if (!set || set.size === 0) markOfflineIfNoSockets(uid);
      }
    }
  }, Math.max(5000, Math.floor(PRESENCE_TIMEOUT_MS / 2)));

  // ============================
  // Socket connection
  // ============================
  io.on("connection", async (socket) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        "";

      let userId = getUserIdFromToken(token);

      if (!userId) {
        userId = socket.handshake.auth?.userId || socket.handshake.query?.userId || null;
      }

      if (userId) {
        addUserSocket(userId, socket.id);
        socket.data.userId = String(userId);

        // ✅ manda um snapshot inicial pra quem acabou de entrar (opcional)
        socket.emit("presence:me", { userId: String(userId), online: true, at: nowISO() });
      }

      socket.on("disconnect", () => {
        const uid = socket.data.userId;
        if (uid) removeUserSocket(uid, socket.id);
      });

      // ============================
      // ✅ Presence events (front usa isso)
      // ============================
      socket.on("presence:ping", () => {
        const uid = socket.data.userId;
        if (!uid) return;
        const p = onlineUsers.get(uid) || {};
        onlineUsers.set(uid, { ...p, online: true, lastSeen: null, updatedAt: Date.now() });
      });

      // retorna status atual de uma lista
      socket.on("presence:watch", ({ userIds }) => {
        const arr = Array.isArray(userIds) ? userIds : [];
        socket.emit("presence:list", presenceSnapshot(arr));
      });

      // retorna quem está online (snapshot simples)
      socket.on("presence:who", ({ userIds }) => {
        const arr = Array.isArray(userIds) ? userIds : [];
        socket.emit("presence:list", presenceSnapshot(arr));
      });

      // ============================
      // Rooms
      // ============================
      socket.on("joinRoom", ({ roomId }) => {
        if (!roomId) return;
        socket.join(roomId);
      });

      // ============================
      // ✅ READY handshake
      // ============================
      socket.on("call:ready", ({ roomId, sessaoId }) => {
        if (!roomId) return;
        socket.to(roomId).emit("call:ready", { sessaoId });
      });

      // ============================
      // WebRTC signaling relay
      // ============================
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
        await finalizeSession(sessaoId, "FINALIZADA");
      });
    } catch (e) {
      console.error("socket connection error:", e?.message || e);
    }
  });
}
