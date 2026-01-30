import { prisma } from "../prisma.js";

/**
 * Helpers
 */
const CREDITOS_POR_MINUTO = 1; // <-- ajuste aqui depois se quiser (ex: 2, 5, etc)

async function getGenero(userId) {
    const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { ativo: true, perfil: { select: { genero: true } } },
    });
    return {
        ativo: !!u?.ativo,
        genero: (u?.perfil?.genero || "").toUpperCase(), // "M" | "F" | ...
    };
}

function isAtiva(status) {
    return (status || "").toUpperCase() === "ATIVA";
}

/**
 * GET /lives
 * Lista lives ATIVAS (host mulher) + contagem viewers online (saiuEm null)
 */
export async function listarLives(req, res) {
    try {
        const lives = await prisma.live.findMany({
            where: { status: "ATIVA" },
            select: {
                id: true,
                titulo: true,
                status: true,
                criadaEm: true,
                host: {
                    select: {
                        id: true,
                        perfil: { select: { nome: true, cidade: true, estado: true, genero: true, verificado: true } },
                        fotos: { where: { principal: true }, take: 1, select: { url: true } },
                    },
                },
                _count: {
                    select: { liveViewers: true },
                },
                liveViewers: {
                    where: { saiuEm: null },
                    select: { id: true },
                },
            },
            orderBy: { criadaEm: "desc" },
            take: 50,
        });

        // Filtra para garantir host mulher (segurança extra)
        const items = lives
            .filter((l) => (l.host?.perfil?.genero || "").toUpperCase() === "F")
            .map((l) => ({
                id: l.id,
                titulo: l.titulo,
                criadaEm: l.criadaEm,
                host: {
                    id: l.host.id,
                    nome: l.host.perfil?.nome ?? "Sem nome",
                    cidade: l.host.perfil?.cidade ?? null,
                    estado: l.host.perfil?.estado ?? null,
                    verificada: !!l.host.perfil?.verificado,
                    foto: l.host.fotos?.[0]?.url ?? null,
                },
                viewersOnline: l.liveViewers.length,
            }));

        return res.json({ items });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao listar lives", detalhe: e.message });
    }
}

/**
 * POST /lives/iniciar
 * body: { titulo? }
 * ✅ somente mulheres podem iniciar
 */
export async function iniciarLive(req, res) {
    try {
        const userId = req.usuario.id;
        const { titulo } = req.body || {};

        const me = await getGenero(userId);
        if (!me.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
        if (me.genero !== "F") return res.status(403).json({ erro: "Apenas mulheres podem iniciar live" });

        // trava: não deixa a mesma host ter 2 lives ATIVAS
        const jaTem = await prisma.live.findFirst({
            where: { hostId: userId, status: "ATIVA" },
            select: { id: true },
        });
        if (jaTem) return res.status(409).json({ erro: "Você já tem uma live ativa", liveId: jaTem.id });

        const live = await prisma.live.create({
            data: {
                hostId: userId,
                titulo: titulo?.toString()?.slice(0, 80) || null,
                status: "ATIVA",
            },
            select: { id: true, status: true, criadaEm: true },
        });

        return res.json({ ok: true, liveId: live.id, status: live.status, criadaEm: live.criadaEm });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao iniciar live", detalhe: e.message });
    }
}

/**
 * POST /lives/:id/entrar
 * ✅ somente homens entram
 * Cria/reativa LiveViewer (saiuEm null)
 */
export async function entrarLive(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: liveId } = req.params;

        const me = await getGenero(userId);
        if (!me.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
        if (me.genero !== "M") return res.status(403).json({ erro: "Somente homens podem entrar em lives" });

        const live = await prisma.live.findUnique({
            where: { id: liveId },
            select: {
                id: true,
                status: true,
                hostId: true,
                host: { select: { perfil: { select: { genero: true } } } },
            },
        });

        if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });

        // segurança: host deve ser mulher
        const hostGenero = (live.host?.perfil?.genero || "").toUpperCase();
        if (hostGenero !== "F") return res.status(400).json({ erro: "Live inválida (host)" });

        // host não entra como viewer
        if (live.hostId === userId) return res.status(400).json({ erro: "Host não entra como viewer" });

        // precisa ter minutos
        const saldo = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { minutosDisponiveis: true },
        });
        if ((saldo?.minutosDisponiveis ?? 0) <= 0) return res.status(402).json({ erro: "Sem minutos disponíveis" });

        // LiveViewer tem unique(liveId, viewerId)
        const viewer = await prisma.liveViewer.upsert({
            where: { liveId_viewerId: { liveId, viewerId: userId } },
            create: {
                liveId,
                viewerId: userId,
                entrouEm: new Date(),
                saiuEm: null,
                minutosCobrados: 0,
            },
            update: {
                // re-entrada: marca como online de novo
                entrouEm: new Date(),
                saiuEm: null,
            },
            select: { id: true, entrouEm: true, saiuEm: true, minutosCobrados: true },
        });

        return res.json({ ok: true, viewer: { id: viewer.id, entrouEm: viewer.entrouEm } });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao entrar na live", detalhe: e.message });
    }
}

/**
 * POST /lives/:id/sair
 * ✅ somente homens
 */
export async function sairLive(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: liveId } = req.params;

        const me = await getGenero(userId);
        if (!me.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
        if (me.genero !== "M") return res.status(403).json({ erro: "Somente homens podem sair (viewer)" });

        const upd = await prisma.liveViewer.updateMany({
            where: { liveId, viewerId: userId, saiuEm: null },
            data: { saiuEm: new Date() },
        });

        return res.json({ ok: true, updated: upd.count });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao sair da live", detalhe: e.message });
    }
}

export async function tickLive(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: liveId } = req.params;

        const me = await getGenero(userId);
        if (!me.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
        if (me.genero !== "M") return res.status(403).json({ erro: "Somente homens podem consumir live" });

        const live = await prisma.live.findUnique({
            where: { id: liveId },
            select: { id: true, status: true, hostId: true, host: { select: { perfil: { select: { genero: true } } } } },
        });
        if (!live || !isAtiva(live.status)) return res.status(404).json({ erro: "Live não encontrada/encerrada" });

        // segurança: host tem que ser mulher
        const hostGenero = (live.host?.perfil?.genero || "").toUpperCase();
        if (hostGenero !== "F") return res.status(400).json({ erro: "Live inválida (host)" });

        const viewer = await prisma.liveViewer.findUnique({
            where: { liveId_viewerId: { liveId, viewerId: userId } },
            select: { id: true, saiuEm: true },
        });
        if (!viewer || viewer.saiuEm) return res.status(403).json({ erro: "Você não está na live" });

        const result = await prisma.$transaction(async (tx) => {
            const u = await tx.usuario.findUnique({
                where: { id: userId },
                select: { minutosDisponiveis: true, ativo: true },
            });

            if (!u?.ativo) throw new Error("Usuário inválido");

            if ((u.minutosDisponiveis ?? 0) <= 0) {
                // auto-sair se zerou
                await tx.liveViewer.update({
                    where: { liveId_viewerId: { liveId, viewerId: userId } },
                    data: { saiuEm: new Date() },
                });
                return { semMinutos: true, saldo: 0 };
            }

            // 1) debita 1 minuto do homem
            await tx.usuario.update({
                where: { id: userId },
                data: { minutosDisponiveis: { decrement: 1 } },
            });

            // 2) marca 1 min cobrado no viewer
            const lv = await tx.liveViewer.update({
                where: { liveId_viewerId: { liveId, viewerId: userId } },
                data: { minutosCobrados: { increment: 1 } },
                select: { minutosCobrados: true },
            });

            // 3) extrato de minutos (homem)
            await tx.creditoMinuto.create({
                data: {
                    usuarioId: userId,
                    tipo: "DEBITO",
                    minutos: -1,
                    refTipo: "LIVE",
                    refId: liveId,
                    detalhes: "Tick live (1 min)",
                },
            });

            // 4) credita a host na wallet (mulher)
            const creditos = Math.max(0, Number(CREDITOS_POR_MINUTO || 0));

            if (creditos > 0) {
                await tx.wallet.upsert({
                    where: { userId: live.hostId },
                    create: { userId: live.hostId, saldoCreditos: creditos },
                    update: { saldoCreditos: { increment: creditos } },
                });

                await tx.walletTx.create({
                    data: {
                        userId: live.hostId,
                        tipo: "CREDITO",
                        origem: "LIVE",
                        valor: creditos,
                        refId: liveId,
                    },
                });
            }

            const u2 = await tx.usuario.findUnique({
                where: { id: userId },
                select: { minutosDisponiveis: true },
            });

            const hostWallet = await tx.wallet.findUnique({
                where: { userId: live.hostId },
                select: { saldoCreditos: true },
            });

            return {
                semMinutos: false,
                saldo: u2?.minutosDisponiveis ?? 0,
                minutosCobrados: lv.minutosCobrados,
                hostCreditos: hostWallet?.saldoCreditos ?? 0,
            };
        });

        if (result.semMinutos) return res.status(402).json({ erro: "Sem minutos", saldo: 0 });

        return res.json({
            ok: true,
            saldoMinutos: result.saldo,
            minutosCobrados: result.minutosCobrados,
            hostCreditos: result.hostCreditos,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro no tick da live", detalhe: e.message });
    }
}


/**
 * (EXTRA, RECOMENDADO) POST /lives/:id/encerrar
 * ✅ somente host mulher encerra live
 * - marca live.status="ENCERRADA" + encerradaEm
 * - desloga viewers online (saiuEm)
 *
 * Se você quiser essa rota, adiciona no routes também.
 */
export async function encerrarLive(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: liveId } = req.params;

        const me = await getGenero(userId);
        if (!me.ativo) return res.status(403).json({ erro: "Usuário inválido/inativo" });
        if (me.genero !== "F") return res.status(403).json({ erro: "Apenas mulheres podem encerrar a live" });

        const live = await prisma.live.findUnique({ where: { id: liveId }, select: { hostId: true, status: true } });
        if (!live) return res.status(404).json({ erro: "Live não encontrada" });
        if (live.hostId !== userId) return res.status(403).json({ erro: "Você não é a host desta live" });

        if (!isAtiva(live.status)) return res.json({ ok: true, status: live.status });

        await prisma.$transaction([
            prisma.live.update({
                where: { id: liveId },
                data: { status: "ENCERRADA", encerradaEm: new Date() },
            }),
            prisma.liveViewer.updateMany({
                where: { liveId, saiuEm: null },
                data: { saiuEm: new Date() },
            }),
        ]);

        return res.json({ ok: true, status: "ENCERRADA" });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao encerrar live", detalhe: e.message });
    }
}
