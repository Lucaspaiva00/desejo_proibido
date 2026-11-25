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

export async function listarCurtidos(req, res) {
    try {
        const userId = req.usuario.id;
        const bloqueios = await prisma.bloqueio.findMany({
            where: { OR: [{ deUsuarioId: userId }, { paraUsuarioId: userId }] },
            select: { deUsuarioId: true, paraUsuarioId: true },
        });
        const bloqueados = bloqueios.map((b) => b.deUsuarioId === userId ? b.paraUsuarioId : b.deUsuarioId);
        const curtidas = await prisma.curtida.findMany({
            where: { deUsuarioId: userId, paraUsuario: { ativo: true, id: { notIn: bloqueados } } },
            orderBy: { criadoEm: "desc" },
            take: 200,
            select: {
                id: true,
                paraUsuario: { select: {
                    id: true,
                    perfil: { select: { nome: true, cidade: true, estado: true, nascimento: true, verificado: true } },
                    fotos: { select: { id: true, url: true, principal: true }, take: 5 },
                } },
            },
        });
        return res.json(curtidas.map((c) => ({ id: c.id, outro: c.paraUsuario })));
    } catch {
        return res.status(500).json({ erro: "Erro ao carregar curtidos" });
    }
}
