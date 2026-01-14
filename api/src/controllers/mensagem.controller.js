import { prisma } from "../prisma.js";

export async function enviarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, texto } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!texto || !String(texto).trim()) return res.status(400).json({ erro: "texto é obrigatório" });

        // valida acesso
        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: {
                match: { select: { usuarioAId: true, usuarioBId: true } },
            },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                texto: String(texto).trim(),
            },
        });

        // atualiza "atualizadoEm" da conversa pra ordenar na lista
        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar mensagem", detalhe: e.message });
    }
}
