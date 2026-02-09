import { prisma } from "../prisma.js";

export async function feed(req, res) {
  const meuId = req.usuario.id;
  // ✅ normaliza flags expiradas globalmente (evita invisível eterno)
  await prisma.usuario.updateMany({
    where: {
      invisivelAte: { not: null, lte: new Date() },
      isInvisivel: true,
    },
    data: { isInvisivel: false, invisivelAte: null },
  });

  await prisma.usuario.updateMany({
    where: { boostAte: { not: null, lte: new Date() } },
    data: { boostAte: null },
  });
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const skip = (page - 1) * limit;

  const now = new Date();

  // já curti
  const curtidos = await prisma.curtida.findMany({
    where: { deUsuarioId: meuId },
    select: { paraUsuarioId: true },
  });
  const idsCurtidos = curtidos.map((c) => c.paraUsuarioId);

  // já pulei
  const pulados = await prisma.skip.findMany({
    where: { deUsuarioId: meuId },
    select: { paraUsuarioId: true },
  });
  const idsPulados = pulados.map((s) => s.paraUsuarioId);

  // bloqueios (quem eu bloqueei e quem me bloqueou)
  const bloqueiosEnviados = await prisma.bloqueio.findMany({
    where: { deUsuarioId: meuId },
    select: { paraUsuarioId: true },
  });
  const bloqueiosRecebidos = await prisma.bloqueio.findMany({
    where: { paraUsuarioId: meuId },
    select: { deUsuarioId: true },
  });

  const idsBloqueados = bloqueiosEnviados.map((b) => b.paraUsuarioId);
  const idsQueMeBloquearam = bloqueiosRecebidos.map((b) => b.deUsuarioId);

  // já é match
  const matches = await prisma.match.findMany({
    where: { OR: [{ usuarioAId: meuId }, { usuarioBId: meuId }] },
  });
  const idsMatch = matches.map((m) =>
    m.usuarioAId === meuId ? m.usuarioBId : m.usuarioAId
  );

  const excluirIds = [
    meuId,
    ...idsCurtidos,
    ...idsPulados,
    ...idsMatch,
    ...idsBloqueados,
    ...idsQueMeBloquearam,
  ];

  const baseWhere = {
    id: { notIn: excluirIds },
    perfil: { isNot: null },
    fotos: { some: { principal: true } },
    // 🔒 regra do invisível: se o alvo estiver invisível, não aparece no feed
    // (mantém match/público em outra rota)
    isInvisivel: false,
  };

  // 1) Conta quantos boostados existem
  const boostedCount = await prisma.usuario.count({
    where: {
      ...baseWhere,
      boostAte: { gt: now },
    },
  });

  // 2) Define quanto pegar de boostados vs normais com base no skip/paginação
  let boostedSkip = 0;
  let boostedTake = 0;
  let normalSkip = 0;
  let normalTake = 0;

  if (skip < boostedCount) {
    boostedSkip = skip;
    boostedTake = Math.min(limit, boostedCount - skip);
    normalSkip = 0;
    normalTake = limit - boostedTake;
  } else {
    boostedSkip = 0;
    boostedTake = 0;
    normalSkip = skip - boostedCount;
    normalTake = limit;
  }

  // 3) Busca boostados primeiro
  const boostedUsers =
    boostedTake > 0
      ? await prisma.usuario.findMany({
        where: { ...baseWhere, boostAte: { gt: now } },
        skip: boostedSkip,
        take: boostedTake,
        orderBy: { boostAte: "desc" },
        include: {
          perfil: true,
          fotos: { where: { principal: true }, take: 1 },
        },
      })
      : [];

  // 4) Busca normais depois (excluindo quem já veio boostado)
  const boostedIds = boostedUsers.map((u) => u.id);

  const normalUsers =
    normalTake > 0
      ? await prisma.usuario.findMany({
        where: {
          ...baseWhere,
          id: { notIn: [...excluirIds, ...boostedIds] },
        },
        skip: normalSkip,
        take: normalTake,
        orderBy: { criadoEm: "desc" },
        include: {
          perfil: true,
          fotos: { where: { principal: true }, take: 1 },
        },
      })
      : [];

  const usuarios = [...boostedUsers, ...normalUsers];

  const payload = usuarios.map((u) => ({
    id: u.id,
    perfil: u.perfil,
    fotoPrincipal: u.fotos?.[0]?.url || null,
    boostAtivo: !!u.boostAte && u.boostAte > now,
    boostAte: u.boostAte,
  }));

  return res.json({ page, limit, total: payload.length, data: payload });
}
