import { prisma } from "../prisma.js";
import { creditarMinutos } from "../utils/minutos.js";

function minutosPorProduto(produtoIdOuSku) {
    // ✅ Ajuste aqui seus planos:
    // Exemplo: básico = 1 minuto, premium = 10 minutos, etc.
    const map = {
        "PLANO_BASIC_1MIN": 1,
        "PLANO_PLUS_10MIN": 10,
        "PLANO_PRO_30MIN": 30,
    };
    return map[produtoIdOuSku] ?? null;
}

/**
 * POST /webhooks/woo
 * Header: x-webhook-secret: <WOO_WEBHOOK_SECRET>
 * Body: payload do Woo
 *
 * IMPORTANTE: você precisa que o pedido tenha um campo que ligue ao usuário do app.
 * MVP: usar "customer_note" ou "meta_data" com "usuarioId".
 */
export async function webhookWoo(req, res) {
    const secret = req.headers["x-webhook-secret"];
    if (!secret || secret !== process.env.WOO_WEBHOOK_SECRET) {
        return res.status(403).json({ erro: "Webhook não autorizado" });
    }

    const payload = req.body;

    // Woo geralmente manda:
    // payload.id (orderId), payload.status, payload.line_items[]
    const orderId = String(payload?.id || "");
    const status = String(payload?.status || "");

    if (!orderId) return res.status(400).json({ erro: "orderId ausente" });

    // Só credita quando pago (recomendo completed)
    if (status !== "completed") {
        return res.json({ ok: true, ignored: true, motivo: `status=${status}` });
    }

    // 1) Descobrir usuarioId do seu app
    // Opção A: payload.customer_note = "usuarioId:xxxxx"
    // Opção B: meta_data com key "usuarioId"
    const usuarioId =
        (payload?.meta_data || []).find(m => m?.key === "usuarioId")?.value ||
        (payload?.customer_note || "").replace("usuarioId:", "").trim();

    if (!usuarioId) {
        return res.status(400).json({ erro: "usuarioId não encontrado no pedido (meta_data ou customer_note)" });
    }

    // 2) Evitar crédito duplicado
    const ja = await prisma.compraWoo.findUnique({ where: { orderId } });
    if (ja) return res.json({ ok: true, alreadyProcessed: true });

    // 3) Calcular minutos do pedido (somando itens)
    const items = payload?.line_items || [];
    let minutosTotal = 0;
    let produtoNome = null;
    let produtoId = null;

    for (const it of items) {
        // use SKU se tiver, senão product_id
        const key = it?.sku ? String(it.sku) : String(it?.product_id || "");
        const min = minutosPorProduto(key);
        if (min) {
            const qty = Number(it?.quantity || 1);
            minutosTotal += (min * qty);
            produtoNome = it?.name || produtoNome;
            produtoId = key || produtoId;
        }
    }

    if (minutosTotal <= 0) {
        return res.status(400).json({ erro: "Nenhum produto mapeado para minutos" });
    }

    // 4) Registrar compra
    await prisma.compraWoo.create({
        data: {
            usuarioId,
            orderId,
            status,
            produtoId: produtoId || null,
            produtoNome: produtoNome || null,
            minutosCreditados: minutosTotal,
            payloadJson: payload,
        },
    });

    // 5) Creditar minutos
    await creditarMinutos({
        usuarioId,
        minutos: minutosTotal,
        refTipo: "WOO_ORDER",
        refId: orderId,
        detalhes: `Crédito WooCommerce pedido ${orderId}`,
    });

    return res.json({ ok: true, usuarioId, minutosCreditados: minutosTotal });
}
