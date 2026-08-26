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
  const liveHosts = new Map();      // liveId -> Set(socketId)
  const liveViewers = new Map();    // liveId -> Set(socketId)

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


  // ============================
  // Live rooms / WebRTC 1:N
  // ============================
  function liveRoom(liveId) {
    return `live:${liveId}`;
  }

  function mapAdd(map, liveId, socketId) {
    const key = String(liveId);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(socketId);
  }

  function mapDelete(map, liveId, socketId) {
    const key = String(liveId);
    const set = map.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) map.delete(key);
  }

  function inMap(map, liveId, socketId) {
    return !!map.get(String(liveId))?.has(socketId);
  }

  function livePeersCanSignal(liveId, fromSocketId, toSocketId) {
    const hostToViewer = inMap(liveHosts, liveId, fromSocketId) && inMap(liveViewers, liveId, toSocketId);
    const viewerToHost = inMap(liveViewers, liveId, fromSocketId) && inMap(liveHosts, liveId, toSocketId);
    return hostToViewer || viewerToHost;
  }

  async function viewerCount(liveId) {
    return prisma.liveViewer.count({ where: { liveId: String(liveId), saiuEm: null } });
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

      const tokenUserId = getUserIdFromToken(token);
      let userId = tokenUserId;
      socket.data.authenticated = !!tokenUserId;

      if (!userId) {
        userId = socket.handshake.auth?.userId || socket.handshake.query?.userId || null;
      }

      if (userId) {
        addUserSocket(userId, socket.id);
        socket.data.userId = String(userId);

        // ✅ manda um snapshot inicial pra quem acabou de entrar (opcional)
        socket.emit("presence:me", { userId: String(userId), online: true, at: nowISO() });
      }

      socket.on("disconnect", async () => {
        const uid = socket.data.userId;
        if (uid) removeUserSocket(uid, socket.id);

        for (const [liveId, set] of [...liveViewers.entries()]) {
          if (!set.has(socket.id)) continue;
          mapDelete(liveViewers, liveId, socket.id);
          if (uid) {
            await prisma.liveViewer.updateMany({
              where: { liveId, viewerId: String(uid), saiuEm: null },
              data: { saiuEm: new Date() },
            }).catch(() => {});
          }
          const viewersOnline = await viewerCount(liveId).catch(() => 0);
          io.to(liveRoom(liveId)).emit("live:viewers:update", { liveId, viewersOnline });
          for (const hostSid of liveHosts.get(String(liveId)) || []) {
            io.to(hostSid).emit("live:viewer:left", { liveId, viewerSocketId: socket.id, viewerId: uid || null });
          }
        }

        for (const [liveId, set] of [...liveHosts.entries()]) {
          if (!set.has(socket.id)) continue;
          mapDelete(liveHosts, liveId, socket.id);
          socket.to(liveRoom(liveId)).emit("live:host:offline", { liveId });
        }
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
      // LIVE: host/viewer + signaling + chat
      // ============================
      socket.on("live:host:join", async ({ liveId } = {}, ack = () => {}) => {
        try {
          const uid = socket.data.userId;
          if (!socket.data.authenticated || !uid || !liveId) return ack({ ok: false, error: "Não autenticado" });

          const live = await prisma.live.findUnique({
            where: { id: String(liveId) },
            select: { hostId: true, status: true, host: { select: { perfil: { select: { genero: true } } } } },
          });
          if (!live || live.status !== "ATIVA" || live.hostId !== String(uid)) {
            return ack({ ok: false, error: "Live inválida para esta host" });
          }
          if (String(live.host?.perfil?.genero || "").toUpperCase() !== "F") {
            return ack({ ok: false, error: "Apenas host feminina pode transmitir" });
          }

          mapAdd(liveHosts, liveId, socket.id);
          socket.data.liveHostId = String(liveId);
          socket.join(liveRoom(liveId));

          const existingViewers = [...(liveViewers.get(String(liveId)) || [])];
          ack({ ok: true, liveId: String(liveId), viewersSockets: existingViewers });
          for (const viewerSocketId of existingViewers) {
            socket.emit("live:viewer:joined", { liveId: String(liveId), viewerSocketId });
          }
        } catch (e) {
          ack({ ok: false, error: e?.message || "Erro ao conectar host" });
        }
      });

      socket.on("live:viewer:join", async ({ liveId } = {}, ack = () => {}) => {
        try {
          const uid = socket.data.userId;
          if (!socket.data.authenticated || !uid || !liveId) return ack({ ok: false, error: "Não autenticado" });

          const [live, viewer] = await Promise.all([
            prisma.live.findUnique({ where: { id: String(liveId) }, select: { status: true, hostId: true } }),
            prisma.liveViewer.findUnique({
              where: { liveId_viewerId: { liveId: String(liveId), viewerId: String(uid) } },
              select: { saiuEm: true },
            }),
          ]);
          if (!live || live.status !== "ATIVA" || !viewer || viewer.saiuEm) {
            return ack({ ok: false, error: "Entre na live pela API antes de conectar o vídeo" });
          }

          mapAdd(liveViewers, liveId, socket.id);
          socket.data.liveViewerId = String(liveId);
          socket.join(liveRoom(liveId));

          for (const hostSocketId of liveHosts.get(String(liveId)) || []) {
            io.to(hostSocketId).emit("live:viewer:joined", {
              liveId: String(liveId),
              viewerSocketId: socket.id,
              viewerId: String(uid),
            });
          }

          ack({ ok: true, liveId: String(liveId), hostOnline: (liveHosts.get(String(liveId))?.size || 0) > 0 });
        } catch (e) {
          ack({ ok: false, error: e?.message || "Erro ao conectar espectador" });
        }
      });

      socket.on("live:offer", ({ liveId, viewerSocketId, sdp } = {}) => {
        if (!liveId || !viewerSocketId || !sdp) return;
        if (!inMap(liveHosts, liveId, socket.id) || !inMap(liveViewers, liveId, viewerSocketId)) return;
        io.to(viewerSocketId).emit("live:offer", { liveId: String(liveId), hostSocketId: socket.id, sdp });
      });

      socket.on("live:answer", ({ liveId, hostSocketId, sdp } = {}) => {
        if (!liveId || !hostSocketId || !sdp) return;
        if (!inMap(liveViewers, liveId, socket.id) || !inMap(liveHosts, liveId, hostSocketId)) return;
        io.to(hostSocketId).emit("live:answer", { liveId: String(liveId), viewerSocketId: socket.id, sdp });
      });

      socket.on("live:ice", ({ liveId, targetSocketId, candidate } = {}) => {
        if (!liveId || !targetSocketId || !candidate) return;
        if (!livePeersCanSignal(liveId, socket.id, targetSocketId)) return;
        io.to(targetSocketId).emit("live:ice", {
          liveId: String(liveId),
          fromSocketId: socket.id,
          candidate,
        });
      });

      socket.on("live:chat", async ({ liveId, texto } = {}, ack = () => {}) => {
        try {
          const uid = socket.data.userId;
          const msg = String(texto || "").trim().slice(0, 500);
          if (!socket.data.authenticated || !uid || !liveId || !msg) return ack({ ok: false });
          const permitido = inMap(liveHosts, liveId, socket.id) || inMap(liveViewers, liveId, socket.id);
          if (!permitido) return ack({ ok: false, error: "Fora da live" });

          const u = await prisma.usuario.findUnique({
            where: { id: String(uid) },
            select: { perfil: { select: { nome: true } } },
          });
          const payload = {
            liveId: String(liveId),
            userId: String(uid),
            nome: u?.perfil?.nome || "Usuário",
            texto: msg,
            criadoEm: new Date().toISOString(),
          };
          io.to(liveRoom(liveId)).emit("live:chat", payload);
          ack({ ok: true });
        } catch (e) {
          ack({ ok: false, error: e?.message || "Erro no chat" });
        }
      });

      socket.on("live:leave", async ({ liveId } = {}, ack = () => {}) => {
        try {
          const uid = socket.data.userId;
          const id = String(liveId || "");
          if (!id) return ack({ ok: false });

          const wasViewer = inMap(liveViewers, id, socket.id);
          const wasHost = inMap(liveHosts, id, socket.id);
          mapDelete(liveViewers, id, socket.id);
          mapDelete(liveHosts, id, socket.id);
          socket.leave(liveRoom(id));

          if (wasViewer && uid) {
            await prisma.liveViewer.updateMany({
              where: { liveId: id, viewerId: String(uid), saiuEm: null },
              data: { saiuEm: new Date() },
            });
            const viewersOnline = await viewerCount(id);
            io.to(liveRoom(id)).emit("live:viewers:update", { liveId: id, viewersOnline });
            for (const hostSid of liveHosts.get(id) || []) {
              io.to(hostSid).emit("live:viewer:left", { liveId: id, viewerSocketId: socket.id, viewerId: String(uid) });
            }
          }
          if (wasHost) socket.to(liveRoom(id)).emit("live:host:offline", { liveId: id });
          ack({ ok: true });
        } catch (e) {
          ack({ ok: false, error: e?.message || "Erro ao sair da live" });
        }
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
