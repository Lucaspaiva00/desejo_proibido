import { prisma } from "../prisma.js";

function parseDateOnlyToUTC(dateStr) {
    // dateStr esperado: "YYYY-MM-DD"
    if (!dateStr) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

    const [y, m, d] = dateStr.split("-").map(Number);
    // cria em UTC (meia-noite), evita bug de fuso
    return new Date(Date.UTC(y, m - 1, d));
}

export async function me(req, res) {
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfil.findUnique({
        where: { usuarioId },
    });

    return res.json(perfil); // pode ser null
}

// PUT /perfil  (cria ou atualiza)
export async function salvarPerfil(req, res) {
    try {
        const usuarioId = req.usuario.id;

        const {
            nome,
            bio,
            cidade,
            estado,
            genero,       // ✅ novo
            nascimento,   // ✅ novo (YYYY-MM-DD)
        } = req.body;

        if (!nome) return res.status(400).json({ erro: "nome é obrigatório" });

        if (!estado || String(estado).trim().length !== 2) {
            return res.status(400).json({ erro: "estado deve ter 2 letras (ex: SP)" });
        }

        const uf = String(estado).trim().toUpperCase();

        // nascimento é opcional, mas se vier precisa ser válido
        const nasc = nascimento ? parseDateOnlyToUTC(String(nascimento).trim()) : null;
        if (nascimento && !nasc) {
            return res.status(400).json({ erro: "nascimento inválido. Use YYYY-MM-DD" });
        }

        const perfil = await prisma.perfil.upsert({
            where: { usuarioId },
            update: {
                nome: String(nome).trim(),
                bio: bio != null && String(bio).trim() !== "" ? String(bio).trim() : null,
                cidade: cidade != null && String(cidade).trim() !== "" ? String(cidade).trim() : null,
                estado: uf,

                // ✅ novos campos
                genero: genero != null && String(genero).trim() !== "" ? String(genero).trim() : null,
                nascimento: nasc,
            },
            create: {
                usuarioId,
                nome: String(nome).trim(),
                bio: bio != null && String(bio).trim() !== "" ? String(bio).trim() : null,
                cidade: cidade != null && String(cidade).trim() !== "" ? String(cidade).trim() : null,
                estado: uf,

                // ✅ novos campos
                genero: genero != null && String(genero).trim() !== "" ? String(genero).trim() : null,
                nascimento: nasc,
            },
        });

        return res.json(perfil);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao salvar perfil", detalhe: e.message });
    }
}

/**
 * GET /perfil/publico/:id
 * - bloqueios bloqueiam
 * - se alvo estiver invisível, só mostra se for match
 */
export async function verPerfilPublico(req, res) {
    const meuId = req.usuario.id;
    const { id } = req.params;

    if (!id) return res.status(400).json({ erro: "id é obrigatório" });
    if (id === meuId) {
        return res.status(400).json({ erro: "Use /perfil/me para seu próprio perfil" });
    }

    const bloqueado = await prisma.bloqueio.findFirst({
        where: {
            OR: [
                { deUsuarioId: meuId, paraUsuarioId: id },
                { deUsuarioId: id, paraUsuarioId: meuId },
            ],
        },
    });
    if (bloqueado) return res.status(403).json({ erro: "Acesso indisponível" });

    const usuario = await prisma.usuario.findUnique({
        where: { id },
        select: {
            id: true,
            isInvisivel: true,
            perfil: true,
            fotos: { orderBy: { principal: "desc" } },
        },
    });

    if (!usuario || !usuario.perfil) {
        return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    if (usuario.isInvisivel) {
        const match = await prisma.match.findFirst({
            where: {
                OR: [
                    { usuarioAId: meuId, usuarioBId: id },
                    { usuarioAId: id, usuarioBId: meuId },
                ],
            },
        });

        if (!match) return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    const fotoPrincipal = usuario.fotos?.find((f) => f.principal)?.url || null;

    return res.json({
        id: usuario.id,
        perfil: usuario.perfil,
        fotoPrincipal,
        fotos: usuario.fotos.map((f) => ({ id: f.id, url: f.url, principal: f.principal })),
    });
}
