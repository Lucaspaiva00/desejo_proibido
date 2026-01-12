import { prisma } from "../prisma.js";

function ordenarPar(id1, id2) {
    return id1 < id2 ? [id1, id2] : [id2, id1];
}

export async function bloquear(req, res) {
    const deUsuarioId = req.usuario.id;
    const { paraUsuarioId } = req.params;

    if (!paraUsuarioId) return res.status(400).json({ erro: "paraUsuarioId é obrigatório" });
    if (paraUsuarioId === deUsuarioId) return res.status(400).json({ erro: "Você não pode bloquear a si mesmo" });

    const existe = await prisma.usuario.findUnique({ where: { id: paraUsuarioId } });
    if (!existe) return res.status(404).json({ erro: "Usuário alvo não encontrado" });

    const [usuarioAId, usuarioBId] = ordenarPar(deUsuarioId, paraUsuarioId);

    const result = await prisma.$transaction(async (tx) => {
        // 1) cria bloqueio
        const bloqueio = await tx.bloqueio.upsert({
            where: { deUsuarioId_paraUsuarioId: { deUsuarioId, paraUsuarioId } },
            update: {},
            create: { deUsuarioId, paraUsuarioId }
        });

        // 2) remove curtidas entre os dois
        await tx.curtida.deleteMany({
            where: {
                OR: [
                    { deUsuarioId, paraUsuarioId },
                    { deUsuarioId: paraUsuarioId, paraUsuarioId: deUsuarioId }
                ]
            }
        });

        // 3) se existir match, apagar conversa + mensagens e depois match
        const match = await tx.match.findUnique({
            where: { usuarioAId_usuarioBId: { usuarioAId, usuarioBId } }
        });

        if (match) {
            const conversa = await tx.conversa.findUnique({ where: { matchId: match.id } });
            if (conversa) {
                await tx.mensagem.deleteMany({ where: { conversaId: conversa.id } });
                await tx.conversa.delete({ where: { id: conversa.id } });
            }
            await tx.match.delete({ where: { id: match.id } });
        }

        return { bloqueio, matchRemovido: !!match };
    });

    return res.status(201).json(result);
}

export async function desbloquear(req, res) {
    const deUsuarioId = req.usuario.id;
    const { paraUsuarioId } = req.params;

    await prisma.bloqueio.deleteMany({
        where: { deUsuarioId, paraUsuarioId }
    });

    return res.json({ ok: true });
}

export async function meusBloqueios(req, res) {
    const deUsuarioId = req.usuario.id;

    const lista = await prisma.bloqueio.findMany({
        where: { deUsuarioId },
        orderBy: { criadoEm: "desc" },
        include: {
            paraUsuario: {
                select: {
                    id: true,
                    perfil: true,
                    fotos: { where: { principal: true }, take: 1 }
                }
            }
        }
    });

    const payload = lista.map((b) => ({
        id: b.id,
        criadoEm: b.criadoEm,
        usuario: {
            id: b.paraUsuario.id,
            perfil: b.paraUsuario.perfil,
            fotoPrincipal: b.paraUsuario.fotos?.[0]?.url || null
        }
    }));

    return res.json(payload);
}
