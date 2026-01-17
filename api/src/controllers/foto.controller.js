import { prisma } from "../prisma.js";

export async function uploadFoto(req, res) {
  const { url } = req.body;

  const usuarioId = req.usuario.id;

  const foto = await prisma.foto.create({
    data: { usuarioId, url },
  });

  return res.status(201).json(foto);
}

export async function listarMinhasFotos(req, res) {
  const usuarioId = req.usuario.id;

  const fotos = await prisma.foto.findMany({
    where: { usuarioId },
    orderBy: [{ principal: "desc" }, { criadoEm: "desc" }],
  });

  return res.json(fotos);
}

export async function definirPrincipal(req, res) {
  const usuarioId = req.usuario.id;
  const { id } = req.params;

  // garante que a foto é do usuário
  const foto = await prisma.foto.findFirst({ where: { id, usuarioId } });
  if (!foto) return res.status(404).json({ erro: "Foto não encontrada" });

  // remove principal das outras e seta nessa
  await prisma.$transaction([
    prisma.foto.updateMany({
      where: { usuarioId },
      data: { principal: false },
    }),
    prisma.foto.update({ where: { id }, data: { principal: true } }),
  ]);

  const atualizada = await prisma.foto.findUnique({ where: { id } });
  return res.json(atualizada);
}

export async function removerFoto(req, res) {
  const usuarioId = req.usuario.id;
  const { id } = req.params;

  const foto = await prisma.foto.findFirst({ where: { id, usuarioId } });
  if (!foto) return res.status(404).json({ erro: "Foto não encontrada" });

  await prisma.foto.delete({ where: { id } });
  return res.json({ ok: true });
}
