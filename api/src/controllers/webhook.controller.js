import { prisma } from "../prisma.js";
import { creditarMinutos } from "../utils/minutos.js";

/**
 * POST /webhooks/woocommerce
 */
export async function webhookWoo(req, res) {
    try {
        const secret = req.headers["x-webhook-secret"];
        if (secret !== process.env.WOO_WEBHOOK_SECRET) {
            return res.status(401).json({ erro: "Webhook não autorizado" });
        }

        const {
            order_id,
            email,
            status,
            produto_id,
            produto_nome,
            minutos,
            payload,
        } = req.body;

        if (!order_id || !email || !minutos) {
            return res.status(400).json({ erro: "Payload inválido" });
        }

        const usuario = await prisma.usuario.findUnique({
            where: { email },
        });
        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

        const jaProcessado = await prisma.compraWoo.findUnique({
            where: { orderId: String(order_id) },
        });
        if (jaProcessado) return res.json({ ok: true, ignorado: true });

        await prisma.$transaction(async (tx) => {
            await tx.compraWoo.create({
                data: {
                    usuarioId: usuario.id,
                    orderId: String(order_id),
                    status,
                    produtoId: produto_id ? String(produto_id) : null,
                    produtoNome: produto_nome ?? null,
                    minutosCreditados: minutos,
                    payloadJson: payload ?? null,
                },
            });

            await creditarMinutos({
                usuarioId: usuario.id,
                minutos,
                tipo: "CREDITO_COMPRA",
                refTipo: "WOO_ORDER",
                refId: String(order_id),
                detalhes: produto_nome,
            });
        });

        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ erro: e.message });
    }
}
