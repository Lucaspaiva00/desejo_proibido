import { prisma } from "../prisma.js";

const CHAT_CUSTO_CREDITOS = Number(process.env.CHAT_CUSTO_CREDITOS || 10);

// Helpers
async function getSaldoCreditos(userId) {
    const w = await prisma.wallet.findUnique({ where: { userId } });
    return w?.saldoCreditos ?? 0;
}

async function isChatLiberadoParaUsuario(conversaId, userId) {
    const tx = await prisma.walletTx.findFirst({
        where: {
            userId,
            origem: "CHAT_UNLOCK",
            refId: conversaId,
        },
        select: { id: true },
    });
    return !!tx;
}

/**
 * GET /conversas
 * Lista as conversas do usuário logado a partir dos matches.
 * Se o match ainda não tem conversa, cria automaticamente.
 */
export async function listarConversas(req, res) {
    try {
        const userId = req.usuario.id;

        const matches = await prisma.match.findMany({
            where: { OR: [{ usuarioAId: userId }, { usuarioBId: userId }] },
            orderBy: { criadoEm: "desc" },
            include: {
                conversa: true,
                usuarioA: {
                    select: {
                        id: true,
                        email: true,
                        perfil: true,
                        fotos: { orderBy: { principal: "desc" } },
                    },
                },
                usuarioB: {
                    select: {
                        id: true,
                        email: true,
                        perfil: true,
                        fotos: { orderBy: { principal: "desc" } },
                    },
                },
            },
        });

        const convIds = [];
        for (const m of matches) {
            if (m.conversa?.id) {
                convIds.push(m.conversa.id);
                continue;
            }
            const conv = await prisma.conversa.create({ data: { matchId: m.id } });
            convIds.push(conv.id);
        }

        const conversas = await prisma.conversa.findMany({
            where: { id: { in: convIds } },
            orderBy: { atualizadoEm: "desc" },
            include: {
                match: {
                    include: {
                        usuarioA: {
                            select: {
                                id: true,
                                email: true,
                                perfil: true,
                                fotos: { orderBy: { principal: "desc" } },
                            },
                        },
                        usuarioB: {
                            select: {
                                id: true,
                                email: true,
                                perfil: true,
                                fotos: { orderBy: { principal: "desc" } },
                            },
                        },
                    },
                },
                mensagens: {
                    orderBy: { criadoEm: "desc" },
                    take: 1,
                    select: { id: true, texto: true, criadoEm: true },
                },
            },
        });

        const out = conversas.map((c) => {
            const a = c.match.usuarioA;
            const b = c.match.usuarioB;
            const outro = a.id === userId ? b : a;

            return {
                id: c.id,
                matchId: c.matchId,
                atualizadoEm: c.atualizadoEm,
                outroUsuarioId: outro.id,
                outro,
                ultimaMensagem: c.mensagens?.[0] ? c.mensagens[0] : null,
            };
        });

        return res.json(out);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao listar conversas", detalhe: e.message });
    }
}

/**
 * GET /conversas/:id/mensagens
 */
export async function mensagensDaConversa(req, res) {
    try {
        const userId = req.usuario.id;
        const { id } = req.params;

        const conv = await prisma.conversa.findUnique({
            where: { id },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const msgs = await prisma.mensagem.findMany({
            where: { conversaId: id },
            orderBy: { criadoEm: "asc" },
            include: { autor: { select: { id: true, email: true } } },
        });

        return res.json(msgs);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar mensagens", detalhe: e.message });
    }
}

/**
 * POST /conversas/abrir
 * body: { matchId }
 */
export async function abrirConversaPorMatch(req, res) {
    try {
        const userId = req.usuario.id;
        const { matchId } = req.body;

        if (!matchId) return res.status(400).json({ erro: "matchId é obrigatório" });

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { conversa: true },
        });

        if (!match) return res.status(404).json({ erro: "Match não encontrado" });

        const isParte = match.usuarioAId === userId || match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a este match" });

        if (match.conversa?.id) {
            return res.json({ conversaId: match.conversa.id });
        }

        const conversa = await prisma.conversa.create({
            data: { matchId: match.id },
        });

        return res.json({ conversaId: conversa.id });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao abrir conversa", detalhe: e.message });
    }
}

/**
 * ✅ GET /conversas/:id/status
 * Retorna custo do chat, saldo e se já liberou (por usuário)
 */
export async function statusConversa(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: conversaId } = req.params;

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const chatLiberado = await isChatLiberadoParaUsuario(conversaId, userId);
        const saldoCreditos = await getSaldoCreditos(userId);

        return res.json({
            conversaId,
            chatLiberado,
            custoCreditos: CHAT_CUSTO_CREDITOS,
            saldoCreditos,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar status", detalhe: e.message });
    }
}

/**
 * ✅ POST /conversas/:id/liberar
 * Debita créditos 1x e registra no WalletTx
 */
export async function liberarChat(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: conversaId } = req.params;

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        // se custo 0 -> libera sem debitar
        if (CHAT_CUSTO_CREDITOS <= 0) {
            await prisma.walletTx.create({
                data: {
                    userId,
                    tipo: "DEBITO",
                    origem: "CHAT_UNLOCK",
                    valor: 0,
                    refId: conversaId,
                },
            });

            return res.json({
                ok: true,
                chatLiberado: true,
                custoCreditos: 0,
                saldoCreditos: await getSaldoCreditos(userId),
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const ja = await tx.walletTx.findFirst({
                where: { userId, origem: "CHAT_UNLOCK", refId: conversaId },
                select: { id: true },
            });

            if (ja) {
                const saldo = (await tx.wallet.findUnique({ where: { userId } }))?.saldoCreditos ?? 0;
                return { already: true, saldo };
            }

            const wallet = await tx.wallet.upsert({
                where: { userId },
                create: { userId, saldoCreditos: 0 },
                update: {},
            });

            if (wallet.saldoCreditos < CHAT_CUSTO_CREDITOS) {
                return { insuficiente: true, saldo: wallet.saldoCreditos };
            }

            const w2 = await tx.wallet.update({
                where: { userId },
                data: { saldoCreditos: { decrement: CHAT_CUSTO_CREDITOS } },
            });

            await tx.walletTx.create({
                data: {
                    userId,
                    tipo: "DEBITO",
                    origem: "CHAT_UNLOCK",
                    valor: CHAT_CUSTO_CREDITOS,
                    refId: conversaId,
                },
            });

            // opcional: mensagem de sistema no chat
            await tx.mensagem.create({
                data: {
                    conversaId,
                    autorId: userId,
                    tipo: "SISTEMA",
                    texto: "🔓 Chat liberado com créditos.",
                },
            });

            await tx.conversa.update({
                where: { id: conversaId },
                data: { atualizadoEm: new Date() },
            });

            return { ok: true, saldo: w2.saldoCreditos };
        });

        if (result.insuficiente) {
            return res.status(402).json({
                erro: "Saldo insuficiente",
                custoCreditos: CHAT_CUSTO_CREDITOS,
                saldoCreditos: result.saldo,
            });
        }

        return res.json({
            ok: true,
            chatLiberado: true,
            custoCreditos: CHAT_CUSTO_CREDITOS,
            saldoCreditos: result.saldo,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao liberar chat", detalhe: e.message });
    }
}
