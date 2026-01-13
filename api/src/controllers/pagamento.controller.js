import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment, MerchantOrder } from "mercadopago";
import { prisma } from "../prisma.js";

function getClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado no .env");
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Verificação de assinatura do webhook (se você setar MP_WEBHOOK_SECRET).
 * Mercado Pago usa headers: x-signature e x-request-id.
 * Se MP_WEBHOOK_SECRET não existir, a gente aceita (DEV), mas em PROD é obrigatório.
 */
function validarAssinaturaWebhook(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // DEV sem travar

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  if (!xSignature || !xRequestId) return false;

  // x-signature vem tipo: "ts=1234567890,v1=abcdef..."
  const parts = String(xSignature).split(",");
  const tsPart = parts.find((p) => p.trim().startsWith("ts="));
  const v1Part = parts.find((p) => p.trim().startsWith("v1="));

  if (!tsPart || !v1Part) return false;

  const ts = tsPart.split("=")[1];
  const v1 = v1Part.split("=")[1];

  // O "data.id" pode vir em query: ?data.id=123
  // ou em req.query["data.id"] dependendo do parser
  const dataId =
    req.query["data.id"] ||
    (req.query?.data && req.query.data.id) ||
    req.body?.data?.id ||
    req.body?.id;

  if (!dataId) return false;

  // padrão: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hash === v1;
}

/**
 * POST /pagamentos/premium
 * Cria uma preferência no Mercado Pago e devolve init_point para redirecionar.
 */
export async function criarCheckoutPremium(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const webUrl = process.env.WEB_URL || "http://localhost:5500";
    const appUrl = process.env.APP_URL || "http://localhost:8080";

    const client = getClient();
    const preference = new Preference(client);

    // Referência pra saber quem pagou (NÃO ativa aqui)
    const external_reference = `premium:${usuarioId}`;

    // Preço (em centavos pra você ter controle)
    const valorCentavos = 1990; // R$ 19,90 (troque quando for)
    const valor = Number((valorCentavos / 100).toFixed(2));

    const body = {
      items: [
        {
          title: "Desejo Proibido Premium (Mensal)",
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],

      external_reference,

      back_urls: {
        success: `${webUrl}/webcliente/home.html?mp=success`,
        pending: `${webUrl}/webcliente/home.html?mp=pending`,
        failure: `${webUrl}/webcliente/home.html?mp=failure`,
      },

      auto_return: "approved",

      notification_url: `${appUrl}/pagamentos/webhook`, // webhook do MP

      metadata: {
        usuarioId,
        plano: "PREMIUM",
      },
    };

    const pref = await preference.create({ body });

    // Registra “intenção” (opcional, mas ajuda a rastrear)
    await prisma.pagamento.create({
      data: {
        usuarioId,
        status: "created",
        plano: "PREMIUM",
        valorCentavos,
        moeda: "BRL",
      },
    });

    return res.json({
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      preference_id: pref.id,
    });
  } catch (e) {
    return res.status(500).json({ erro: e.message || "Erro ao criar checkout premium" });
  }
}

/**
 * POST /pagamentos/webhook
 * Aqui você recebe o evento do Mercado Pago e confirma no GET do payment/order.
 * Só aqui que ativa o premium.
 */
export async function webhookMercadoPago(req, res) {
  try {
    const okAssinatura = validarAssinaturaWebhook(req);
    if (!okAssinatura) {
      return res.status(401).json({ erro: "Assinatura inválida do webhook" });
    }

    const type = req.query.type || req.query.topic || req.body?.type;
    const dataId =
      req.query["data.id"] ||
      (req.query?.data && req.query.data.id) ||
      req.body?.data?.id ||
      req.body?.id;

    // Sempre responda 200 rápido pro MP não ficar reenviando em loop
    res.status(200).json({ ok: true });

    if (!dataId) return;

    const client = getClient();

    // MP pode mandar "payment" ou "merchant_order"
    if (type === "payment") {
      const payment = new Payment(client);
      const p = await payment.get({ id: dataId });

      // Approved = pago
      if (p?.status !== "approved") return;

      const ext = p.external_reference || "";
      if (!ext.startsWith("premium:")) return;

      const usuarioId = ext.split(":")[1];
      if (!usuarioId) return;

      // ✅ ativa premium aqui
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { isPremium: true, plano: "PREMIUM" },
      });

      // grava pagamento
      await prisma.pagamento.create({
        data: {
          usuarioId,
          mpPaymentId: String(p.id),
          status: String(p.status),
          plano: "PREMIUM",
          valorCentavos: Math.round(Number(p.transaction_amount || 0) * 100),
          moeda: String(p.currency_id || "BRL"),
        },
      });

      return;
    }

    if (type === "merchant_order") {
      const order = new MerchantOrder(client);
      const o = await order.get({ merchantOrderId: dataId });

      const ext = o.external_reference || "";
      if (!ext.startsWith("premium:")) return;

      const usuarioId = ext.split(":")[1];
      if (!usuarioId) return;

      // Se tiver payments e algum approved, ativa
      const payments = o.payments || [];
      const aprovado = payments.some((x) => x?.status === "approved");

      if (!aprovado) return;

      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { isPremium: true, plano: "PREMIUM" },
      });

      await prisma.pagamento.create({
        data: {
          usuarioId,
          mpOrderId: String(o.id),
          status: "approved",
          plano: "PREMIUM",
          valorCentavos: Math.round(Number(o.total_amount || 0) * 100),
          moeda: "BRL",
        },
      });

      return;
    }
  } catch (e) {
    // aqui não responde (já respondemos 200), só loga
    console.error("❌ webhookMercadoPago:", e);
  }
}
