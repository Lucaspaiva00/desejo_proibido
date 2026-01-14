import { prisma } from "../prisma.js";
import { creditarMinutos } from "../utils/minutos.js";

/**
 * GET /presentes
 * Lista catálogo de presentes
 */
export async function listarPresentes(req, res) {
  const itens = await prisma.presente.findMany({
    where: { ativo: true },
    orderBy: { minutos: "asc" },
  });
  return res.json(itens);
}

/**
 * POST /presentes/enviar
 * body: { conversaId, presenteId }
 * O backend descobre quem é o outro usuário na conversa e credita nele
 */
export async function enviarPresente(req, res) {
  try {
    const deUsuarioId = req.usuario.id;
    const { conversaId, presenteId } = req.body;

    if (!conversaId || !presenteId) {
      return res.status(400).json({ erro: "conversaId e presenteId são obrigatórios" });
    }

    const conversa = await prisma.conversa.findUnique({
      where: { id: conversaId },
      include: { match: true },
    });
    if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada" });

    const a = conversa.match.usuarioAId;
    const b = conversa.match.usuarioBId;

    if (![a, b].includes(deUsuarioId)) {
      return res.status(403).json({ erro: "Você não pertence a esta conversa" });
    }

    const paraUsuarioId = (deUsuarioId === a) ? b : a;

    const presente = await prisma.presente.findUnique({ where: { id: presenteId } });
    if (!presente || !presente.ativo) return res.status(404).json({ erro: "Presente inválido" });

    const envio = await prisma.$transaction(async (tx) => {
      const enviado = await tx.presenteEnviado.create({
        data: {
          presenteId,
          conversaId,
          deUsuarioId,
          paraUsuarioId,
          minutos: presente.minutos,
        },
      });

      // mensagem no chat
      await tx.mensagem.create({
        data: {
          conversaId,
          autorId: deUsuarioId,
          tipo: "PRESENTE",
          texto: `🎁 Enviou ${presente.nome}`,
          metaJson: {
            presenteId: presente.id,
            nome: presente.nome,
            minutos: presente.minutos,
            imagemUrl: presente.imagemUrl,
            paraUsuarioId,
          },
        },
      });

      return enviado;
    });

    if (presente.minutos > 0) {
      await creditarMinutos({
        usuarioId: paraUsuarioId,
        minutos: presente.minutos,
        tipo: "CREDITO_PRESENTE",
        refTipo: "PRESENTE",
        refId: envio.id,
        detalhes: `Presente ${presente.nome}`,
      });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
