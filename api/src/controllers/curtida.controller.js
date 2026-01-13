import { prisma } from "../prisma.js";

const LIMITE_DIARIO_FREE = 10;

function ordenarPar(id1, id2) {
    return id1 < id2 ? [id1, id2] : [id2, id1];
}

function inicioDoDia() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function curtir(req, res) {
    const deUsuarioId = req.usuario.id;
    const { paraUsuarioId } = req.params;

    if (!paraUsuarioId)
        return res.status(400).json({ erro: "paraUsuarioId é obrigatório" });

    if (paraUsuarioId === deUsuarioId)
        return res.status(400).json({ erro: "Você não pode curtir a si mesmo" });

    const usuario = await prisma.usuario.findUnique({
        where: { id: deUsuarioId },
        select: { isPremium: true }
    });

    if (!usuario)
        return res.status(401).json({ erro: "Usuário inválido" });

    // 🔒 LIMITE FREEMIUM
    if (!usuario.isPremium) {
        const totalHoje = await prisma.curtida.count({
            where: {
                deUsuarioId,
                criadoEm: { gte: inicioDoDia() }
            }
        });

        if (totalHoje >= LIMITE_DIARIO_FREE) {
            return res.status(429).json({
                erro: "Limite diário de curtidas atingido",
                limite: LIMITE_DIARIO_FREE,
                premium: false
            });
        }
    }

    const existeAlvo = await prisma.usuario.findUnique({
        where: { id: paraUsuarioId }
    });
    if (!existeAlvo)
        return res.status(404).json({ erro: "Usuário alvo não encontrado" });

    const result = await prisma.$transaction(async (tx) => {
        // 1) cria curtida (se já existir, mantém)
        const curtida = await tx.curtida.upsert({
            where: {
                deUsuarioId_paraUsuarioId: { deUsuarioId, paraUsuarioId }
            },
            update: {},
            create: { deUsuarioId, paraUsuarioId }
        });

        // 2) verifica recíproca
        const reciproca = await tx.curtida.findUnique({
            where: {
                deUsuarioId_paraUsuarioId: {
                    deUsuarioId: paraUsuarioId,
                    paraUsuarioId: deUsuarioId
                }
            }
        });

        if (!reciproca) {
            return {
                curtida,
                matchCriado: false,
                match: null,
                conversa: null
            };
        }

        // 3) cria match (par ordenado)
        const [usuarioAId, usuarioBId] = ordenarPar(
            deUsuarioId,
            paraUsuarioId
        );

        const match = await tx.match.upsert({
            where: { usuarioAId_usuarioBId: { usuarioAId, usuarioBId } },
            update: {},
            create: { usuarioAId, usuarioBId }
        });

        // 4) cria conversa
        const conversa = await tx.conversa.upsert({
            where: { matchId: match.id },
            update: {},
            create: { matchId: match.id }
        });

        return {
            curtida,
            matchCriado: true,
            match,
            conversa
        };
    });

    return res.status(201).json(result);
}
