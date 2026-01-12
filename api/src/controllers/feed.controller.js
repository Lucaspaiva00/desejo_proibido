import { prisma } from "../prisma.js";

export async function feed(req, res) {
  const meuId = req.usuario.id;

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const skip = (page - 1) * limit;

  // IDs que eu já curti
  const curtidos = await prisma.curtida.findMany({
    where: { deUsuarioId: meuId },
    select: { paraUsuarioId: true }
  });

  const idsCurtidos = curtidos.map(c => c.paraUsuarioId);

  // IDs que já são match comigo
  const matches = await prisma.match.findMany({
    where: {
      OR: [{ usuarioAId: meuId }, { usuarioBId: meuId }]
    }
  });

  const idsMatch = matches.map(m =>
    m.usuarioAId === meuId ? m.usuarioBId : m.usuarioAId
  );

  const excluirIds = [meuId, ...idsCurtidos, ...idsMatch];

  const usuarios = await prisma.usuario.findMany({
    where: {
      id: { notIn: excluirIds },
      perfil: { isNot: null }
    },
    skip,
    take: limit,
    orderBy: { criadoEm: "desc" },
    include: {
      perfil: true,
      fotos: {
        where: { principal: true },
        take: 1
      }
    }
  });

  const payload = usuarios.map(u => ({
    id: u.id,
    perfil: u.perfil,
    fotoPrincipal: u.fotos?.[0]?.url || null
  }));

  return res.json({
    page,
    limit,
    total: payload.length,
    data: payload
  });
}
