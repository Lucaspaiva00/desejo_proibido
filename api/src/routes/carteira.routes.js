// src/routes/carteira.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { presentearCreditos } from "../controllers/carteira.controller.js";
import { prisma } from "../prisma.js";

const router = Router();

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


export default router;
