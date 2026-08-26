import { prisma } from "../prisma.js";
import { creatorCanBroadcast, idadeEmAnos, isAdult, isFemaleGender } from "../utils/creator.js";
import {
  creditsToCentavos,
  maxPayoutCredits,
  minPayoutCredits,
  publicFinanceConfig,
} from "../utils/creatorFinance.js";

const ALLOWED_PIX_TYPES = new Set(["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]);

async function getCreatorUser(userId) {
  return prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      ativo: true,
      creatorStatus: true,
      creatorSolicitadoEm: true,
      creatorAprovadoEm: true,
      creatorBloqueadoEm: true,
      creatorMotivo: true,
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

export async function statusCriadora(req, res) {
  try {
    const u = await getCreatorUser(req.usuario.id);
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });
    const idade = idadeEmAnos(u.perfil?.nascimento);
    return res.json({
      id: u.id,
      nome: u.perfil?.nome || "",
      creatorStatus: u.creatorStatus || "NAO_SOLICITADO",
      creatorSolicitadoEm: u.creatorSolicitadoEm,
      creatorAprovadoEm: u.creatorAprovadoEm,
      creatorBloqueadoEm: u.creatorBloqueadoEm,
      creatorMotivo: u.creatorMotivo,
      perfilVerificado: !!u.perfil?.verificado,
      genero: u.perfil?.genero || null,
      idade,
      maiorDe18: Number.isInteger(idade) && idade >= 18,
      elegivelParaSolicitar: !!u.ativo && isFemaleGender(u.perfil?.genero) && isAdult(u.perfil?.nascimento),
      podeTransmitir: creatorCanBroadcast(u),
      carteira: {
        disponivel: Number(u.wallet?.saldoCreditos || 0),
        bloqueado: Number(u.wallet?.saldoBloqueado || 0),
      },
      configuracaoFinanceira: publicFinanceConfig(),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar status da criadora", detalhe: e.message });
  }
}

export async function solicitarAprovacaoCriadora(req, res) {
  try {
    const userId = req.usuario.id;
    const u = await getCreatorUser(userId);
    if (!u?.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
    if (!u.perfil) return res.status(400).json({ erro: "Complete seu perfil antes de solicitar aprovação" });
    if (!isFemaleGender(u.perfil.genero)) {
      return res.status(403).json({ erro: "A solicitação de conta criadora está disponível para perfis femininos" });
    }
    if (!isAdult(u.perfil.nascimento)) {
      return res.status(403).json({ erro: "É obrigatório ter 18 anos ou mais" });
    }
    const status = String(u.creatorStatus || "NAO_SOLICITADO").toUpperCase();
    if (status === "APROVADA" || u.perfil.verificado) {
      return res.json({ ok: true, creatorStatus: "APROVADA", mensagem: "Conta de criadora já aprovada" });
    }
    if (status === "PENDENTE") {
      return res.json({ ok: true, creatorStatus: "PENDENTE", mensagem: "Solicitação já está em análise" });
    }

    const updated = await prisma.usuario.update({
      where: { id: userId },
      data: {
        creatorStatus: "PENDENTE",
        creatorSolicitadoEm: new Date(),
        creatorBloqueadoEm: null,
        creatorMotivo: null,
      },
      select: { creatorStatus: true, creatorSolicitadoEm: true },
    });
    return res.status(201).json({ ok: true, ...updated });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao solicitar aprovação", detalhe: e.message });
  }
}

export async function financeiroCriadora(req, res) {
  try {
    const userId = req.usuario.id;
    const u = await getCreatorUser(userId);
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });

    const liveOrigins = ["LIVE_MINUTO", "LIVE_PRESENTE_RECEBIDO", "LIVE_GORJETA_RECEBIDA", "LIVE"];
    const [ganhos, saques, lives, topRaw] = await Promise.all([
      prisma.walletTx.aggregate({
        where: { userId, tipo: { in: ["CREDIT", "CREDITO"] }, origem: { in: liveOrigins } },
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.creatorPayoutRequest.findMany({
        where: { userId },
        orderBy: { solicitadoEm: "desc" },
        take: 20,
      }),
      prisma.live.findMany({
        where: { hostId: userId },
        orderBy: { criadaEm: "desc" },
        take: 10,
        select: {
          id: true,
          titulo: true,
          status: true,
          criadaEm: true,
          encerradaEm: true,
          metaCreditos: true,
          _count: { select: { liveViewers: true } },
        },
      }),
      prisma.giftCredito.groupBy({
        by: ["remetenteId"],
        where: { destinatarioId: userId, refTipo: "LIVE" },
        _sum: { valor: true },
        orderBy: { _sum: { valor: "desc" } },
        take: 5,
      }),
    ]);

    const ids = topRaw.map((x) => x.remetenteId);
    const supporters = ids.length ? await prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, perfil: { select: { nome: true } } },
    }) : [];
    const byId = new Map(supporters.map((x) => [x.id, x]));

    return res.json({
      creatorStatus: u.creatorStatus,
      podeTransmitir: creatorCanBroadcast(u),
      carteira: {
        disponivel: Number(u.wallet?.saldoCreditos || 0),
        bloqueado: Number(u.wallet?.saldoBloqueado || 0),
        total: Number(u.wallet?.saldoCreditos || 0) + Number(u.wallet?.saldoBloqueado || 0),
      },
      ganhos: {
        creditos: Number(ganhos?._sum?.valor || 0),
        eventos: Number(ganhos?._count?.id || 0),
        valorCentavosEstimado: creditsToCentavos(ganhos?._sum?.valor || 0),
      },
      configuracao: publicFinanceConfig(),
      saques,
      lives: lives.map((l) => ({ ...l, totalViewers: l._count.liveViewers, _count: undefined })),
      topApoiadores: topRaw.map((row) => ({
        userId: row.remetenteId,
        nome: byId.get(row.remetenteId)?.perfil?.nome || "Usuário",
        creditos: Number(row._sum?.valor || 0),
      })),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar financeiro da criadora", detalhe: e.message });
  }
}

export async function solicitarSaque(req, res) {
  try {
    const userId = req.usuario.id;
    const valorCreditos = Math.trunc(Number(req.body?.valorCreditos));
    const chavePix = String(req.body?.chavePix || "").trim().slice(0, 180);
    const tipoChavePix = String(req.body?.tipoChavePix || "").trim().toUpperCase();

    const u = await getCreatorUser(userId);
    if (!creatorCanBroadcast(u)) return res.status(403).json({ erro: "Conta de criadora não está aprovada" });
    if (!Number.isInteger(valorCreditos) || valorCreditos < minPayoutCredits() || valorCreditos > maxPayoutCredits()) {
      return res.status(400).json({
        erro: `Saque deve ficar entre ${minPayoutCredits()} e ${maxPayoutCredits()} créditos`,
      });
    }
    if (!chavePix) return res.status(400).json({ erro: "chavePix é obrigatória" });
    if (!ALLOWED_PIX_TYPES.has(tipoChavePix)) return res.status(400).json({ erro: "tipoChavePix inválido" });

    const result = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId, saldoCreditos: 0, saldoBloqueado: 0 } });
      const moved = await tx.wallet.updateMany({
        where: { userId, saldoCreditos: { gte: valorCreditos } },
        data: {
          saldoCreditos: { decrement: valorCreditos },
          saldoBloqueado: { increment: valorCreditos },
        },
      });
      if (moved.count !== 1) {
        const err = new Error("Saldo insuficiente");
        err.code = "SALDO_INSUFICIENTE";
        throw err;
      }
      const saque = await tx.creatorPayoutRequest.create({
        data: {
          userId,
          valorCreditos,
          valorCentavos: creditsToCentavos(valorCreditos),
          chavePix,
          tipoChavePix,
          status: "PENDENTE",
        },
      });
      const wallet = await tx.wallet.findUnique({ where: { userId }, select: { saldoCreditos: true, saldoBloqueado: true } });
      return { saque, wallet };
    });

    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    if (e?.code === "SALDO_INSUFICIENTE") return res.status(402).json({ erro: "Saldo insuficiente para solicitar este saque" });
    return res.status(500).json({ erro: "Erro ao solicitar saque", detalhe: e.message });
  }
}

export async function listarMeusSaques(req, res) {
  try {
    const data = await prisma.creatorPayoutRequest.findMany({
      where: { userId: req.usuario.id },
      orderBy: { solicitadoEm: "desc" },
      take: 100,
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar saques", detalhe: e.message });
  }
}
