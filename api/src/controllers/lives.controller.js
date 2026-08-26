import { prisma } from "../prisma.js";

const CREDITOS_POR_MINUTO = Math.max(0, Number(process.env.LIVE_CREDITOS_POR_MINUTO || 1));
const MAX_GORJETA_CREDITOS = Math.max(1, Number(process.env.LIVE_MAX_GORJETA_CREDITOS || 100000));

function isAtiva(status) {
  return String(status || "").toUpperCase() === "ATIVA";
}

function liveRoom(liveId) {
  return `live:${liveId}`;
}

async function getUsuarioResumo(userId) {
  return prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      ativo: true,
      minutosDisponiveis: true,
      perfil: { select: { nome: true, genero: true } },
      wallet: { select: { saldoCreditos: true } },
    },
  });
}

function generoDo(usuario) {
  return String(usuario?.perfil?.genero || "").trim().toUpperCase();
}

function serializeLive(live) {
  if (!live) return null;
  return {
    id: live.id,
    titulo: live.titulo,
    status: live.status,
    criadaEm: live.criadaEm,
    encerradaEm: live.encerradaEm || null,
    host: {
      id: live.host?.id,
      nome: live.host?.perfil?.nome || "Sem nome",
      cidade: live.host?.perfil?.cidade || null,
      estado: live.host?.perfil?.estado || null,
      verificada: !!live.host?.perfil?.verificado,
      foto: live.host?.fotos?.[0]?.url || null,
    },
    viewersOnline: Array.isArray(live.liveViewers)
      ? live.liveViewers.filter((v) => !v.saiuEm).length
      : Number(live._count?.liveViewers || 0),
  };
}

async function getLiveDetalhada(liveId) {
  return prisma.live.findUnique({
    where: { id: liveId },
    select: {
      id: true,
      titulo: true,
      status: true,
      criadaEm: true,
      encerradaEm: true,
      hostId: true,
      host: {
        select: {
          id: true,
          perfil: {
            select: {
              nome: true,
              cidade: true,
              estado: true,
              genero: true,
              verificado: true,
            },
          },
          fotos: {
            where: { principal: true },
            take: 1,
            select: { url: true },
          },
        },
      },
      liveViewers: {
        where: { saiuEm: null },
        select: { id: true, viewerId: true, entrouEm: true, saiuEm: true },
      },
    },
  });
}

async function ganhosDaLive(hostId, liveId) {
  const agg = await prisma.walletTx.aggregate({
    where: {
      userId: hostId,
      refId: liveId,
      tipo: { in: ["CREDIT", "CREDITO"] },
      origem: {
        in: ["LIVE_MINUTO", "LIVE_PRESENTE_RECEBIDO", "LIVE_GORJETA_RECEBIDA", "LIVE"],
      },
    },
    _sum: { valor: true },
    _count: { id: true },
  });

  return {
    creditos: Number(agg?._sum?.valor || 0),
    eventos: Number(agg?._count?.id || 0),
  };
}

export async function statusLive(req, res) {
  try {
    const userId = req.usuario.id;
    const usuario = await getUsuarioResumo(userId);
    if (!usuario?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });

    const genero = generoDo(usuario);
    let liveAtiva = null;
    let ganhos = { creditos: 0, eventos: 0 };

    if (genero === "F") {
      const live = await prisma.live.findFirst({
        where: { hostId: userId, status: "ATIVA" },
        orderBy: { criadaEm: "desc" },
        select: { id: true },
      });
      if (live) {
        liveAtiva = serializeLive(await getLiveDetalhada(live.id));
        ganhos = await ganhosDaLive(userId, live.id);
      }
    }

    return res.json({
      userId,
      nome: usuario.perfil?.nome || "",
      genero,
      podeTransmitir: genero === "F",
      podeAssistir: genero === "M",
      saldoCreditos: Number(usuario.wallet?.saldoCreditos || 0),
      minutosDisponiveis: Number(usuario.minutosDisponiveis || 0),
      liveAtiva,
      ganhos,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar status das lives", detalhe: e.message });
  }
}

export async function listarLives(req, res) {
  try {
    const lives = await prisma.live.findMany({
      where: { status: "ATIVA" },
      select: {
        id: true,
        titulo: true,
        status: true,
        criadaEm: true,
        encerradaEm: true,
        host: {
          select: {
            id: true,
            perfil: {
              select: { nome: true, cidade: true, estado: true, genero: true, verificado: true },
            },
            fotos: { where: { principal: true }, take: 1, select: { url: true } },
          },
        },
        liveViewers: { where: { saiuEm: null }, select: { id: true, saiuEm: true } },
      },
      orderBy: { criadaEm: "desc" },
      take: 50,
    });

    const items = lives
      .filter((l) => String(l.host?.perfil?.genero || "").toUpperCase() === "F")
      .map(serializeLive);

    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar lives", detalhe: e.message });
  }
}

export async function detalharLive(req, res) {
  try {
    const live = await getLiveDetalhada(req.params.id);
    if (!live || !isAtiva(live.status)) {
      return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    }
    if (String(live.host?.perfil?.genero || "").toUpperCase() !== "F") {
      return res.status(400).json({ erro: "Live inválida" });
    }
    return res.json(serializeLive(live));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar live", detalhe: e.message });
  }
}

export async function iniciarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const titulo = String(req.body?.titulo || "").trim().slice(0, 80) || null;
    const me = await getUsuarioResumo(userId);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "F") {
      return res.status(403).json({ erro: "Apenas mulheres podem iniciar live" });
    }

    const jaTem = await prisma.live.findFirst({
      where: { hostId: userId, status: "ATIVA" },
      select: { id: true },
    });
    if (jaTem) {
      return res.status(409).json({ erro: "Você já tem uma live ativa", liveId: jaTem.id });
    }

    const live = await prisma.live.create({
      data: { hostId: userId, titulo, status: "ATIVA" },
      select: { id: true, status: true, criadaEm: true, titulo: true },
    });

    req.app.get("io")?.emit("live:list:update", { action: "STARTED", liveId: live.id });

    return res.status(201).json({ ok: true, liveId: live.id, ...live });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao iniciar live", detalhe: e.message });
  }
}

export async function entrarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const me = await getUsuarioResumo(userId);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "M") {
      return res.status(403).json({ erro: "Somente homens podem entrar como espectadores" });
    }

    const live = await getLiveDetalhada(liveId);
    if (!live || !isAtiva(live.status)) {
      return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    }
    if (String(live.host?.perfil?.genero || "").toUpperCase() !== "F") {
      return res.status(400).json({ erro: "Live inválida (host)" });
    }
    if (live.hostId === userId) return res.status(400).json({ erro: "Host não entra como viewer" });
    if (Number(me.minutosDisponiveis || 0) <= 0) {
      return res.status(402).json({ erro: "Sem minutos disponíveis", code: "SEM_MINUTOS" });
    }

    const viewer = await prisma.liveViewer.upsert({
      where: { liveId_viewerId: { liveId, viewerId: userId } },
      create: { liveId, viewerId: userId, entrouEm: new Date(), saiuEm: null, minutosCobrados: 0 },
      update: { entrouEm: new Date(), saiuEm: null, minutosCobrados: 0 },
      select: { id: true, entrouEm: true, minutosCobrados: true },
    });

    const viewersOnline = await prisma.liveViewer.count({ where: { liveId, saiuEm: null } });
    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:viewers:update", { liveId, viewersOnline });
    io?.emit("live:list:update", { action: "VIEWERS", liveId, viewersOnline });

    return res.json({
      ok: true,
      viewer: { id: viewer.id, entrouEm: viewer.entrouEm },
      live: serializeLive(live),
      saldoMinutos: Number(me.minutosDisponiveis || 0),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao entrar na live", detalhe: e.message });
  }
}

export async function sairLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const me = await getUsuarioResumo(userId);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "M") {
      return res.status(403).json({ erro: "Somente espectadores podem sair desta forma" });
    }

    const upd = await prisma.liveViewer.updateMany({
      where: { liveId, viewerId: userId, saiuEm: null },
      data: { saiuEm: new Date() },
    });

    const viewersOnline = await prisma.liveViewer.count({ where: { liveId, saiuEm: null } });
    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:viewers:update", { liveId, viewersOnline });
    io?.emit("live:list:update", { action: "VIEWERS", liveId, viewersOnline });

    return res.json({ ok: true, updated: upd.count, viewersOnline });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao sair da live", detalhe: e.message });
  }
}

export async function tickLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const me = await getUsuarioResumo(userId);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "M") return res.status(403).json({ erro: "Somente espectadores consomem minutos" });

    const live = await prisma.live.findUnique({
      where: { id: liveId },
      select: {
        id: true,
        status: true,
        hostId: true,
        host: { select: { perfil: { select: { genero: true } } } },
      },
    });
    if (!live || !isAtiva(live.status)) {
      return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    }
    if (String(live.host?.perfil?.genero || "").toUpperCase() !== "F") {
      return res.status(400).json({ erro: "Live inválida (host)" });
    }

    const viewer = await prisma.liveViewer.findUnique({
      where: { liveId_viewerId: { liveId, viewerId: userId } },
      select: { id: true, saiuEm: true, entrouEm: true, minutosCobrados: true },
    });
    if (!viewer || viewer.saiuEm) return res.status(403).json({ erro: "Você não está na live" });

    // Não permite que o front cobre mais minutos do que o tempo realmente transcorrido.
    const minutosDecorridos = Math.floor((Date.now() - new Date(viewer.entrouEm).getTime()) / 60000);
    if (minutosDecorridos <= Number(viewer.minutosCobrados || 0)) {
      return res.json({
        ok: true,
        cobrado: false,
        saldoMinutos: Number(me.minutosDisponiveis || 0),
        minutosCobrados: Number(viewer.minutosCobrados || 0),
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({
        where: { id: userId },
        select: { minutosDisponiveis: true, ativo: true },
      });
      if (!u?.ativo) throw new Error("Usuário inválido");

      if (Number(u.minutosDisponiveis || 0) <= 0) {
        await tx.liveViewer.update({
          where: { liveId_viewerId: { liveId, viewerId: userId } },
          data: { saiuEm: new Date() },
        });
        return { semMinutos: true, saldo: 0 };
      }

      await tx.usuario.update({
        where: { id: userId },
        data: { minutosDisponiveis: { decrement: 1 } },
      });

      const lv = await tx.liveViewer.update({
        where: { liveId_viewerId: { liveId, viewerId: userId } },
        data: { minutosCobrados: { increment: 1 } },
        select: { minutosCobrados: true },
      });

      await tx.creditoMinuto.create({
        data: {
          usuarioId: userId,
          tipo: "DEBITO",
          minutos: -1,
          refTipo: "LIVE",
          refId: liveId,
          detalhes: "Consumo de 1 minuto em live",
        },
      });

      if (CREDITOS_POR_MINUTO > 0) {
        await tx.wallet.upsert({
          where: { userId: live.hostId },
          create: { userId: live.hostId, saldoCreditos: CREDITOS_POR_MINUTO },
          update: { saldoCreditos: { increment: CREDITOS_POR_MINUTO } },
        });
        await tx.walletTx.create({
          data: {
            userId: live.hostId,
            tipo: "CREDIT",
            origem: "LIVE_MINUTO",
            valor: CREDITOS_POR_MINUTO,
            refId: liveId,
          },
        });
      }

      const [u2, hostWallet] = await Promise.all([
        tx.usuario.findUnique({ where: { id: userId }, select: { minutosDisponiveis: true } }),
        tx.wallet.findUnique({ where: { userId: live.hostId }, select: { saldoCreditos: true } }),
      ]);

      return {
        semMinutos: false,
        saldo: Number(u2?.minutosDisponiveis || 0),
        minutosCobrados: Number(lv.minutosCobrados || 0),
        hostCreditos: Number(hostWallet?.saldoCreditos || 0),
      };
    });

    if (result.semMinutos) {
      return res.status(402).json({ erro: "Sem minutos", code: "SEM_MINUTOS", saldoMinutos: 0 });
    }

    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:earning", {
      liveId,
      tipo: "MINUTO",
      valorCreditos: CREDITOS_POR_MINUTO,
      hostSaldoCreditos: result.hostCreditos,
    });
    io?._dp?.emitToUser(live.hostId, "wallet:update", { saldoCreditos: result.hostCreditos });

    return res.json({
      ok: true,
      cobrado: true,
      saldoMinutos: result.saldo,
      minutosCobrados: result.minutosCobrados,
      hostCreditos: result.hostCreditos,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro no consumo da live", detalhe: e.message });
  }
}

export async function presentearLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const { presenteId = null, valorCreditos = null, mensagem = null } = req.body || {};

    const me = await getUsuarioResumo(userId);
    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "M") {
      return res.status(403).json({ erro: "Somente espectadores podem enviar presentes nesta live" });
    }

    const live = await getLiveDetalhada(liveId);
    if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    if (String(live.host?.perfil?.genero || "").toUpperCase() !== "F") {
      return res.status(400).json({ erro: "Live inválida" });
    }

    const viewer = await prisma.liveViewer.findUnique({
      where: { liveId_viewerId: { liveId, viewerId: userId } },
      select: { saiuEm: true },
    });
    if (!viewer || viewer.saiuEm) {
      return res.status(403).json({ erro: "Entre na live antes de enviar presente ou gorjeta" });
    }

    let presente = null;
    let valor = 0;
    let tipo = "GORJETA";

    if (presenteId) {
      presente = await prisma.presente.findUnique({
        where: { id: String(presenteId) },
        select: { id: true, nome: true, imagemUrl: true, custoCreditos: true, ativo: true },
      });
      if (!presente?.ativo) return res.status(404).json({ erro: "Presente inválido/inativo" });
      valor = Number(presente.custoCreditos || 0);
      tipo = "PRESENTE";
    } else {
      valor = Number(valorCreditos);
    }

    if (!Number.isInteger(valor) || valor <= 0 || valor > MAX_GORJETA_CREDITOS) {
      return res.status(400).json({ erro: "Valor de créditos inválido" });
    }

    const msgLimpa = String(mensagem || "").trim().slice(0, 240) || null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, saldoCreditos: 0 },
      });
      await tx.wallet.upsert({
        where: { userId: live.hostId },
        update: {},
        create: { userId: live.hostId, saldoCreditos: 0 },
      });

      const walletRemetente = await tx.wallet.findUnique({
        where: { userId },
        select: { saldoCreditos: true },
      });
      const saldoAntes = Number(walletRemetente?.saldoCreditos || 0);
      if (saldoAntes < valor) {
        const err = new Error("Saldo insuficiente");
        err.code = "SALDO_INSUFICIENTE";
        err.status = 402;
        err.saldoCreditos = saldoAntes;
        throw err;
      }

      const remetenteWallet = await tx.wallet.update({
        where: { userId },
        data: { saldoCreditos: { decrement: valor } },
        select: { saldoCreditos: true },
      });
      const hostWallet = await tx.wallet.update({
        where: { userId: live.hostId },
        data: { saldoCreditos: { increment: valor } },
        select: { saldoCreditos: true },
      });

      const origemEnvio = tipo === "PRESENTE" ? "LIVE_PRESENTE_ENVIO" : "LIVE_GORJETA_ENVIO";
      const origemRecebida = tipo === "PRESENTE" ? "LIVE_PRESENTE_RECEBIDO" : "LIVE_GORJETA_RECEBIDA";

      await tx.walletTx.createMany({
        data: [
          { userId, tipo: "DEBIT", origem: origemEnvio, valor, refId: liveId },
          { userId: live.hostId, tipo: "CREDIT", origem: origemRecebida, valor, refId: liveId },
        ],
      });

      await tx.giftCredito.create({
        data: {
          remetenteId: userId,
          destinatarioId: live.hostId,
          valor,
          mensagem: msgLimpa,
        },
      });

      return {
        saldoRemetente: Number(remetenteWallet.saldoCreditos || 0),
        saldoHost: Number(hostWallet.saldoCreditos || 0),
      };
    });

    const evento = {
      liveId,
      tipo,
      valorCreditos: valor,
      mensagem: msgLimpa,
      de: { id: userId, nome: me.perfil?.nome || "Usuário" },
      para: { id: live.hostId, nome: live.host?.perfil?.nome || "Host" },
      presente: presente
        ? { id: presente.id, nome: presente.nome, imagemUrl: presente.imagemUrl, custoCreditos: valor }
        : null,
      criadoEm: new Date().toISOString(),
    };

    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:gift", evento);
    io?._dp?.emitToUser(userId, "wallet:update", { saldoCreditos: result.saldoRemetente });
    io?._dp?.emitToUser(live.hostId, "wallet:update", { saldoCreditos: result.saldoHost });

    return res.json({
      ok: true,
      evento,
      saldoCreditos: result.saldoRemetente,
      hostSaldoCreditos: result.saldoHost,
    });
  } catch (e) {
    if (e?.code === "SALDO_INSUFICIENTE") {
      return res.status(402).json({
        code: "SALDO_INSUFICIENTE",
        erro: "Saldo insuficiente para enviar este presente/gorjeta",
        saldoCreditos: Number(e?.saldoCreditos || 0),
      });
    }
    return res.status(e?.status || 500).json({ erro: "Erro ao enviar presente/gorjeta", detalhe: e.message });
  }
}

export async function resumoLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const live = await prisma.live.findUnique({
      where: { id: liveId },
      select: { id: true, hostId: true, status: true, criadaEm: true, encerradaEm: true },
    });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId !== userId) return res.status(403).json({ erro: "Resumo disponível somente para a host" });

    const [viewersOnline, totalViewers, ganhos] = await Promise.all([
      prisma.liveViewer.count({ where: { liveId, saiuEm: null } }),
      prisma.liveViewer.count({ where: { liveId } }),
      ganhosDaLive(userId, liveId),
    ]);

    return res.json({
      liveId,
      status: live.status,
      criadaEm: live.criadaEm,
      encerradaEm: live.encerradaEm,
      viewersOnline,
      totalViewers,
      ganhosCreditos: ganhos.creditos,
      eventosFinanceiros: ganhos.eventos,
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar resumo da live", detalhe: e.message });
  }
}

export async function encerrarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const me = await getUsuarioResumo(userId);

    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (generoDo(me) !== "F") return res.status(403).json({ erro: "Apenas mulheres podem encerrar a live" });

    const live = await prisma.live.findUnique({
      where: { id: liveId },
      select: { hostId: true, status: true },
    });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId !== userId) return res.status(403).json({ erro: "Você não é a host desta live" });

    if (!isAtiva(live.status)) return res.json({ ok: true, status: live.status });

    await prisma.$transaction([
      prisma.live.update({
        where: { id: liveId },
        data: { status: "ENCERRADA", encerradaEm: new Date() },
      }),
      prisma.liveViewer.updateMany({
        where: { liveId, saiuEm: null },
        data: { saiuEm: new Date() },
      }),
    ]);

    const resumo = await ganhosDaLive(userId, liveId);
    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:ended", { liveId, motivo: "HOST_ENCERROU" });
    io?.emit("live:list:update", { action: "ENDED", liveId });

    return res.json({ ok: true, status: "ENCERRADA", ganhosCreditos: resumo.creditos });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao encerrar live", detalhe: e.message });
  }
}
