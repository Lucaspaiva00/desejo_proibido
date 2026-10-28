// src/routes/carteira.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { presentearCreditos } from "../controllers/carteira.controller.js";
import { prisma } from "../prisma.js";

const router = Router();

const CUSTO_RETORNO_FEED = 10;

router.get("/", auth, async (req, res) => {
    try {
        const userId = req.usuario?.id;
        if (!userId) return res.status(401).json({ error: "Não autenticado" });

        // garante wallet sempre
        const wallet = await prisma.wallet.upsert({
            where: { userId },
            update: {},
            create: { userId, saldoCreditos: 0 },
            select: { saldoCreditos: true },
        });

        return res.json({ saldoCreditos: wallet?.saldoCreditos || 0 });
    } catch (e) {
        return res.status(500).json({ error: "Erro ao carregar carteira", detalhe: e.message });
    }
});

router.post(
    "/presentear",
    auth,
    presentearCreditos
);

router.post("/feed-retorno", auth, async (req, res) => {
    try {
        const userId = req.usuario?.id;
        const perfilId = req.body?.perfilId ? String(req.body.perfilId) : null;

        if (!userId) {
            return res.status(401).json({ erro: "Não autenticado" });
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.wallet.upsert({
                where: { userId },
                update: {},
                create: { userId, saldoCreditos: 0 },
            });

            const wallet = await tx.wallet.findUnique({
                where: { userId },
                select: { saldoCreditos: true },
            });

            const saldoAtual = Number(wallet?.saldoCreditos || 0);

            if (saldoAtual < CUSTO_RETORNO_FEED) {
                return {
                    saldoInsuficiente: true,
                    saldoCreditos: saldoAtual,
                };
            }

            const atualizado = await tx.wallet.update({
                where: { userId },
                data: {
                    saldoCreditos: {
                        decrement: CUSTO_RETORNO_FEED,
                    },
                },
                select: { saldoCreditos: true },
            });

            await tx.walletTx.create({
                data: {
                    userId,
                    tipo: "DEBIT",
                    origem: "FEED_RETORNO",
                    valor: CUSTO_RETORNO_FEED,
                    refId: perfilId,
                },
            });

            return {
                saldoInsuficiente: false,
                saldoCreditos: atualizado.saldoCreditos,
            };
        });

        if (result.saldoInsuficiente) {
            return res.status(402).json({
                erro: "Saldo insuficiente",
                codigo: "SALDO_INSUFICIENTE",
                custo: CUSTO_RETORNO_FEED,
                saldoCreditos: result.saldoCreditos,
            });
        }

        const io = req.app.get("io");
        if (io?._dp) {
            io._dp.emitToUser(userId, "wallet:update", {
                saldoCreditos: result.saldoCreditos,
            });
        }

        return res.json({
            ok: true,
            custo: CUSTO_RETORNO_FEED,
            saldoCreditos: result.saldoCreditos,
        });
    } catch (e) {
        console.error("Erro ao cobrar retorno do feed:", e);
        return res.status(500).json({
            erro: "Erro ao processar retorno do feed",
            detalhe: e.message,
        });
    }
});


export default router;
