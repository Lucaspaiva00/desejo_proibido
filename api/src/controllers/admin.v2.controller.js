import { prisma } from "../prisma.js";
import { idadeEmAnos } from "../utils/creator.js";
import { publicFinanceConfig } from "../utils/creatorFinance.js";

const PAID_STATUSES = ["approved", "APPROVED", "APROVADO", "PAGO", "paid", "PAID"];

function int(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function clamp(v, min, max, fallback) {
  return Math.min(max, Math.max(min, int(v, fallback)));
}
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysAgo(n) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}
function dateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function makeDailySeries(days = 30) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    out.push({ data: dateKey(d), valor: 0 });
  }
  return out;
}
function bucketSeries(items, field, days = 30) {
  const series = makeDailySeries(days);
  const map = new Map(series.map((x) => [x.data, x]));
  for (const item of items || []) {
    const key = dateKey(item[field]);
    if (map.has(key)) map.get(key).valor += 1;
  }
  return series;
}
function bucketValueSeries(items, dateField, valueField, days = 30) {
  const series = makeDailySeries(days);
  const map = new Map(series.map((x) => [x.data, x]));
  for (const item of items || []) {
    const key = dateKey(item[dateField]);
    if (map.has(key)) map.get(key).valor += Number(item[valueField] || 0);
  }
  return series;
}
async function logAcaoAdmin({ adminId, alvoId = null, tipo, motivo = null, detalhes = null }) {
  return prisma.acaoAdmin.create({ data: { adminId, alvoId, tipo, motivo, detalhes } });
}

export async function dashboardV2(req, res) {
  try {
    const hoje = startOfDay();
    const mes = startOfMonth();
    const inicio30 = daysAgo(29);

    const [
      usuariosTotal, usuariosHoje, usuariosMes, premium, perfisGenero,
      criadorasAprovadas, criadorasPendentes, livesAtivas, viewersOnline,
      denunciasAbertas, saquesPendentes, saquesPendentesValor,
      receitaHoje, receitaMes, receitaTotal, pagamentosMes,
      giftsMes, users30, revenue30, ultimasAcoes, ultimasLives,
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { criadoEm: { gte: hoje } } }),
      prisma.usuario.count({ where: { criadoEm: { gte: mes } } }),
      prisma.usuario.count({ where: { isPremium: true } }),
      prisma.perfil.groupBy({ by: ["genero"], _count: { _all: true } }),
      prisma.usuario.count({ where: { creatorStatus: "APROVADA" } }),
      prisma.usuario.count({ where: { creatorStatus: "PENDENTE" } }),
      prisma.live.count({ where: { status: "ATIVA" } }),
      prisma.liveViewer.count({ where: { saiuEm: null } }),
      prisma.denuncia.count({ where: { status: { in: ["ABERTA", "EM_ANALISE"] } } }),
      prisma.creatorPayoutRequest.count({ where: { status: { in: ["PENDENTE", "APROVADO"] } } }),
      prisma.creatorPayoutRequest.aggregate({ where: { status: { in: ["PENDENTE", "APROVADO"] } }, _sum: { valorCentavos: true } }),
      prisma.platformRevenue.aggregate({ where: { criadoEm: { gte: hoje } }, _sum: { valorCreditos: true } }),
      prisma.platformRevenue.aggregate({ where: { criadoEm: { gte: mes } }, _sum: { valorCreditos: true } }),
      prisma.platformRevenue.aggregate({ _sum: { valorCreditos: true } }),
      prisma.pagamento.aggregate({ where: { criadoEm: { gte: mes }, status: { in: PAID_STATUSES } }, _sum: { valorCentavos: true }, _count: { _all: true } }),
      prisma.giftCredito.aggregate({ where: { criadoEm: { gte: mes } }, _sum: { valor: true }, _count: { _all: true } }),
      prisma.usuario.findMany({ where: { criadoEm: { gte: inicio30 } }, select: { criadoEm: true } }),
      prisma.platformRevenue.findMany({ where: { criadoEm: { gte: inicio30 } }, select: { criadoEm: true, valorCreditos: true } }),
      prisma.acaoAdmin.findMany({ orderBy: { criadoEm: "desc" }, take: 8, include: { admin: { select: { email: true } }, alvo: { select: { id: true, email: true, perfil: { select: { nome: true } } } } } }),
      prisma.live.findMany({ orderBy: { criadaEm: "desc" }, take: 8, select: { id: true, titulo: true, status: true, criadaEm: true, host: { select: { id: true, perfil: { select: { nome: true } } } }, liveViewers: { where: { saiuEm: null }, select: { id: true } } } }),
    ]);

    const genero = { feminino: 0, masculino: 0, outros: 0 };
    for (const row of perfisGenero) {
      const g = String(row.genero || "").trim().toUpperCase();
      const c = Number(row._count?._all || 0);
      if (["F", "FEMININO", "FEMALE", "MULHER"].includes(g)) genero.feminino += c;
      else if (["M", "MASCULINO", "MALE", "HOMEM"].includes(g)) genero.masculino += c;
      else genero.outros += c;
    }

    return res.json({
      usuarios: { total: usuariosTotal, hoje: usuariosHoje, mes: usuariosMes, premium, ...genero },
      criadoras: { aprovadas: criadorasAprovadas, pendentes: criadorasPendentes },
      operacao: { livesAtivas, viewersOnline, denunciasAbertas },
      financeiro: {
        receitaHojeCreditos: Number(receitaHoje?._sum?.valorCreditos || 0),
        receitaMesCreditos: Number(receitaMes?._sum?.valorCreditos || 0),
        receitaTotalCreditos: Number(receitaTotal?._sum?.valorCreditos || 0),
        pagamentosMesCentavos: Number(pagamentosMes?._sum?.valorCentavos || 0),
        pagamentosMesQtd: Number(pagamentosMes?._count?._all || 0),
        giftsMesCreditos: Number(giftsMes?._sum?.valor || 0),
        giftsMesQtd: Number(giftsMes?._count?._all || 0),
        saquesPendentes,
        saquesPendentesCentavos: Number(saquesPendentesValor?._sum?.valorCentavos || 0),
      },
      series: {
        novosUsuarios30d: bucketSeries(users30, "criadoEm"),
        receitaPlataforma30d: bucketValueSeries(revenue30, "criadoEm", "valorCreditos"),
      },
      ultimasAcoes,
      ultimasLives: ultimasLives.map((l) => ({ ...l, viewersOnline: l.liveViewers.length, liveViewers: undefined })),
      configuracaoFinanceira: publicFinanceConfig(),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar Dashboard 2.0", detalhe: e.message });
  }
}

export async function listarUsuariosV2(req, res) {
  try {
    const page = Math.max(1, int(req.query.page, 1));
    const limit = clamp(req.query.limit, 10, 100, 25);
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const genero = String(req.query.genero || "").trim();
    const plano = String(req.query.plano || "").trim();
    const creatorStatus = String(req.query.creatorStatus || "").trim().toUpperCase();
    const ativo = String(req.query.ativo || "").trim().toLowerCase();
    const premium = String(req.query.premium || "").trim().toLowerCase();

    const AND = [];
    if (q) AND.push({ OR: [
      { email: { contains: q, mode: "insensitive" } },
      { perfil: { is: { nome: { contains: q, mode: "insensitive" } } } },
      { perfil: { is: { cidade: { contains: q, mode: "insensitive" } } } },
    ] });
    if (genero) AND.push({ perfil: { is: { genero: { equals: genero, mode: "insensitive" } } } });
    if (plano) AND.push({ plano });
    if (creatorStatus) AND.push({ creatorStatus });
    if (["true", "false"].includes(ativo)) AND.push({ ativo: ativo === "true" });
    if (["true", "false"].includes(premium)) AND.push({ isPremium: premium === "true" });
    const where = AND.length ? { AND } : {};

    const [total, data] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where, skip, take: limit, orderBy: { criadoEm: "desc" },
        select: {
          id: true, email: true, ativo: true, role: true, plano: true, isPremium: true,
          emailVerificado: true, minutosDisponiveis: true, creatorStatus: true, criadoEm: true,
          perfil: { select: { nome: true, genero: true, nascimento: true, verificado: true, cidade: true, estado: true } },
          wallet: { select: { saldoCreditos: true, saldoBloqueado: true } },
          banGlobal: { select: { ativo: true, motivo: true, ate: true } },
          _count: { select: { denunciasRecebidas: true, lives: true } },
        },
      }),
    ]);

    return res.json({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), data: data.map((u) => ({ ...u, idade: idadeEmAnos(u.perfil?.nascimento) })) });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar usuários", detalhe: e.message });
  }
}

export async function detalheUsuarioV2(req, res) {
  try {
    const id = req.params.id;
    const user = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true, email: true, ativo: true, role: true, plano: true, isPremium: true,
        emailVerificado: true, emailVerificadoEm: true, minutosDisponiveis: true,
        creatorStatus: true, creatorSolicitadoEm: true, creatorAprovadoEm: true, creatorBloqueadoEm: true, creatorMotivo: true,
        criadoEm: true, atualizadoEm: true, perfil: true, fotos: { orderBy: [{ principal: "desc" }, { criadoEm: "desc" }] },
        wallet: true, banGlobal: true,
        _count: { select: { denunciasRecebidas: true, denunciasFeitas: true, lives: true, pagamentos: true, mensagems: true, giftsEnviados: true, giftsRecebidos: true } },
      },
    });
    if (!user) return res.status(404).json({ erro: "Usuário não encontrado" });

    const [pagamentos, transacoes, denuncias, lives, saques, acoes] = await Promise.all([
      prisma.pagamento.findMany({ where: { usuarioId: id }, orderBy: { criadoEm: "desc" }, take: 15 }),
      prisma.walletTx.findMany({ where: { userId: id }, orderBy: { criadoEm: "desc" }, take: 30 }),
      prisma.denuncia.findMany({ where: { denunciadoId: id }, orderBy: { criadoEm: "desc" }, take: 15, select: { id: true, motivo: true, contextoTipo: true, status: true, criadoEm: true, denunciante: { select: { email: true } } } }),
      prisma.live.findMany({ where: { hostId: id }, orderBy: { criadaEm: "desc" }, take: 15, select: { id: true, titulo: true, status: true, criadaEm: true, encerradaEm: true, metaCreditos: true, _count: { select: { liveViewers: true } } } }),
      prisma.creatorPayoutRequest.findMany({ where: { userId: id }, orderBy: { solicitadoEm: "desc" }, take: 15 }),
      prisma.acaoAdmin.findMany({ where: { alvoId: id }, orderBy: { criadoEm: "desc" }, take: 20, include: { admin: { select: { email: true } } } }),
    ]);

    return res.json({ user: { ...user, idade: idadeEmAnos(user.perfil?.nascimento) }, pagamentos, transacoes, denuncias, lives, saques, acoes });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar ficha do usuário", detalhe: e.message });
  }
}

export async function acaoUsuarioV2(req, res) {
  try {
    const adminId = req.usuario.id;
    const id = req.params.id;
    const acao = String(req.body?.acao || "").trim().toUpperCase();
    const motivo = String(req.body?.motivo || "").trim().slice(0, 500) || null;
    const valor = Math.abs(int(req.body?.valor, 0));
    const plano = String(req.body?.plano || "").trim().toUpperCase().slice(0, 40);

    if (id === adminId && ["DESATIVAR", "BANIR"].includes(acao)) return res.status(400).json({ erro: "Você não pode desativar sua própria conta administrativa" });
    const atual = await prisma.usuario.findUnique({ where: { id }, select: { id: true, email: true, role: true, minutosDisponiveis: true, wallet: true, perfil: { select: { verificado: true } } } });
    if (!atual) return res.status(404).json({ erro: "Usuário não encontrado" });

    let detalhes = null;
    await prisma.$transaction(async (tx) => {
      if (acao === "ATIVAR" || acao === "DESATIVAR") {
        await tx.usuario.update({ where: { id }, data: { ativo: acao === "ATIVAR" } });
        detalhes = `ativo=${acao === "ATIVAR"}`;
      } else if (acao === "VERIFICAR" || acao === "DESVERIFICAR") {
        await tx.perfil.updateMany({ where: { usuarioId: id }, data: { verificado: acao === "VERIFICAR" } });
        detalhes = `perfil.verificado=${acao === "VERIFICAR"}`;
      } else if (acao === "PREMIUM_ATIVAR" || acao === "PREMIUM_REMOVER") {
        await tx.usuario.update({ where: { id }, data: { isPremium: acao === "PREMIUM_ATIVAR", plano: acao === "PREMIUM_ATIVAR" && atual.role !== "ADMIN" ? "PREMIUM" : undefined } });
        detalhes = `premium=${acao === "PREMIUM_ATIVAR"}`;
      } else if (acao === "ALTERAR_PLANO") {
        if (!plano) throw Object.assign(new Error("Informe o plano"), { status: 400 });
        await tx.usuario.update({ where: { id }, data: { plano, isPremium: plano !== "FREE" } });
        detalhes = `plano=${plano}`;
      } else if (["CREDITOS_ADICIONAR", "CREDITOS_REMOVER"].includes(acao)) {
        if (valor <= 0) throw Object.assign(new Error("Informe um valor de créditos maior que zero"), { status: 400 });
        await tx.wallet.upsert({ where: { userId: id }, update: {}, create: { userId: id, saldoCreditos: 0, saldoBloqueado: 0 } });
        const wallet = await tx.wallet.findUnique({ where: { userId: id }, select: { saldoCreditos: true } });
        const delta = acao === "CREDITOS_ADICIONAR" ? valor : -valor;
        if (Number(wallet?.saldoCreditos || 0) + delta < 0) throw Object.assign(new Error("Saldo de créditos insuficiente para a remoção"), { status: 409 });
        await tx.wallet.update({ where: { userId: id }, data: { saldoCreditos: { increment: delta } } });
        await tx.walletTx.create({ data: { userId: id, tipo: delta > 0 ? "CREDIT" : "DEBIT", origem: "ADMIN_AJUSTE", valor: Math.abs(delta), refId: adminId } });
        detalhes = `ajusteCreditos=${delta}`;
      } else if (["MINUTOS_ADICIONAR", "MINUTOS_REMOVER"].includes(acao)) {
        if (valor <= 0) throw Object.assign(new Error("Informe um valor de minutos maior que zero"), { status: 400 });
        const delta = acao === "MINUTOS_ADICIONAR" ? valor : -valor;
        if (Number(atual.minutosDisponiveis || 0) + delta < 0) throw Object.assign(new Error("Saldo de minutos insuficiente para a remoção"), { status: 409 });
        await tx.usuario.update({ where: { id }, data: { minutosDisponiveis: { increment: delta } } });
        await tx.creditoMinuto.create({ data: { usuarioId: id, tipo: delta > 0 ? "CREDITO" : "DEBITO", minutos: delta, refTipo: "ADMIN", refId: adminId, detalhes: motivo || "Ajuste administrativo" } });
        detalhes = `ajusteMinutos=${delta}`;
      } else {
        throw Object.assign(new Error("Ação administrativa inválida"), { status: 400 });
      }
    });

    await logAcaoAdmin({ adminId, alvoId: id, tipo: `USUARIO_${acao}`, motivo: motivo || `Ação ${acao}`, detalhes });
    req.app.get("io")?._dp?.emitToUser(id, "admin:account:update", { acao });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(e?.status || 500).json({ erro: e.message || "Erro na ação administrativa" });
  }
}

export async function financeiroV2(req, res) {
  try {
    const hoje = startOfDay();
    const mes = startOfMonth();
    const inicio30 = daysAgo(29);
    const [receitaHoje, receitaMes, receitaTotal, pagamentosHoje, pagamentosMes, pagamentosTotal, giftsMes, payoutPend, payoutPagoMes, revenue30, pagamentosRecentes, receitasRecentes] = await Promise.all([
      prisma.platformRevenue.aggregate({ where: { criadoEm: { gte: hoje } }, _sum: { valorCreditos: true } }),
      prisma.platformRevenue.aggregate({ where: { criadoEm: { gte: mes } }, _sum: { valorCreditos: true } }),
      prisma.platformRevenue.aggregate({ _sum: { valorCreditos: true } }),
      prisma.pagamento.aggregate({ where: { criadoEm: { gte: hoje }, status: { in: PAID_STATUSES } }, _sum: { valorCentavos: true }, _count: { _all: true } }),
      prisma.pagamento.aggregate({ where: { criadoEm: { gte: mes }, status: { in: PAID_STATUSES } }, _sum: { valorCentavos: true }, _count: { _all: true } }),
      prisma.pagamento.aggregate({ where: { status: { in: PAID_STATUSES } }, _sum: { valorCentavos: true }, _count: { _all: true } }),
      prisma.giftCredito.aggregate({ where: { criadoEm: { gte: mes } }, _sum: { valor: true }, _count: { _all: true } }),
      prisma.creatorPayoutRequest.aggregate({ where: { status: { in: ["PENDENTE", "APROVADO"] } }, _sum: { valorCentavos: true, valorCreditos: true }, _count: { _all: true } }),
      prisma.creatorPayoutRequest.aggregate({ where: { status: "PAGO", processadoEm: { gte: mes } }, _sum: { valorCentavos: true, valorCreditos: true }, _count: { _all: true } }),
      prisma.platformRevenue.findMany({ where: { criadoEm: { gte: inicio30 } }, select: { criadoEm: true, valorCreditos: true } }),
      prisma.pagamento.findMany({ orderBy: { criadoEm: "desc" }, take: 12, include: { usuario: { select: { email: true, perfil: { select: { nome: true } } } } } }),
      prisma.platformRevenue.findMany({ orderBy: { criadoEm: "desc" }, take: 12 }),
    ]);
    return res.json({
      receita: { hojeCreditos: Number(receitaHoje?._sum?.valorCreditos || 0), mesCreditos: Number(receitaMes?._sum?.valorCreditos || 0), totalCreditos: Number(receitaTotal?._sum?.valorCreditos || 0) },
      pagamentos: { hojeCentavos: Number(pagamentosHoje?._sum?.valorCentavos || 0), hojeQtd: Number(pagamentosHoje?._count?._all || 0), mesCentavos: Number(pagamentosMes?._sum?.valorCentavos || 0), mesQtd: Number(pagamentosMes?._count?._all || 0), totalCentavos: Number(pagamentosTotal?._sum?.valorCentavos || 0), totalQtd: Number(pagamentosTotal?._count?._all || 0) },
      presentes: { mesCreditos: Number(giftsMes?._sum?.valor || 0), mesQtd: Number(giftsMes?._count?._all || 0) },
      saques: { pendentesCentavos: Number(payoutPend?._sum?.valorCentavos || 0), pendentesCreditos: Number(payoutPend?._sum?.valorCreditos || 0), pendentesQtd: Number(payoutPend?._count?._all || 0), pagosMesCentavos: Number(payoutPagoMes?._sum?.valorCentavos || 0), pagosMesQtd: Number(payoutPagoMes?._count?._all || 0) },
      serieReceita30d: bucketValueSeries(revenue30, "criadoEm", "valorCreditos"),
      pagamentosRecentes, receitasRecentes, configuracao: publicFinanceConfig(),
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar financeiro", detalhe: e.message });
  }
}

export async function listarTransacoesV2(req, res) {
  try {
    const page = Math.max(1, int(req.query.page, 1));
    const limit = clamp(req.query.limit, 10, 100, 30);
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const origem = String(req.query.origem || "").trim();
    const tipo = String(req.query.tipo || "").trim().toUpperCase();
    const AND = [];
    if (origem) AND.push({ origem: { contains: origem, mode: "insensitive" } });
    if (tipo) AND.push({ tipo });
    if (q) AND.push({ user: { is: { email: { contains: q, mode: "insensitive" } } } });
    const where = AND.length ? { AND } : {};
    const [total, data] = await Promise.all([
      prisma.walletTx.count({ where }),
      prisma.walletTx.findMany({ where, skip, take: limit, orderBy: { criadoEm: "desc" }, include: { user: { select: { id: true, email: true, perfil: { select: { nome: true } } } } } }),
    ]);
    return res.json({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), data });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar transações", detalhe: e.message });
  }
}

export async function listarPagamentosV2(req, res) {
  try {
    const page = Math.max(1, int(req.query.page, 1));
    const limit = clamp(req.query.limit, 10, 100, 30);
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const AND = [];
    if (status) AND.push({ status });
    if (q) AND.push({ OR: [{ mpPaymentId: { contains: q } }, { mpOrderId: { contains: q } }, { usuario: { is: { email: { contains: q, mode: "insensitive" } } } }] });
    const where = AND.length ? { AND } : {};
    const [total, data] = await Promise.all([
      prisma.pagamento.count({ where }),
      prisma.pagamento.findMany({ where, skip, take: limit, orderBy: { criadoEm: "desc" }, include: { usuario: { select: { id: true, email: true, perfil: { select: { nome: true } } } } } }),
    ]);
    return res.json({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), data });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar pagamentos", detalhe: e.message });
  }
}

export async function listarPresentesV2(req, res) {
  try {
    const data = await prisma.presente.findMany({ orderBy: [{ ativo: "desc" }, { custoCreditos: "asc" }, { nome: "asc" }] });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar presentes", detalhe: e.message });
  }
}

export async function criarPresenteV2(req, res) {
  try {
    const adminId = req.usuario.id;
    const nome = String(req.body?.nome || "").trim().slice(0, 80);
    const custoCreditos = clamp(req.body?.custoCreditos, 0, 100000000, 0);
    const minutos = clamp(req.body?.minutos, 0, 1000000, 0);
    const imagemUrl = String(req.body?.imagemUrl || "").trim().slice(0, 500) || null;
    if (!nome) return res.status(400).json({ erro: "Nome é obrigatório" });
    const data = await prisma.presente.create({ data: { nome, custoCreditos, minutos, imagemUrl, ativo: true } });
    await logAcaoAdmin({ adminId, tipo: "PRESENTE_CRIADO", motivo: nome, detalhes: `${custoCreditos} créditos` });
    return res.status(201).json({ ok: true, data });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ erro: "Já existe presente com esse nome" });
    return res.status(500).json({ erro: "Erro ao criar presente", detalhe: e.message });
  }
}

export async function atualizarPresenteV2(req, res) {
  try {
    const adminId = req.usuario.id;
    const id = req.params.id;
    const atual = await prisma.presente.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ erro: "Presente não encontrado" });
    const dataUpdate = {};
    if (req.body?.nome !== undefined) dataUpdate.nome = String(req.body.nome || "").trim().slice(0, 80);
    if (req.body?.custoCreditos !== undefined) dataUpdate.custoCreditos = clamp(req.body.custoCreditos, 0, 100000000, atual.custoCreditos);
    if (req.body?.minutos !== undefined) dataUpdate.minutos = clamp(req.body.minutos, 0, 1000000, atual.minutos);
    if (req.body?.imagemUrl !== undefined) dataUpdate.imagemUrl = String(req.body.imagemUrl || "").trim().slice(0, 500) || null;
    if (req.body?.ativo !== undefined) dataUpdate.ativo = !!req.body.ativo;
    if (dataUpdate.nome === "") return res.status(400).json({ erro: "Nome não pode ficar vazio" });
    const data = await prisma.presente.update({ where: { id }, data: dataUpdate });
    await logAcaoAdmin({ adminId, tipo: "PRESENTE_ATUALIZADO", motivo: data.nome, detalhes: JSON.stringify(dataUpdate) });
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ erro: "Já existe presente com esse nome" });
    return res.status(500).json({ erro: "Erro ao atualizar presente", detalhe: e.message });
  }
}

export async function configuracoesV2(req, res) {
  try {
    return res.json({
      monetizacao: publicFinanceConfig(),
      live: {
        creditosPorMinuto: clamp(process.env.LIVE_CREDITOS_POR_MINUTO, 0, 100000, 1),
        maxGorjetaCreditos: clamp(process.env.LIVE_MAX_GORJETA_CREDITOS, 1, 2000000000, 100000),
        maxMetaCreditos: clamp(process.env.LIVE_MAX_META_CREDITOS, 1, 2000000000, 100000000),
      },
      infraestrutura: {
        nodeEnv: process.env.NODE_ENV || "development",
        deployAutomaticoConfigurado: String(process.env.DEPLOY_AUTOMATICO || "").toLowerCase() === "true",
      },
      aviso: "Parâmetros comerciais sensíveis são exibidos aqui, mas continuam configurados por variáveis de ambiente para evitar alteração acidental em produção.",
    });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao carregar configurações", detalhe: e.message });
  }
}
