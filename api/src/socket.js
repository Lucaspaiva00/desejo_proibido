// src/socket.js
import { prisma } from "./prisma.js";
import { getSaldoCreditos } from "./utils/creditos.js";
import { debitWallet } from "./utils/wallet.js"; // se você tiver. Se não tiver, eu já deixo fallback abaixo.

const CUSTO_POR_MINUTO = 10;

export function registerSockets(io) {
  // ============================
  // Helpers internos (_dp)
  // ============================
  const userSockets = new Map(); // userId -> Set(socketId)
  const billingTimers = new Map(); // sessaoId -> intervalId

  function addUserSocket(userId, socketId) {
    const key = String(userId);
    if (!userSockets.has(key)) userSockets.set(key, new Set());
    userSockets.get(key).add(socketId);
  }

  function removeUserSocket(userId, socketId) {
    const key = String(userId);
    const set = userSockets.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(key);
  }

  function emitToUser(userId, event, payload) {
    const key = String(userId);
    const set = userSockets.get(key);
    if (!set) return;
    for (const sid of set) {
      io.to(sid).emit(event, payload);
    }
  }

  async function safeDebit(usuarioId, amount) {
    // prioridade: seu helper debitWallet (se existir)
    if (typeof debitWallet === "function") {
      return await debitWallet(usuarioId, amount);
    }

    // fallback direto no Prisma (ajuste se o nome da tabela for outro)
    const wallet = await prisma.carteira.findUnique({ where: { usuarioId } });
    const saldo = Number(wallet?.saldoCreditos ?? 0);
    if (saldo < amount) {
      const err = new Error("SALDO_INSUFICIENTE");
      err.code = "SALDO_INSUFICIENTE";
      err.saldo = saldo;
      throw err;
    }

    await prisma.carteira.update({
      where: { usuarioId },
      data: { saldoCreditos: saldo - amount },
    });

    return { saldoCreditos: saldo - amount };
  }

  function stopBillingTimer(sessaoId) {
    const id = String(sessaoId);
    const t = billingTimers.get(id);
    if (t) clearInterval(t);
    billingTimers.delete(id);
  }

  async function finalizeSession(sessaoId, motivo = "FINALIZADA") {
    const id = String(sessaoId);

    // para timer primeiro (evita dupla cobrança)
    stopBillingTimer(id);

    const sessao = await prisma.sessaoLigacao.findUnique({ where: { id } });
    if (!sessao) return;

    if (sessao.status === "FINALIZADA" || sessao.status === "RECUSADA") {
      return;
    }

    // marca finalizada no banco (mantém os contadores do timer)
    await prisma.sessaoLigacao.update({
      where: { id },
      data: { status: "FINALIZADA", finalizadoEm: new Date() },
    });

    // avisa os 2 lados e room
    io.to(sessao.roomId).emit("call:ended", { sessaoId: id, motivo });
    emitToUser(sessao.usuarioId, "call:ended", { sessaoId: id, motivo });
    emitToUser(sessao.alvoId, "call:ended", { sessaoId: id, motivo });
  }

  async function startBillingTimer(sessaoId) {
    const id = String(sessaoId);

    // ✅ evita timers duplicados
    if (billingTimers.has(id)) return;

    // carrega sessão
    const sessao = await prisma.sessaoLigacao.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        roomId: true,
        usuarioId: true, // caller
        alvoId: true,    // callee
        aceitouEm: true,
        segundosConsumidos: true,
        minutosCobrados: true,
      },
    });

    if (!sessao) return;
    if (sessao.status !== "ATIVA") return;

    // contador local (continua de onde parou)
    let segundos = Number(sessao.segundosConsumidos ?? 0);
    let minutosCobrados = Number(sessao.minutosCobrados ?? 0);

    const intervalId = setInterval(async () => {
      try {
        // confirma que ainda está ativa
        const s = await prisma.sessaoLigacao.findUnique({
          where: { id },
          select: { status: true, roomId: true, usuarioId: true, alvoId: true },
        });
        if (!s || s.status !== "ATIVA") {
          stopBillingTimer(id);
          return;
        }

        // conta 1 segundo
        segundos += 1;

        // ✅ atualiza segundos no banco a cada 5s pra não spammar
        if (segundos % 5 === 0) {
          await prisma.sessaoLigacao.update({
            where: { id },
            data: { segundosConsumidos: segundos },
          });
        }

        // ✅ cobra somente quando completar um minuto novo
        const minutosAtuais = Math.floor(segundos / 60);
        while (minutosCobrados < minutosAtuais) {
          // cobra 1 minuto por vez (mais seguro)
          // regra: quem paga? aqui vou cobrar do caller (usuarioId)
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
            data: {
              minutosCobrados,
              segundosConsumidos: segundos,
            },
          });

          // notifica saldo pro room
          io.to(sessao.roomId).emit("wallet:update", { saldoCreditos: deb?.saldoCreditos });
        }
      } catch (e) {
        // se der erro, não explode o servidor
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
  };

  // ============================
  // Socket connection
  // ============================
  io.on("connection", async (socket) => {
    try {
      // se você autentica por token, você pode decodificar aqui
      // mas como já está funcionando, vamos manter simples:
      const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

      // ✅ se no seu registerSockets atual você já resolve userId do token,
      // mantenha do seu jeito. Aqui é só fallback.
      if (userId) addUserSocket(userId, socket.id);

      socket.on("disconnect", () => {
        if (userId) removeUserSocket(userId, socket.id);
      });

      // ============================
      // Rooms
      // ============================
      socket.on("joinRoom", ({ roomId }) => {
        if (!roomId) return;
        socket.join(roomId);
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
