import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(auth);

const chamadoPublico = {
  id: true,
  assunto: true,
  mensagem: true,
  resposta: true,
  criadoEm: true,
};

function texto(value, max) {
  if (typeof value !== "string") return null;
  const normalizado = value.trim();
  return normalizado.length > 0 && normalizado.length <= max ? normalizado : null;
}

router.get("/", async (req, res, next) => {
  try {
    const chamados = await prisma.chamadoSuporte.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { criadoEm: "desc" },
      select: chamadoPublico,
      take: 100,
    });
    res.json(chamados);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const assunto = texto(req.body?.assunto, 120);
  const mensagem = texto(req.body?.mensagem, 2000);
  if (!assunto || !mensagem) return res.status(400).json({ erro: "Informe um assunto e uma mensagem válidos." });

  try {
    const chamado = await prisma.chamadoSuporte.create({
      data: { usuarioId: req.usuario.id, assunto, mensagem },
      select: chamadoPublico,
    });
    res.status(201).json(chamado);
  } catch (error) {
    next(error);
  }
});

export async function listarChamadosAdmin(req, res, next) {
  const pagina = Number(req.query.pagina ?? 1);
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000) {
    return res.status(400).json({ erro: "Página inválida." });
  }

  try {
    const chamados = await prisma.chamadoSuporte.findMany({
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      select: { ...chamadoPublico, usuario: { select: { email: true } } },
      skip: (pagina - 1) * 30,
      take: 31,
    });
    res.json({ chamados: chamados.slice(0, 30), proximaPagina: chamados.length > 30 });
  } catch (error) {
    next(error);
  }
}

export async function responderChamado(req, res, next) {
  const resposta = texto(req.body?.resposta, 2000);
  if (!resposta) return res.status(400).json({ erro: "Informe uma resposta válida." });

  try {
    const resultado = await prisma.chamadoSuporte.updateMany({
      where: { id: req.params.id, resposta: null },
      data: { resposta },
    });
    if (!resultado.count) return res.status(409).json({ erro: "Chamado indisponível ou já respondido." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export default router;
