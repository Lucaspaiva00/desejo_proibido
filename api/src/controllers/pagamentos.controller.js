// API/src/controllers/pagamentos.controller.js
import { prisma } from "../prisma.js";
import {
    assertWebhookSecret,
    centsToBRL,
    findPackById,
    getCreditPacks,
    mpCreatePreference,
    mpGetPayment,
} from "../utils/mercadopago.js";

function apiBaseUrl() {
    // onde a API roda (para o MP chamar webhook)
    return process.env.APP_URL || "http://localhost:3333";
}

function webBaseUrl() {
    // onde seu front roda (para back_urls)
    return process.env.WEB_URL || "http://localhost:5500";
}

async function ensureWallet(usuarioId) {
    // seu Wallet tem userId como @id
    return prisma.wallet.upsert({
        where: { userId: usuarioId },
        update: {},
        create: { userId: usuarioId, saldoCreditos: 0 },
    });
}

/**
 * GET /api/pagamentos/pacotes
 */
export async function listarPacotes(req, res) {
    return res.json(getCreditPacks());
}

/**
 * POST /api/pagamentos/checkout
 * body: { packId: "PEQUENO_TOQUE_10" }
 */
export async function checkoutCreditos(req, res) {
    try {
        const usuarioId = req.usuario?.id;
        if (!usuarioId) return res.status(401).json({ error: "Não autenticado" });

        const { packId } = req.body || {};
        if (!packId) return res.status(400).json({ error: "packId é obrigatório" });

        const pack = findPackById(packId);
        if (!pack) return res.status(404).json({ error: "Pacote inválido" });

        await ensureWallet(usuarioId);

        // 1) cria registro interno de pagamento
        const pagamento = await prisma.pagamento.create({
            data: {
                usuarioId,
                status: "PENDING",
                plano: pack.nome,
                valorCentavos: pack.valorCentavos,
                moeda: "BRL",
                tipo: "CREDITOS",
                pacoteId: pack.id,
            },
        });

        // 2) cria preferência no MP (Checkout Pro)
        const notificationUrl = `${apiBaseUrl()}/api/pagamentos/webhook/mercadopago?secret=${encodeURIComponent(
            process.env.MP_WEBHOOK_SECRET || ""
        )}`;

        const pref = await mpCreatePreference({
            pagamentoId: pagamento.id,
            titulo: `Desejo Proibido - ${pack.nome} (${pack.creditos} créditos)`,
            unitPriceBRL: centsToBRL(pack.valorCentavos),
            notificationUrl,
            backUrls: {
                success: `${webBaseUrl()}/pagamento-sucesso.html?pid=${pagamento.id}`,
                failure: `${webBaseUrl()}/pagamento-falhou.html?pid=${pagamento.id}`,
                pending: `${webBaseUrl()}/pagamento-pendente.html?pid=${pagamento.id}`,
            },
        });

        // 3) guarda id da preferência no mpOrderId
        await prisma.pagamento.update({
            where: { id: pagamento.id },
            data: { mpOrderId: pref.id },
        });

        return res.json({
            pagamentoId: pagamento.id,
            mpPreferenceId: pref.id,
            initPoint: pref.init_point,
            sandboxInitPoint: pref.sandbox_init_point,
        });
    } catch (err) {
        console.error("checkoutCreditos error:", err);
        return res.status(500).json({ error: "Erro ao criar checkout" });
    }
}

/**
 * GET /api/pagamentos/status/:id
 */
export async function statusPagamento(req, res) {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ error: "Não autenticado" });

    const { id } = req.params;

    const pag = await prisma.pagamento.findFirst({
        where: { id, usuarioId },
    });

    if (!pag) return res.status(404).json({ error: "Pagamento não encontrado" });

    const wallet = await prisma.wallet.findUnique({ where: { userId: usuarioId } });

    return res.json({
        pagamento: pag,
        saldoCreditos: wallet?.saldoCreditos || 0,
    });
}

/**
 * POST /api/pagamentos/webhook/mercadopago
 * MP envia notificações; a gente SEMPRE confirma via GET /v1/payments/:id
 */
export async function webhookMercadoPago(req, res) {
    try {
        assertWebhookSecret(req);

        const payload = req.body || {};
        const mpPaymentId = payload?.data?.id || payload?.id;

        // MP pode mandar evento sem id em alguns casos
        if (!mpPaymentId) return res.status(200).json({ ok: true });

        // 1) confirma no MP
        const mpPay = await mpGetPayment(mpPaymentId);

        const internalPaymentId = mpPay.external_reference; // Pagamento.id
        const mpStatus = mpPay.status; // approved, pending, rejected, cancelled...
        const mpStatusDetail = mpPay.status_detail;

        if (!internalPaymentId) return res.status(200).json({ ok: true });

        const pag = await prisma.pagamento.findUnique({ where: { id: internalPaymentId } });
        if (!pag) return res.status(200).json({ ok: true });

        // 2) idempotência: se já pagou, não credita de novo
        if (pag.status === "PAID") {
            // atualiza mpPaymentId se ainda não salvou
            if (!pag.mpPaymentId) {
                await prisma.pagamento.update({
                    where: { id: pag.id },
                    data: { mpPaymentId: String(mpPaymentId) },
                });
            }
            return res.status(200).json({ ok: true });
        }

        // 3) se aprovado: marca pago + credita wallet + tx
        if (mpStatus === "approved") {
            const pack = findPackById(pag.pacoteId);
            const creditos = pack?.creditos || 0;

            await prisma.$transaction(async (tx) => {
                const current = await tx.pagamento.findUnique({ where: { id: pag.id } });
                if (!current || current.status === "PAID") return; // double-check

                await tx.usuario.update({
                    where: { id: pag.usuarioId },
                    data: {
                        isPremium: true,
                        plano: "CREDITOS"
                    }
                });

                // wallet
                await tx.wallet.upsert({
                    where: { userId: pag.usuarioId },
                    update: { saldoCreditos: { increment: creditos } },
                    create: { userId: pag.usuarioId, saldoCreditos: creditos },
                });

                // tx log
                await tx.walletTx.create({
                    data: {
                        userId: pag.usuarioId,
                        tipo: "CREDIT",
                        origem: "MERCADO_PAGO",
                        valor: creditos,
                        refId: pag.id,
                    },
                });
            });

            return res.status(200).json({ ok: true });
        }

        // 4) estados não aprovados: só atualizar (não credita)
        const nextStatus =
            mpStatus === "rejected" || mpStatus === "cancelled" ? "CANCELED" : "PENDING";

        await prisma.pagamento.update({
            where: { id: pag.id },
            data: {
                status: nextStatus,
                mpPaymentId: String(mpPaymentId),
            },
        });

        // Se quiser, você pode logar detalhe no servidor (não no banco)
        console.log("MP status:", mpStatus, mpStatusDetail, "pagamento:", pag.id);

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("webhookMercadoPago error:", err);
        return res.status(err.statusCode || 500).json({ error: "webhook error" });
    }
}
