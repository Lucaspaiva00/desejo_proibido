// src/controllers/perfil.controller.js
import { prisma } from "../prisma.js";

function parseDateOnlyToUTC(dateStr) {
    // dateStr esperado: "YYYY-MM-DD"
    if (!dateStr) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

    const [y, m, d] = dateStr.split("-").map(Number);
    // cria em UTC (meia-noite), evita bug de fuso
    return new Date(Date.UTC(y, m - 1, d));
}

function str(v) {
    return v == null ? "" : String(v);
}

// ✅ GET /perfil/me
export async function me(req, res) {
    try {
        const usuarioId = req.usuario.id;

        let perfil = await prisma.perfil.findUnique({
            where: { usuarioId },
        });

        // ✅ Se não existir, CRIA um perfil vazio (para nunca ficar null no feed / app)
        // Obs: esse perfil vazio NÃO aparece no feed se o /busca exigir "perfil mínimo"
        if (!perfil) {
            perfil = await prisma.perfil.create({
                data: {
                    usuarioId,
                    nome: "",
                    bio: null,
                    cidade: null,
                    estado: "",
                    genero: null,
                    nascimento: null,
                    // se seu schema tiver "verificado", mantém:
                    // verificado: false,
                },
            });
        }

        return res.json(perfil);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao carregar perfil", detalhe: e.message });
    }
}

// ✅ PUT /perfil (cria ou atualiza)
export async function salvarPerfil(req, res) {
    try {
        const usuarioId = req.usuario.id;

        const {
            nome,
            bio,
            cidade,
            estado,
            genero,
            nascimento, // YYYY-MM-DD
        } = req.body;

        const nomeS = str(nome).trim();
        const estadoS = str(estado).trim().toUpperCase();
        const generoS = str(genero).trim();
        const nascStr = str(nascimento).trim();

        // ✅ Agora: obrigatório (para aparecer no feed)
        if (!nomeS) return res.status(400).json({ erro: "nome é obrigatório" });

        if (!estadoS || estadoS.length !== 2) {
            return res.status(400).json({ erro: "estado deve ter 2 letras (ex: SP)" });
        }

        // ✅ obrigatório (se é regra do app)
        if (!generoS) return res.status(400).json({ erro: "gênero é obrigatório" });

        // ✅ obrigatório (se é regra do app)
        const nasc = parseDateOnlyToUTC(nascStr);
        if (!nasc) {
            return res.status(400).json({ erro: "nascimento é obrigatório e deve ser YYYY-MM-DD" });
        }

        const perfil = await prisma.perfil.upsert({
            where: { usuarioId },
            update: {
                nome: nomeS,
                bio: bio != null && str(bio).trim() !== "" ? str(bio).trim() : null,
                cidade: cidade != null && str(cidade).trim() !== "" ? str(cidade).trim() : null,
                estado: estadoS,
                genero: generoS,
                nascimento: nasc,
            },
            create: {
                usuarioId,
                nome: nomeS,
                bio: bio != null && str(bio).trim() !== "" ? str(bio).trim() : null,
                cidade: cidade != null && str(cidade).trim() !== "" ? str(cidade).trim() : null,
                estado: estadoS,
                genero: generoS,
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
