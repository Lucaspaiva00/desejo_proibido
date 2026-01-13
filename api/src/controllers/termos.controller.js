import { prisma } from "../prisma.js";

export async function termosAtivos(req, res) {
    try {
        const termos = await prisma.termo.findMany({
            where: { ativo: true },
            select: { tipo: true, versao: true, conteudo: true, criadoEm: true },
            orderBy: { criadoEm: "desc" },
        });

        return res.json(termos);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar termos", detalhe: e.message });
    }
}
