import { prisma } from "../prisma.js";
import { debitarMinutos } from "../utils/minutos.js";

function ceilMinutos(segundos) {
    const s = Math.max(0, Number(segundos || 0));
    return Math.ceil(s / 60);
}

/**
 * GET /ligacoes/saldo
 */
export async function saldoMinutos(req, res) {
    const u = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { id: true, minutosDisponiveis: true },
    });
    return res.json(u);
}

/**
 * POST /ligacoes/iniciar
 * body: { conversaId }
 */
export async function iniciarLigacao(req, res) {
    try {
        const usuarioId = req.usuario.id;
        const { conversaId } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });

        const conversa = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: true },
        });
        if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada" });

        const a = conversa.match.usuarioAId;
        const b = conversa.match.usuarioBId;
        if (![a, b].includes(usuarioId)) return res.status(403).json({ erro: "Você não pertence a esta conversa" });

        const alvoId = (usuarioId === a) ? b : a;

        const [eu, alvo, banEu, banAlvo] = await Promise.all([
            prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, ativo: true, minutosDisponiveis: true } }),
            prisma.usuario.findUnique({ where: { id: alvoId }, select: { id: true, ativo: true } }),
            prisma.banGlobal.findUnique({ where: { usuarioId }, select: { ativo: true, ate: true } }),
            prisma.banGlobal.findUnique({ where: { usuarioId: alvoId }, select: { ativo: true, ate: true } }),
        ]);

        if (!eu || !eu.ativo) return res.status(401).json({ erro: "Usuário inválido" });
        if (!alvo || !alvo.ativo) return res.status(404).json({ erro: "Alvo inválido" });

        const agora = new Date();
        if (banEu?.ativo && (!banEu.ate || banEu.ate > agora)) return res.status(403).json({ erro: "Você está banido" });
        if (banAlvo?.ativo && (!banAlvo.ate || banAlvo.ate > agora)) return res.status(403).json({ erro: "Este usuário está banido" });

        if (eu.minutosDisponiveis <= 0) return res.status(402).json({ erro: "Sem minutos disponíveis" });

        const sessao = await prisma.sessaoLigacao.create({
            data: {
                usuarioId,
                alvoId,
                status: "INICIADA",
            },
        });

        // mensagem sistema (opcional)
        await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: usuarioId,
                tipo: "SISTEMA",
                texto: "📞 Iniciou uma ligação (MVP)",
                metaJson: { sessaoId: sessao.id },
            },
        });

        return res.json({ ok: true, sessaoId: sessao.id });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao iniciar ligação", detalhe: e.message });
    }
}

/**
 * POST /ligacoes/finalizar
 * body: { sessaoId, conversaId, segundosConsumidos }
 */
export async function finalizarLigacao(req, res) {
    try {
        const usuarioId = req.usuario.id;
        const { sessaoId, conversaId, segundosConsumidos } = req.body;

        if (!sessaoId) return res.status(400).json({ erro: "sessaoId é obrigatório" });

        const sessao = await prisma.sessaoLigacao.findUnique({ where: { id: sessaoId } });
        if (!sessao) return res.status(404).json({ erro: "Sessão não encontrada" });
        if (sessao.usuarioId !== usuarioId) return res.status(403).json({ erro: "Só quem iniciou pode finalizar (MVP)" });

        const minutos = ceilMinutos(segundosConsumidos);
        if (minutos <= 0) return res.status(400).json({ erro: "segundosConsumidos inválido" });

        const debito = await debitarMinutos({
            usuarioId,
            minutos,
            refTipo: "CALL_SESSION",
            refId: sessao.id,
            detalhes: `Ligação | ${segundosConsumidos}s`,
        });

        const updated = await prisma.sessaoLigacao.update({
            where: { id: sessao.id },
            data: {
                status: "FINALIZADA",
                finalizadoEm: new Date(),
                segundosConsumidos: Number(segundosConsumidos),
                minutosCobrados: minutos,
            },
        });

        if (conversaId) {
            await prisma.mensagem.create({
                data: {
                    conversaId,
                    autorId: usuarioId,
                    tipo: "SISTEMA",
                    texto: `☎️ Ligação finalizada: ${minutos} min`,
                    metaJson: { sessaoId: sessao.id, minutos, segundosConsumidos: Number(segundosConsumidos) },
                },
            });
        }

        return res.json({ ok: true, sessao: updated, saldo: debito.saldo });
    } catch (e) {
        return res.status(400).json({ erro: e.message });
    }
}
