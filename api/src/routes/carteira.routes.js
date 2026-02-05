import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/", auth, async (req, res) => {
    const userId = req.usuario?.id;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    return res.json({ saldoCreditos: wallet?.saldoCreditos || 0 });
});

export default router;
