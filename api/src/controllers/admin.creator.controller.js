import { prisma } from "../prisma.js";
import { creatorCanBroadcast, idadeEmAnos, isAdult, isFemaleGender } from "../utils/creator.js";
import { publicFinanceConfig } from "../utils/creatorFinance.js";

async function logAcaoAdmin({ adminId, alvoId, tipo, motivo, detalhes }) {
  return prisma.acaoAdmin.create({
    data: { adminId, alvoId: alvoId || null, tipo, motivo: motivo || null, detalhes: detalhes || null },
  });
}

export async function dashboardOperacional(req, res) {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [livesAtivas, criadorasPendentes, saquesPendentes, receitaHoje, receitaTotal] = await Promise.all([
      prisma.live.count({ where: { status: "ATIVA" } }),
      prisma.usuario.count({ where: { creatorStatus: "PENDENTE" } }),
      prisma.creatorPayoutRequest.count({ where: { status: { in: ["PENDENTE", "APROVADO"] } } }),
      prisma.platformRevenue.aggregate({ where: { criadoEm: { gte: hoje } }, _sum: { valorCreditos: true } }),
      prisma.platformRevenue.aggregate({ _sum: { valorCreditos: true } }),
    ]);
    return res.json({
      livesAtivas,
      criadorasPendentes,
      saquesPendentes,
      receitaHojeCreditos: Number(receitaHoje?._sum?.valorCreditos || 0),
      receitaTotalCreditos: Number(receitaTotal?._sum?.valorCreditos || 0),
      configuracaoFinanceira: publicFinanceConfig(),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar dashboard operacional", detalhe: e.message });
  }
}

export async function listarCriadoras(req, res) {
  try {
    const status = String(req.query.status || "").toUpperCase();
    const where = status ? { creatorStatus: status } : { creatorStatus: { not: "NAO_SOLICITADO" } };
    const data = await prisma.usuario.findMany({
      where,
      orderBy: [{ creatorSolicitadoEm: "desc" }, { criadoEm: "desc" }],
      take: 200,
      select: {
        id: true,
        email: true,
        ativo: true,
        creatorStatus: true,
        creatorSolicitadoEm: true,
        creatorAprovadoEm: true,
        creatorBloqueadoEm: true,
        creatorMotivo: true,
        perfil: { select: { nome: true, genero: true, nascimento: true, verificado: true, cidade: true, estado: true } },
        wallet: { select: { saldoCreditos: true, saldoBloqueado: true } },
      },
    });
    return res.json({
      data: data.map((u) => ({
        ...u,
        idade: idadeEmAnos(u.perfil?.nascimento),
        podeTransmitir: creatorCanBroadcast(u),
      })),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar criadoras", detalhe: e.message });
  }
}

export async function atualizarCriadora(req, res) {
  try {
    const adminId = req.usuario.id;
    const userId = req.params.id;
    const status = String(req.body?.status || "").toUpperCase();
    const motivo = String(req.body?.motivo || "").trim().slice(0, 500) || null;
    const allowed = new Set(["PENDENTE", "APROVADA", "BLOQUEADA", "REPROVADA"]);
    if (!allowed.has(status)) return res.status(400).json({ erro: "status inválido" });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, creatorStatus: true, perfil: { select: { genero: true, nascimento: true } } },
    });
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });
    if (status === "APROVADA") {
      if (!isFemaleGender(u.perfil?.genero)) return res.status(400).json({ erro: "Perfil não é feminino" });
      if (!isAdult(u.perfil?.nascimento)) return res.status(400).json({ erro: "Perfil não possui idade mínima de 18 anos" });
    }

    const now = new Date();
    const livesParaEncerrar = ["BLOQUEADA", "REPROVADA"].includes(status)
      ? await prisma.live.findMany({ where: { hostId: userId, status: "ATIVA" }, select: { id: true } })
      : [];
    const liveIdsParaEncerrar = livesParaEncerrar.map((l) => l.id);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.update({
        where: { id: userId },
        data: {
          creatorStatus: status,
          creatorMotivo: motivo,
          creatorAprovadoEm: status === "APROVADA" ? now : status === "PENDENTE" ? null : undefined,
          creatorBloqueadoEm: status === "BLOQUEADA" ? now : null,
        },
        select: { id: true, creatorStatus: true, creatorAprovadoEm: true, creatorBloqueadoEm: true, creatorMotivo: true },
      });
      if (status === "APROVADA") {
        await tx.perfil.updateMany({ where: { usuarioId: userId }, data: { verificado: true } });
      }
      if (liveIdsParaEncerrar.length) {
        await tx.live.updateMany({ where: { id: { in: liveIdsParaEncerrar }, status: "ATIVA" }, data: { status: "ENCERRADA", encerradaEm: now } });
        await tx.liveViewer.updateMany({ where: { liveId: { in: liveIdsParaEncerrar }, saiuEm: null }, data: { saiuEm: now } });
      }
      return user;
    });

    await logAcaoAdmin({
      adminId,
      alvoId: userId,
      tipo: `CRIADORA_${status}`,
      motivo: motivo || `Conta criadora alterada para ${status}`,
      detalhes: `Status anterior: ${u.creatorStatus || "NAO_SOLICITADO"}`,
    });

    const io = req.app.get("io");
    io?._dp?.emitToUser(userId, "creator:status", { status });
    for (const liveId of liveIdsParaEncerrar) {
      io?.to(`live:${liveId}`).emit("live:ended", { liveId, motivo: "CRIADORA_BLOQUEADA" });
      io?.emit("live:list:update", { action: "ENDED", liveId });
    }
    return res.json({ ok: true, data: updated, livesEncerradas: liveIdsParaEncerrar.length });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar criadora", detalhe: e.message });
  }
}

export async function listarSaques(req, res) {
  try {
    const status = String(req.query.status || "").toUpperCase();
    const where = status ? { status } : {};
    const data = await prisma.creatorPayoutRequest.findMany({
      where,
      orderBy: { solicitadoEm: "desc" },
      take: 300,
      include: { user: { select: { id: true, email: true, perfil: { select: { nome: true } } } } },
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar saques", detalhe: e.message });
  }
}

export async function processarSaque(req, res) {
  try {
    const adminId = req.usuario.id;
    const id = req.params.id;
    const acao = String(req.body?.acao || "").toUpperCase();
    const observacao = String(req.body?.observacao || "").trim().slice(0, 1000) || null;
    if (!new Set(["APROVAR", "PAGAR", "RECUSAR"]).has(acao)) return res.status(400).json({ erro: "ação inválida" });

    const atual = await prisma.creatorPayoutRequest.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ erro: "Saque não encontrado" });

    let nextStatus;
    if (acao === "APROVAR") {
      if (atual.status !== "PENDENTE") return res.status(409).json({ erro: "Somente saque pendente pode ser aprovado" });
      nextStatus = "APROVADO";
    } else if (acao === "PAGAR") {
      if (!new Set(["PENDENTE", "APROVADO"]).has(atual.status)) return res.status(409).json({ erro: "Saque não pode ser marcado como pago" });
      nextStatus = "PAGO";
    } else {
      if (!new Set(["PENDENTE", "APROVADO"]).has(atual.status)) return res.status(409).json({ erro: "Saque não pode ser recusado" });
      nextStatus = "RECUSADO";
    }

    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.creatorPayoutRequest.updateMany({
        where: { id, status: atual.status },
        data: {
          status: nextStatus,
          observacao,
          processadoEm: nextStatus === "APROVADO" ? null : new Date(),
          processadoPorId: adminId,
        },
      });
      if (changed.count !== 1) throw new Error("Saque foi alterado por outro processo. Atualize a tela.");

      if (nextStatus === "RECUSADO") {
        await tx.wallet.update({
          where: { userId: atual.userId },
          data: {
            saldoBloqueado: { decrement: atual.valorCreditos },
            saldoCreditos: { increment: atual.valorCreditos },
          },
        });
      }
      if (nextStatus === "PAGO") {
        const wallet = await tx.wallet.findUnique({ where: { userId: atual.userId }, select: { saldoBloqueado: true } });
        if (Number(wallet?.saldoBloqueado || 0) < atual.valorCreditos) throw new Error("Saldo bloqueado inconsistente para este saque");
        await tx.wallet.update({
          where: { userId: atual.userId },
          data: { saldoBloqueado: { decrement: atual.valorCreditos } },
        });
      }
      return tx.creatorPayoutRequest.findUnique({ where: { id } });
    });

    await logAcaoAdmin({
      adminId,
      alvoId: atual.userId,
      tipo: `SAQUE_${nextStatus}`,
      motivo: observacao || `Saque ${id} -> ${nextStatus}`,
      detalhes: `${atual.valorCreditos} créditos / ${atual.valorCentavos} centavos`,
    });
    req.app.get("io")?._dp?.emitToUser(atual.userId, "creator:payout:update", { id, status: nextStatus });
    return res.json({ ok: true, data: result });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao processar saque", detalhe: e.message });
  }
}

export async function listarLivesAdmin(req, res) {
  try {
    const status = String(req.query.status || "ATIVA").toUpperCase();
    const where = status === "TODAS" ? {} : { status };
    const lives = await prisma.live.findMany({
      where,
      orderBy: { criadaEm: "desc" },
      take: 200,
      select: {
        id: true,
        titulo: true,
        metaCreditos: true,
        status: true,
        criadaEm: true,
        encerradaEm: true,
        hostId: true,
        host: { select: { email: true, creatorStatus: true, perfil: { select: { nome: true, verificado: true } } } },
        liveViewers: { where: { saiuEm: null }, select: { id: true } },
        _count: { select: { liveViewers: true } },
      },
    });
    const ids = lives.map((l) => l.id);
    const [receitas, gifts] = await Promise.all([
      ids.length ? prisma.platformRevenue.groupBy({ by: ["liveId"], where: { liveId: { in: ids } }, _sum: { valorCreditos: true } }) : [],
      ids.length ? prisma.giftCredito.groupBy({ by: ["refId"], where: { refTipo: "LIVE", refId: { in: ids } }, _sum: { valor: true } }) : [],
    ]);
    const feeMap = new Map(receitas.map((x) => [x.liveId, Number(x._sum?.valorCreditos || 0)]));
    const giftMap = new Map(gifts.map((x) => [x.refId, Number(x._sum?.valor || 0)]));
    return res.json({
      data: lives.map((l) => ({
        ...l,
        viewersOnline: l.liveViewers.length,
        totalViewers: l._count.liveViewers,
        presentesBrutosCreditos: giftMap.get(l.id) || 0,
        receitaPlataformaCreditos: feeMap.get(l.id) || 0,
        liveViewers: undefined,
        _count: undefined,
      })),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar lives", detalhe: e.message });
  }
}

export async function encerrarLiveAdmin(req, res) {
  try {
    const adminId = req.usuario.id;
    const liveId = req.params.id;
    const motivo = String(req.body?.motivo || "Encerrada pela moderação").trim().slice(0, 500);
    const live = await prisma.live.findUnique({ where: { id: liveId }, select: { id: true, hostId: true, status: true } });
    if (!live) return res.status(404).json({ erro: "Live não encontrada" });
    if (live.status !== "ATIVA") return res.json({ ok: true, status: live.status });
    await prisma.$transaction([
      prisma.live.update({ where: { id: liveId }, data: { status: "ENCERRADA", encerradaEm: new Date() } }),
      prisma.liveViewer.updateMany({ where: { liveId, saiuEm: null }, data: { saiuEm: new Date() } }),
    ]);
    await logAcaoAdmin({ adminId, alvoId: live.hostId, tipo: "LIVE_ENCERRADA_ADMIN", motivo, detalhes: `Live ${liveId}` });
    const io = req.app.get("io");
    io?.to(`live:${liveId}`).emit("live:ended", { liveId, motivo: "MODERACAO", mensagem: motivo });
    io?.emit("live:list:update", { action: "ENDED", liveId });
    return res.json({ ok: true, status: "ENCERRADA" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao encerrar live", detalhe: e.message });
  }
}
