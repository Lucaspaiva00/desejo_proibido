// src/controllers/busca.controller.js
import { prisma } from "../prisma.js";

function toStr(v) {
    return v == null ? "" : String(v);
}
function toInt(v, def = null) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function buildNascimentoRange(idadeMin, idadeMax) {
    const now = new Date();
    let gte = undefined;
    let lte = undefined;

    if (Number.isFinite(idadeMin)) {
        const min = clamp(idadeMin, 18, 99);
        const dt = new Date(now);
        dt.setFullYear(dt.getFullYear() - min);
        lte = dt; // nasceu até aqui => tem pelo menos idadeMin
    }

    if (Number.isFinite(idadeMax)) {
        const max = clamp(idadeMax, 18, 99);
        const dt = new Date(now);
        dt.setFullYear(dt.getFullYear() - (max + 1));
        dt.setDate(dt.getDate() + 1);
        gte = dt; // nasceu depois => é no máximo idadeMax
    }

    if (!gte && !lte) return null;
    return { gte, lte };
}

function orderByFrom(ordenarPor) {
    const o = (ordenarPor || "recent").toLowerCase();
    if (o === "boost") return [{ boostAte: "desc" }, { criadoEm: "desc" }];
    if (o === "random") return null;
    return [{ criadoEm: "desc" }];
}

export async function buscar(req, res) {
    try {
        const userId = req.usuario.id;

        // 0) housekeeping
        await prisma.usuario.updateMany({
            where: {
                invisivelAte: { not: null, lte: new Date() },
                isInvisivel: true,
            },
            data: { isInvisivel: false, invisivelAte: null },
        });

        await prisma.usuario.updateMany({
            where: { boostAte: { not: null, lte: new Date() } },
            data: { boostAte: null },
        });

        // 1) params (front SEMPRE manda idade 18-99, então isso não pode ser filtro)
        const q = toStr(req.query.q).trim();
        const cidade = toStr(req.query.cidade).trim();
        const estado = toStr(req.query.estado).trim().toUpperCase();
        const genero = toStr(req.query.genero).trim();

        let idadeMin = toInt(req.query.idadeMin, null);
        let idadeMax = toInt(req.query.idadeMax, null);

        // ✅ 18–99 = SEM FILTRO (senão você mata todo mundo sem nascimento)
        if (idadeMin === 18 && idadeMax === 99) {
            idadeMin = null;
            idadeMax = null;
        }

        const somenteComFoto =
            req.query.somenteComFoto === "1" ||
            req.query.somenteComFoto === "true" ||
            req.query.somenteComFoto === "on";

        const somenteVerificados =
            req.query.somenteVerificados === "1" ||
            req.query.somenteVerificados === "true" ||
            req.query.somenteVerificados === "on";

        const ordenarPor = toStr(req.query.ordenarPor || "recent");
        const take = clamp(toInt(req.query.take, 50) ?? 50, 1, 100);

        const nascRange = buildNascimentoRange(
            Number.isFinite(idadeMin) ? idadeMin : NaN,
            Number.isFinite(idadeMax) ? idadeMax : NaN
        );

        // 2) exclusões
        const bloqueios = await prisma.bloqueio.findMany({
            where: { OR: [{ deUsuarioId: userId }, { paraUsuarioId: userId }] },
            select: { deUsuarioId: true, paraUsuarioId: true },
        });

        const idsBloqueados = new Set();
        for (const b of bloqueios) {
            if (b.deUsuarioId === userId) idsBloqueados.add(b.paraUsuarioId);
            if (b.paraUsuarioId === userId) idsBloqueados.add(b.deUsuarioId);
        }

        const curtidos = await prisma.curtida.findMany({
            where: { deUsuarioId: userId },
            select: { paraUsuarioId: true },
        });
        const idsCurtidos = new Set(curtidos.map((c) => c.paraUsuarioId));

        const pulados = await prisma.skip.findMany({
            where: { deUsuarioId: userId },
            select: { paraUsuarioId: true },
        });
        const idsPulados = new Set(pulados.map((s) => s.paraUsuarioId));

        const matches = await prisma.match.findMany({
            where: { OR: [{ usuarioAId: userId }, { usuarioBId: userId }] },
            select: { usuarioAId: true, usuarioBId: true },
        });
        const idsMatch = new Set(
            matches.map((m) => (m.usuarioAId === userId ? m.usuarioBId : m.usuarioAId))
        );

        const excluir = new Set([
            userId,
            ...idsBloqueados,
            ...idsCurtidos,
            ...idsPulados,
            ...idsMatch,
        ]);

        // 3) PERFIL filtros — SÓ entra se tiver filtro REAL (não default)
        const perfilWhere = {
            ...(q
                ? {
                    OR: [
                        { nome: { contains: q, mode: "insensitive" } },
                        { bio: { contains: q, mode: "insensitive" } },
                    ],
                }
                : {}),
            ...(cidade ? { cidade: { contains: cidade, mode: "insensitive" } } : {}),
            ...(estado && estado.length === 2 ? { estado } : {}),
            ...(genero && genero.toLowerCase() !== "qualquer"
                ? { genero: { equals: genero, mode: "insensitive" } }
                : {}),
            ...(somenteVerificados ? { verificado: true } : {}),
            ...(nascRange
                ? {
                    // ✅ se for filtrar por idade, tem que ter nascimento (ok)
                    nascimento: {
                        ...(nascRange.gte ? { gte: nascRange.gte } : {}),
                        ...(nascRange.lte ? { lte: nascRange.lte } : {}),
                    },
                }
                : {}),
        };

        const temFiltroDePerfil = Object.keys(perfilWhere).length > 0;

        // 4) where FINAL
        const where = {
            // SEMPRE mostra cadastros visíveis
            ativo: true,
            isInvisivel: false,

            // nunca mostrar o próprio e nem quem já interagiu (se você quiser, depois a gente tira)
            id: { notIn: [...excluir] },

            // ✅ só exige perfil quando filtra por perfil
            ...(temFiltroDePerfil ? { perfil: { is: perfilWhere } } : {}),

            // ✅ somenteComFoto filtra por relação fotos
            ...(somenteComFoto ? { fotos: { some: { principal: true } } } : {}),
        };

        const orderBy = orderByFrom(ordenarPor);

        let rows = await prisma.usuario.findMany({
            where,
            ...(orderBy ? { orderBy } : {}),
            take,
            select: {
                id: true,
                boostAte: true,
                perfil: true,
                fotos: {
                    where: { principal: true },
                    take: 1,
                    select: { url: true, principal: true },
                },
            },
        });

        if (!orderBy) {
            rows = rows
                .map((x) => ({ x, r: Math.random() }))
                .sort((a, b) => a.r - b.r)
                .map((o) => o.x);
        }

        const out = rows.map((u) => ({
            id: u.id,
            boostAte: u.boostAte,
            perfil: u.perfil || null,
            fotoPrincipal: u.fotos?.[0]?.url || null,
        }));

        return res.json({ data: out });
    } catch (e) {
        console.log("ERRO /busca:", e);
        return res.status(500).json({ erro: "Erro na busca", detalhe: e.message });
    }
}

// Preferências (mock)
export async function preferencias(req, res) {
    return res.json({
        q: "",
        cidade: "",
        estado: "",
        genero: "Qualquer",
        idadeMin: 18,
        idadeMax: 99,
        somenteComFoto: false,
        somenteVerificados: false,
        ordenarPor: "recent",
    });
}

export async function salvarPreferencias(req, res) {
    return res.json({ ok: true });
}
