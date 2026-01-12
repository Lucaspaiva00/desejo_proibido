import { prisma } from "../prisma.js";

function ordenarPar(id1, id2) {
    return id1 < id2 ? [id1, id2] : [id2, id1];
}

export async function curtir(req, res) {
    const deUsuarioId = req.usuario.id;
    const { paraUsuarioId } = req.params;

    if (!paraUsuarioId) return res.status(400).json({ erro: "paraUsuarioId é obrigatório" });
    if (paraUsuarioId === deUsuarioId) return res.status(400).json({ erro: "Você não pode curtir a si mesmo" });

    const existeAlvo = await prisma.usuario.findUnique({ where: { id: paraUsuarioId } });
    if (!existeAlvo) return res.status(404).json({ erro: "Usuário alvo não encontrado" });

    const result = await prisma.$transaction(async (tx) => {
        // 1) cria curtida (se já existir, mantém)
        const curtida = await tx.curtida.upsert({
            where: { deUsuarioId_paraUsuarioId: { deUsuarioId, paraUsuarioId } },
            update: {},
            create: { deUsuarioId, paraUsuarioId }
        });

        // 2) verifica recíproca
        const reciproca = await tx.curtida.findUnique({
            where: { deUsuarioId_paraUsuarioId: { deUsuarioId: paraUsuarioId, paraUsuarioId: deUsuarioId } }
        });

        if (!reciproca) {
            return { curtida, matchCriado: false, match: null, conversa: null };
        }

        // 3) cria match (par ordenado pra garantir unique)
        const [usuarioAId, usuarioBId] = ordenarPar(deUsuarioId, paraUsuarioId);

        const match = await tx.match.upsert({
            where: { usuarioAId_usuarioBId: { usuarioAId, usuarioBId } },
            update: {},
            create: { usuarioAId, usuarioBId }
        });

        // 4) cria conversa automaticamente (se já existir, mantém)
        const conversa = await tx.conversa.upsert({
            where: { matchId: match.id },
            update: {},
            create: { matchId: match.id }
        });

        return { curtida, matchCriado: true, match, conversa };
    });

    return res.status(201).json(result);
}
