import { prisma } from "../prisma.js";
import {
  creatorCanBroadcast,
  idadeEmAnos,
  isAdult,
  isFemaleGender,
  isMaleGender,
  normalizeGender,
} from "../utils/creator.js";
import { splitCreatorCredits } from "../utils/creatorFinance.js";

const CREDITOS_POR_MINUTO = Math.max(0, Math.trunc(Number(process.env.LIVE_CREDITOS_POR_MINUTO || 1)));
const MAX_GORJETA_CREDITOS = Math.max(1, Math.trunc(Number(process.env.LIVE_MAX_GORJETA_CREDITOS || 100000)));
const MAX_META_CREDITOS = Math.max(100, Math.trunc(Number(process.env.LIVE_MAX_META_CREDITOS || 100000000)));

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
      creatorStatus: true,
      creatorSolicitadoEm: true,
      creatorAprovadoEm: true,
      minutosDisponiveis: true,
      perfil: {
        select: {
          nome: true,
          genero: true,
          nascimento: true,
          verificado: true,
          cidade: true,
          estado: true,
        },
      },
      wallet: { select: { saldoCreditos: true, saldoBloqueado: true } },
    },
  });
}

function serializeLive(live) {
  if (!live) return null;
  return {
    id: live.id,
    titulo: live.titulo,
    metaCreditos: live.metaCreditos == null ? null : Number(live.metaCreditos),
    status: live.status,
    criadaEm: live.criadaEm,
    encerradaEm: live.encerradaEm || null,
    host: {
      id: live.host?.id,
      nome: live.host?.perfil?.nome || "Sem nome",
      cidade: live.host?.perfil?.cidade || null,
      estado: live.host?.perfil?.estado || null,
      verificada: !!live.host?.perfil?.verificado,
      creatorStatus: live.host?.creatorStatus || null,
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
      metaCreditos: true,
      status: true,
      criadaEm: true,
      encerradaEm: true,
      hostId: true,
      host: {
        select: {
          id: true,
          ativo: true,
          creatorStatus: true,
          perfil: {
            select: {
              nome: true,
              cidade: true,
              estado: true,
              genero: true,
              nascimento: true,
              verificado: true,
            },
          },
          fotos: { where: { principal: true }, take: 1, select: { url: true } },
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
  const [agg, fee, gifts] = await Promise.all([
    prisma.walletTx.aggregate({
      where: {
        userId: hostId,
        refId: liveId,
        tipo: { in: ["CREDIT", "CREDITO"] },
        origem: { in: ["LIVE_MINUTO", "LIVE_PRESENTE_RECEBIDO", "LIVE_GORJETA_RECEBIDA", "LIVE"] },
      },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.platformRevenue.aggregate({ where: { liveId }, _sum: { valorCreditos: true } }),
    prisma.giftCredito.aggregate({ where: { refTipo: "LIVE", refId: liveId }, _sum: { valor: true }, _count: { id: true } }),
  ]);
  return {
    creditos: Number(agg?._sum?.valor || 0),
    eventos: Number(agg?._count?.id || 0),
    receitaPlataformaCreditos: Number(fee?._sum?.valorCreditos || 0),
    presentesBrutosCreditos: Number(gifts?._sum?.valor || 0),
    presentesQuantidade: Number(gifts?._count?.id || 0),
  };
}

function parseMeta(value) {
  if (value == null || value === "") return null;
  const n = Math.trunc(Number(value));
  if (!Number.isInteger(n) || n < 100 || n > MAX_META_CREDITOS) return undefined;
  return n;
}

export async function statusLive(req, res) {
  try {
    const userId = req.usuario.id;
    const usuario = await getUsuarioResumo(userId);
    if (!usuario?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });

    const genero = normalizeGender(usuario.perfil?.genero);
    const feminina = isFemaleGender(genero);
    const masculina = isMaleGender(genero);
    const adulto = isAdult(usuario.perfil?.nascimento);
    const podeTransmitir = creatorCanBroadcast(usuario);
    let liveAtiva = null;
    let ganhos = { creditos: 0, eventos: 0, receitaPlataformaCreditos: 0, presentesBrutosCreditos: 0, presentesQuantidade: 0 };

    if (feminina) {
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
      idade: idadeEmAnos(usuario.perfil?.nascimento),
      maiorDe18: adulto,
      creatorStatus: usuario.creatorStatus || "NAO_SOLICITADO",
      perfilVerificado: !!usuario.perfil?.verificado,
      perfilFeminino: feminina,
      perfilMasculino: masculina,
      podeTransmitir,
      podeAssistir: masculina && adulto,
      saldoCreditos: Number(usuario.wallet?.saldoCreditos || 0),
      saldoBloqueado: Number(usuario.wallet?.saldoBloqueado || 0),
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
        metaCreditos: true,
        status: true,
        criadaEm: true,
        encerradaEm: true,
        host: {
          select: {
            id: true,
            ativo: true,
            creatorStatus: true,
            perfil: { select: { nome: true, cidade: true, estado: true, genero: true, nascimento: true, verificado: true } },
            fotos: { where: { principal: true }, take: 1, select: { url: true } },
          },
        },
        liveViewers: { where: { saiuEm: null }, select: { id: true, saiuEm: true } },
      },
      orderBy: [{ liveViewers: { _count: "desc" } }, { criadaEm: "desc" }],
      take: 50,
    });
    return res.json({ items: lives.filter((l) => creatorCanBroadcast(l.host)).map(serializeLive) });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar lives", detalhe: e.message });
  }
}

export async function detalharLive(req, res) {
  try {
    const live = await getLiveDetalhada(req.params.id);
    if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    if (!creatorCanBroadcast(live.host)) return res.status(400).json({ erro: "Live inválida" });
    return res.json(serializeLive(live));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar live", detalhe: e.message });
  }
}

export async function iniciarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const titulo = String(req.body?.titulo || "").trim().slice(0, 80) || null;
    const metaCreditos = parseMeta(req.body?.metaCreditos);
    if (metaCreditos === undefined) return res.status(400).json({ erro: `metaCreditos deve ficar entre 100 e ${MAX_META_CREDITOS}` });
    const me = await getUsuarioResumo(userId);
    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (!isAdult(me.perfil?.nascimento)) return res.status(403).json({ erro: "É obrigatório ter 18 anos ou mais" });
    if (!isFemaleGender(me.perfil?.genero)) return res.status(403).json({ erro: "Apenas perfis femininos podem iniciar live" });
    if (!creatorCanBroadcast(me)) {
      return res.status(403).json({
        erro: "Conta de criadora ainda não está aprovada",
        code: "CRIADORA_NAO_APROVADA",
        creatorStatus: me.creatorStatus || "NAO_SOLICITADO",
      });
    }

    const jaTem = await prisma.live.findFirst({ where: { hostId: userId, status: "ATIVA" }, select: { id: true } });
    if (jaTem) return res.status(409).json({ erro: "Você já tem uma live ativa", liveId: jaTem.id });

    const live = await prisma.live.create({
      data: { hostId: userId, titulo, metaCreditos, status: "ATIVA" },
      select: { id: true, status: true, criadaEm: true, titulo: true, metaCreditos: true },
    });
    req.app.get("io")?.emit("live:list:update", { action: "STARTED", liveId: live.id });
    return res.status(201).json({ ok: true, liveId: live.id, ...live });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao iniciar live", detalhe: e.message });
  }
}

export async function atualizarMetaLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const metaCreditos = parseMeta(req.body?.metaCreditos);
    if (metaCreditos === undefined) return res.status(400).json({ erro: `metaCreditos deve ficar entre 100 e ${MAX_META_CREDITOS}` });
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { hostId: true, status: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId !== userId) return res.status(403).json({ erro: "Você não é a host desta live" });
    if (!isAtiva(live.status)) return res.status(409).json({ erro: "Live já encerrada" });
    const updated = await prisma.live.update({ where: { id: liveId }, data: { metaCreditos }, select: { id: true, metaCreditos: true } });
    req.app.get("io")?.to(liveRoom(liveId)).emit("live:meta:update", updated);
    return res.json({ ok: true, ...updated });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar meta", detalhe: e.message });
  }
}

export async function entrarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const me = await getUsuarioResumo(userId);
    if (!me?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (!isMaleGender(me.perfil?.genero)) return res.status(403).json({ erro: "Somente perfis masculinos podem entrar como espectadores" });
    if (!isAdult(me.perfil?.nascimento)) return res.status(403).json({ erro: "É obrigatório ter 18 anos ou mais" });

    const live = await getLiveDetalhada(liveId);
    if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    if (!creatorCanBroadcast(live.host)) return res.status(400).json({ erro: "Live inválida (host)" });
    if (live.hostId === userId) return res.status(400).json({ erro: "Host não entra como viewer" });
    if (Number(me.minutosDisponiveis || 0) <= 0) return res.status(402).json({ erro: "Sem minutos disponíveis", code: "SEM_MINUTOS" });

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
    return res.json({ ok: true, viewer: { id: viewer.id, entrouEm: viewer.entrouEm }, live: serializeLive(live), saldoMinutos: Number(me.minutosDisponiveis || 0) });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao entrar na live", detalhe: e.message });
  }
}

export async function sairLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const upd = await prisma.liveViewer.updateMany({ where: { liveId, viewerId: userId, saiuEm: null }, data: { saiuEm: new Date() } });
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
    if (!me?.ativo || !isMaleGender(me.perfil?.genero) || !isAdult(me.perfil?.nascimento)) {
      return res.status(403).json({ erro: "Espectador inválido para cobrança" });
    }

    const live = await prisma.live.findUnique({
      where: { id: liveId },
      select: { id: true, status: true, hostId: true, host: { select: { ativo: true, creatorStatus: true, perfil: { select: { genero: true, nascimento: true, verificado: true } } } } },
    });
    if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    if (!creatorCanBroadcast(live.host)) return res.status(400).json({ erro: "Live inválida (host)" });

    const viewer = await prisma.liveViewer.findUnique({
      where: { liveId_viewerId: { liveId, viewerId: userId } },
      select: { id: true, saiuEm: true, entrouEm: true, minutosCobrados: true },
    });
    if (!viewer || viewer.saiuEm) return res.status(403).json({ erro: "Você não está na live" });
    const minutosDecorridos = Math.floor((Date.now() - new Date(viewer.entrouEm).getTime()) / 60000);
    const expected = Number(viewer.minutosCobrados || 0);
    if (minutosDecorridos <= expected) {
      return res.json({ ok: true, cobrado: false, saldoMinutos: Number(me.minutosDisponiveis || 0), minutosCobrados: expected });
    }

    const split = splitCreatorCredits(CREDITOS_POR_MINUTO);
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.liveViewer.updateMany({
          where: { id: viewer.id, saiuEm: null, minutosCobrados: expected },
          data: { minutosCobrados: { increment: 1 } },
        });
        if (claimed.count !== 1) return { jaCobrado: true };

        const debited = await tx.usuario.updateMany({
          where: { id: userId, ativo: true, minutosDisponiveis: { gt: 0 } },
          data: { minutosDisponiveis: { decrement: 1 } },
        });
        if (debited.count !== 1) {
          const err = new Error("SEM_MINUTOS");
          err.code = "SEM_MINUTOS";
          throw err;
        }

        await tx.creditoMinuto.create({ data: { usuarioId: userId, tipo: "DEBITO", minutos: -1, refTipo: "LIVE", refId: liveId, detalhes: "Consumo de 1 minuto em live" } });
        if (split.criadora > 0) {
          await tx.wallet.upsert({
            where: { userId: live.hostId },
            create: { userId: live.hostId, saldoCreditos: split.criadora, saldoBloqueado: 0 },
            update: { saldoCreditos: { increment: split.criadora } },
          });
          await tx.walletTx.create({ data: { userId: live.hostId, tipo: "CREDIT", origem: "LIVE_MINUTO", valor: split.criadora, refId: liveId } });
        }
        if (split.plataforma > 0) {
          await tx.platformRevenue.create({
            data: { origem: "LIVE_MINUTO", refId: liveId, liveId, payerId: userId, creatorId: live.hostId, valorCreditos: split.plataforma, percentual: split.percentual },
          });
        }
        const [u2, hostWallet] = await Promise.all([
          tx.usuario.findUnique({ where: { id: userId }, select: { minutosDisponiveis: true } }),
          tx.wallet.findUnique({ where: { userId: live.hostId }, select: { saldoCreditos: true } }),
        ]);
        return { jaCobrado: false, saldo: Number(u2?.minutosDisponiveis || 0), minutosCobrados: expected + 1, hostCreditos: Number(hostWallet?.saldoCreditos || 0) };
      });
    } catch (e) {
      if (e?.code === "SEM_MINUTOS") {
        await prisma.liveViewer.updateMany({ where: { id: viewer.id, saiuEm: null }, data: { saiuEm: new Date() } });
        const viewersOnline = await prisma.liveViewer.count({ where: { liveId, saiuEm: null } });
        req.app.get("io")?.to(liveRoom(liveId)).emit("live:viewers:update", { liveId, viewersOnline });
        return res.status(402).json({ erro: "Sem minutos", code: "SEM_MINUTOS", saldoMinutos: 0 });
      }
      throw e;
    }

    if (result.jaCobrado) {
      const fresh = await getUsuarioResumo(userId);
      return res.json({ ok: true, cobrado: false, saldoMinutos: Number(fresh?.minutosDisponiveis || 0), minutosCobrados: expected });
    }

    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:earning", { liveId, tipo: "MINUTO", valorCreditos: split.criadora, taxaPlataformaCreditos: split.plataforma, hostSaldoCreditos: result.hostCreditos });
    io?._dp?.emitToUser(live.hostId, "wallet:update", { saldoCreditos: result.hostCreditos });
    return res.json({ ok: true, cobrado: true, saldoMinutos: result.saldo, minutosCobrados: result.minutosCobrados, hostCreditos: result.hostCreditos });
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
    if (!me?.ativo || !isMaleGender(me.perfil?.genero) || !isAdult(me.perfil?.nascimento)) return res.status(403).json({ erro: "Somente espectadores válidos podem enviar presentes" });

    const live = await getLiveDetalhada(liveId);
    if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });
    if (!creatorCanBroadcast(live.host)) return res.status(400).json({ erro: "Live inválida" });
    const viewer = await prisma.liveViewer.findUnique({ where: { liveId_viewerId: { liveId, viewerId: userId } }, select: { saiuEm: true } });
    if (!viewer || viewer.saiuEm) return res.status(403).json({ erro: "Entre na live antes de enviar presente ou gorjeta" });

    let presente = null;
    let valor = 0;
    let tipo = "GORJETA";
    if (presenteId) {
      presente = await prisma.presente.findUnique({ where: { id: String(presenteId) }, select: { id: true, nome: true, imagemUrl: true, custoCreditos: true, ativo: true } });
      if (!presente?.ativo) return res.status(404).json({ erro: "Presente inválido/inativo" });
      valor = Number(presente.custoCreditos || 0);
      tipo = "PRESENTE";
    } else {
      valor = Number(valorCreditos);
    }
    if (!Number.isInteger(valor) || valor <= 0 || valor > MAX_GORJETA_CREDITOS) return res.status(400).json({ erro: "Valor de créditos inválido" });
    const split = splitCreatorCredits(valor);
    const msgLimpa = String(mensagem || "").trim().slice(0, 240) || null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId, saldoCreditos: 0, saldoBloqueado: 0 } });
      await tx.wallet.upsert({ where: { userId: live.hostId }, update: {}, create: { userId: live.hostId, saldoCreditos: 0, saldoBloqueado: 0 } });
      const debit = await tx.wallet.updateMany({ where: { userId, saldoCreditos: { gte: valor } }, data: { saldoCreditos: { decrement: valor } } });
      if (debit.count !== 1) {
        const saldo = await tx.wallet.findUnique({ where: { userId }, select: { saldoCreditos: true } });
        const err = new Error("Saldo insuficiente"); err.code = "SALDO_INSUFICIENTE"; err.saldoCreditos = Number(saldo?.saldoCreditos || 0); throw err;
      }
      const hostWallet = split.criadora > 0
        ? await tx.wallet.update({ where: { userId: live.hostId }, data: { saldoCreditos: { increment: split.criadora } }, select: { saldoCreditos: true } })
        : await tx.wallet.findUnique({ where: { userId: live.hostId }, select: { saldoCreditos: true } });
      const remetenteWallet = await tx.wallet.findUnique({ where: { userId }, select: { saldoCreditos: true } });
      const origemEnvio = tipo === "PRESENTE" ? "LIVE_PRESENTE_ENVIO" : "LIVE_GORJETA_ENVIO";
      const origemRecebida = tipo === "PRESENTE" ? "LIVE_PRESENTE_RECEBIDO" : "LIVE_GORJETA_RECEBIDA";
      const txs = [{ userId, tipo: "DEBIT", origem: origemEnvio, valor, refId: liveId }];
      if (split.criadora > 0) txs.push({ userId: live.hostId, tipo: "CREDIT", origem: origemRecebida, valor: split.criadora, refId: liveId });
      await tx.walletTx.createMany({ data: txs });
      if (split.plataforma > 0) {
        await tx.platformRevenue.create({ data: { origem: origemRecebida, refId: liveId, liveId, payerId: userId, creatorId: live.hostId, valorCreditos: split.plataforma, percentual: split.percentual, detalhes: `${tipo} bruto ${valor}` } });
      }
      await tx.giftCredito.create({ data: { remetenteId: userId, destinatarioId: live.hostId, valor, mensagem: msgLimpa, refTipo: "LIVE", refId: liveId } });
      return { saldoRemetente: Number(remetenteWallet?.saldoCreditos || 0), saldoHost: Number(hostWallet?.saldoCreditos || 0) };
    });

    const evento = {
      liveId,
      tipo,
      valorCreditos: valor,
      valorCriadoraCreditos: split.criadora,
      taxaPlataformaCreditos: split.plataforma,
      mensagem: msgLimpa,
      de: { id: userId, nome: me.perfil?.nome || "Usuário" },
      para: { id: live.hostId, nome: live.host?.perfil?.nome || "Host" },
      presente: presente ? { id: presente.id, nome: presente.nome, imagemUrl: presente.imagemUrl, custoCreditos: valor } : null,
      criadoEm: new Date().toISOString(),
    };
    const io = req.app.get("io");
    io?.to(liveRoom(liveId)).emit("live:gift", evento);
    io?._dp?.emitToUser(userId, "wallet:update", { saldoCreditos: result.saldoRemetente });
    io?._dp?.emitToUser(live.hostId, "wallet:update", { saldoCreditos: result.saldoHost });
    return res.json({ ok: true, evento, saldoCreditos: result.saldoRemetente, hostSaldoCreditos: result.saldoHost });
  } catch (e) {
    if (e?.code === "SALDO_INSUFICIENTE") return res.status(402).json({ code: "SALDO_INSUFICIENTE", erro: "Saldo insuficiente para enviar este presente/gorjeta", saldoCreditos: Number(e?.saldoCreditos || 0) });
    return res.status(500).json({ erro: "Erro ao enviar presente/gorjeta", detalhe: e.message });
  }
}

export async function rankingLive(req, res) {
  try {
    const liveId = req.params.id;
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { id: true, metaCreditos: true, status: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    const top = await prisma.giftCredito.groupBy({
      by: ["remetenteId"],
      where: { refTipo: "LIVE", refId: liveId },
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
      take: 10,
    });
    const total = await prisma.giftCredito.aggregate({ where: { refTipo: "LIVE", refId: liveId }, _sum: { valor: true }, _count: { id: true } });
    const ids = top.map((x) => x.remetenteId);
    const users = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, perfil: { select: { nome: true } } } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return res.json({
      liveId,
      status: live.status,
      metaCreditos: live.metaCreditos == null ? null : Number(live.metaCreditos),
      arrecadadoBrutoCreditos: Number(total?._sum?.valor || 0),
      presentesQuantidade: Number(total?._count?.id || 0),
      ranking: top.map((row, i) => ({ posicao: i + 1, userId: row.remetenteId, nome: byId.get(row.remetenteId)?.perfil?.nome || "Usuário", creditos: Number(row._sum?.valor || 0) })),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar ranking", detalhe: e.message });
  }
}

export async function denunciarLive(req, res) {
  try {
    const denuncianteId = req.usuario.id;
    const liveId = req.params.id;
    const motivo = String(req.body?.motivo || "").trim().slice(0, 80);
    const descricao = String(req.body?.descricao || "").trim().slice(0, 2000) || null;
    if (motivo.length < 3) return res.status(400).json({ erro: "Informe o motivo da denúncia" });
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { id: true, hostId: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId === denuncianteId) return res.status(400).json({ erro: "Você não pode denunciar sua própria live" });
    const denuncia = await prisma.denuncia.create({
      data: { denuncianteId, denunciadoId: live.hostId, motivo, descricao, contextoTipo: "LIVE", contextoId: liveId, status: "ABERTA" },
    });
    req.app.get("io")?._dp?.emitToAdmins?.("admin:live:report", { liveId, denunciaId: denuncia.id });
    return res.status(201).json({ ok: true, denunciaId: denuncia.id });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao denunciar live", detalhe: e.message });
  }
}

export async function resumoLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { id: true, hostId: true, status: true, criadaEm: true, encerradaEm: true, metaCreditos: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId !== userId) return res.status(403).json({ erro: "Resumo disponível somente para a host" });
    const [viewersOnline, totalViewers, ganhos] = await Promise.all([
      prisma.liveViewer.count({ where: { liveId, saiuEm: null } }),
      prisma.liveViewer.count({ where: { liveId } }),
      ganhosDaLive(userId, liveId),
    ]);
    return res.json({ liveId, status: live.status, criadaEm: live.criadaEm, encerradaEm: live.encerradaEm, metaCreditos: live.metaCreditos, viewersOnline, totalViewers, ganhosCreditos: ganhos.creditos, eventosFinanceiros: ganhos.eventos, presentesBrutosCreditos: ganhos.presentesBrutosCreditos, presentesQuantidade: ganhos.presentesQuantidade, receitaPlataformaCreditos: ganhos.receitaPlataformaCreditos });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar resumo da live", detalhe: e.message });
  }
}

export async function encerrarLive(req, res) {
  try {
    const userId = req.usuario.id;
    const liveId = req.params.id;
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { hostId: true, status: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.hostId !== userId) return res.status(403).json({ erro: "Você não é a host desta live" });
    if (!isAtiva(live.status)) return res.json({ ok: true, status: live.status });
    await prisma.$transaction([
      prisma.live.update({ where: { id: liveId }, data: { status: "ENCERRADA", encerradaEm: new Date() } }),
      prisma.liveViewer.updateMany({ where: { liveId, saiuEm: null }, data: { saiuEm: new Date() } }),
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
