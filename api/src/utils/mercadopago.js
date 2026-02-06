// API/src/utils/mercadopago.js
const MP_API = "https://api.mercadopago.com";

function env(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Faltando env: ${name}`);
    return v;
}

export function getCreditPacks() {
    // ✅ Ajuste aqui quando quiser
    return [
        { id: "MINI_TOQUE_5", nome: "Mini Toque", creditos: 5, valorCentavos: 100 },
        { id: "PEQUENO_TOQUE_10", nome: "Pequeno Toque", creditos: 10, valorCentavos: 1700 },
        { id: "SEDUCAO_25", nome: "Sedução", creditos: 25, valorCentavos: 3900 },
        { id: "LUXO_50", nome: "Luxo", creditos: 50, valorCentavos: 7400 },
        { id: "OBSESSAO_100", nome: "Obsessão", creditos: 100, valorCentavos: 13300 },
        { id: "PACOTE_ELITE_250", nome: "Pacote Elite", creditos: 250, valorCentavos: 29900 },
    ];
}

export function findPackById(packId) {
    return getCreditPacks().find((p) => p.id === packId);
}

export function centsToBRL(cents) {
    return Number((cents / 100).toFixed(2));
}

export function assertWebhookSecret(req) {
    const expected = process.env.MP_WEBHOOK_SECRET;
    if (!expected) return; // se não setou, não valida
    const got = req.query?.secret;
    if (got !== expected) {
        const err = new Error("Webhook secret inválido");
        err.statusCode = 401;
        throw err;
    }
}

export async function mpCreatePreference({
    pagamentoId, // seu Pagamento.id (external_reference)
    titulo,
    unitPriceBRL,
    notificationUrl,
    backUrls,
}) {
    const accessToken = env("MP_ACCESS_TOKEN");

    const body = {
        external_reference: pagamentoId,
        items: [
            {
                title: titulo,
                quantity: 1,
                currency_id: "BRL",
                unit_price: Number(unitPriceBRL),
            },
        ],
        auto_return: "approved",
        back_urls: backUrls,
        notification_url: notificationUrl,
    };

    const resp = await fetch(`${MP_API}/checkout/preferences`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`MP preference erro: ${resp.status} ${text}`);
    }

    return resp.json();
}

export async function mpGetPayment(mpPaymentId) {
    const accessToken = env("MP_ACCESS_TOKEN");

    const resp = await fetch(`${MP_API}/v1/payments/${mpPaymentId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`MP get payment erro: ${resp.status} ${text}`);
    }

    return resp.json();
}
