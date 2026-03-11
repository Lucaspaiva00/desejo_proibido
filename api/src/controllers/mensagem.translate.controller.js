import { prisma } from "../prisma.js";
import { getOrCreateTranslation } from "../services/translate.service.js";

function assertParteDaConversa(conv, userId) {
    const match = conv?.match;
    if (!match) return false;
    return match.usuarioAId === userId || match.usuarioBId === userId;
}

export async function traduzirMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const mensagemId = String(req.params.id || "");
        const idiomaDestino = String(req.query.lang || req.lang || req.usuario?.idioma || "pt")
            .toLowerCase()
            .trim();

        if (!mensagemId) {
            return res.status(400).json({ erro: "ID da mensagem é obrigatório" });
        }

        const mensagem = await prisma.mensagem.findUnique({
            where: { id: mensagemId },
            select: {
                id: true,
                conversaId: true,
                texto: true,
                textoOriginal: true,
                idiomaOriginal: true,
                tipo: true,
            },
        });

        if (!mensagem) {
            return res.status(404).json({ erro: "Mensagem não encontrada" });
        }

        if (mensagem.tipo !== "TEXTO") {
            return res.status(400).json({ erro: "Somente mensagens de texto podem ser traduzidas" });
        }

        const conversa = await prisma.conversa.findUnique({
            where: { id: mensagem.conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conversa) {
            return res.status(404).json({ erro: "Conversa não encontrada" });
        }

        if (!assertParteDaConversa(conversa, userId)) {
            return res.status(403).json({ erro: "Sem acesso a esta conversa" });
        }

        const textoBase = mensagem.textoOriginal || mensagem.texto || "";

        const traducao = await getOrCreateTranslation({
            mensagemId: mensagem.id,
            idiomaDestino,
            textoOriginal: textoBase,
            idiomaOriginal: mensagem.idiomaOriginal || "auto",
        });

        return res.json({
            mensagemId: mensagem.id,
            idiomaDestino,
            textoOriginal: textoBase,
            textoTraduzido: traducao || textoBase,
        });
    } catch (e) {
        return res.status(500).json({
            erro: "Erro ao traduzir mensagem",
            detalhe: e.message,
        });
    }
}