// src/controllers/mensagem.controller.js
import { prisma } from "../prisma.js";
import { isChatUnlocked, isPremiumEfetivo } from "../utils/wallet.js";

export async function enviarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, texto } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!texto || !String(texto).trim())
            return res.status(400).json({ erro: "texto é obrigatório" });

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: {
                match: { select: { usuarioAId: true, usuarioBId: true } },
            },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        // ✅ Opção B: premium efetivo = plano premium OU saldoCreditos>0
        const premiumEfetivo = await isPremiumEfetivo(userId);

        // Se NÃO for premium efetivo, exige unlock por conversa
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para enviar mensagens.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                texto: String(texto).trim(),
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar mensagem", detalhe: e.message });
    }
}
