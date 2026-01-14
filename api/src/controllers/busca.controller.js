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

/**
 * Gera range por idade usando Perfil.nascimento
 * idadeMin => nascimento <= hoje-idadeMin
 * idadeMax => nascimento >= hoje-(idadeMax+1)+1dia
 */
function buildNascimentoRange(idadeMin, idadeMax) {
    const now = new Date();
    let gte = undefined;
    let lte = undefined;

    if (Number.isFinite(idadeMin)) {
        const min = clamp(idadeMin, 18, 99);
        const dt = new Date(now);
        dt.setFullYear(dt.getFullYear() - min);
        lte = dt;
    }

    if (Number.isFinite(idadeMax)) {
        const max = clamp(idadeMax, 18, 99);
        const dt = new Date(now);
        dt.setFullYear(dt.getFullYear() - (max + 1));
        dt.setDate(dt.getDate() + 1);
        gte = dt;
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

/**
 * GET /busca
 * Query:
 * q, cidade, estado, genero
 * idadeMin, idadeMax
 * somenteComFoto (0/1), somenteVerificados (0/1)
 * ordenarPor: recent|boost|random
 * take: default 50
 */
export async function buscar(req, res) {
    try {
        const userId = req.usuario.id;

        const q = toStr(req.query.q).trim();
        const cidade = toStr(req.query.cidade).trim();
        const estado = toStr(req.query.estado).trim().toUpperCase();
        const genero = toStr(req.query.genero).trim();

        const idadeMin = toInt(req.query.idadeMin, null);
        const idadeMax = toInt(req.query.idadeMax, null);

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

        // bloqueios
        const bloqueios = await prisma.bloqueio.findMany({
            where: { OR: [{ deUsuarioId: userId }, { paraUsuarioId: userId }] },
            select: { deUsuarioId: true, paraUsuarioId: true },
        });

        const idsBloqueados = new Set();
        for (const b of bloqueios) {
            if (b.deUsuarioId === userId) idsBloqueados.add(b.paraUsuarioId);
            if (b.paraUsuarioId === userId) idsBloqueados.add(b.deUsuarioId);
        }

        // where base
        const where = {
            ativo: true,
            isInvisivel: false,
            id: { not: userId, notIn: [...idsBloqueados] },

            perfil: {
                is: {
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
                    ...(genero && genero !== "Qualquer" ? { genero } : {}),

                    ...(somenteVerificados ? { verificado: true } : {}),

                    ...(nascRange
                        ? {
                            nascimento: {
                                ...(nascRange.gte ? { gte: nascRange.gte } : {}),
                                ...(nascRange.lte ? { lte: nascRange.lte } : {}),
                            },
                        }
                        : {}),
                },
            },

            // ✅ SEM fotoPrincipal NO USUÁRIO
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

                // ✅ pega a foto principal pelo relacionamento Fotos
                fotos: {
                    where: { principal: true },
                    take: 1,
                    select: { url: true, principal: true },
                },
            },
        });

        // random pós-busca
        if (!orderBy) {
            rows = rows
                .map((x) => ({ x, r: Math.random() }))
                .sort((a, b) => a.r - b.r)
                .map((o) => o.x);
        }

        // ✅ normaliza para o front que espera u.fotoPrincipal
        const out = rows.map((u) => ({
            id: u.id,
            boostAte: u.boostAte,
            perfil: u.perfil,
            fotoPrincipal: u.fotos?.[0]?.url || null,
        }));

        return res.json({ data: out });
    } catch (e) {
        console.log("ERRO /busca:", e);
        return res.status(500).json({ erro: "Erro na busca", detalhe: e.message });
    }
}

/**
 * GET /busca/preferencias (MVP)
 */
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

/**
 * PUT /busca/preferencias (MVP)
 */
export async function salvarPreferencias(req, res) {
    return res.json({ ok: true });
}
