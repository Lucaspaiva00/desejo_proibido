import { prisma } from "../prisma.js";

export async function presentearCreditos(req, res) {

    try {

        const remetenteId = req.usuario?.id;

        const {
            destinatarioId,
            valor,
            mensagem
        } = req.body || {};

        const valorNumerico = Number(valor);

        // validações
        if (!destinatarioId) {
            return res.status(400).json({
                error: "Destinatário obrigatório"
            });
        }

        if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({
                error: "Valor inválido"
            });
        }

        if (String(remetenteId) === String(destinatarioId)) {
            return res.status(400).json({
                error: "Você não pode transferir para si mesmo"
            });
        }

        // verifica destinatário
        const destinatario = await prisma.usuario.findUnique({
            where: {
                id: destinatarioId
            },
            select: {
                id: true
            }
        });

        if (!destinatario) {
            return res.status(404).json({
                error: "Usuário não encontrado"
            });
        }

        // garante wallets
        await prisma.wallet.upsert({
            where: { userId: remetenteId },
            update: {},
            create: {
                userId: remetenteId,
                saldoCreditos: 0
            }
        });

        await prisma.wallet.upsert({
            where: { userId: destinatarioId },
            update: {},
            create: {
                userId: destinatarioId,
                saldoCreditos: 0
            }
        });

        // transaction
        const result = await prisma.$transaction(async (tx) => {

            const walletRemetente = await tx.wallet.findUnique({
                where: {
                    userId: remetenteId
                }
            });

            const saldoAtual =
                Number(walletRemetente?.saldoCreditos || 0);

            if (saldoAtual < valorNumerico) {
                throw new Error("Saldo insuficiente");
            }

            // debita remetente
            const remetenteWallet =
                await tx.wallet.update({
                    where: {
                        userId: remetenteId
                    },
                    data: {
                        saldoCreditos: {
                            decrement: valorNumerico
                        }
                    }
                });

            // credita destinatário
            await tx.wallet.update({
                where: {
                    userId: destinatarioId
                },
                data: {
                    saldoCreditos: {
                        increment: valorNumerico
                    }
                }
            });

            // tx remetente
            await tx.walletTx.create({
                data: {
                    userId: remetenteId,
                    tipo: "DEBIT",
                    origem: "TRANSFERENCIA_ENVIO",
                    valor: valorNumerico,
                    refId: destinatarioId
                }
            });

            // tx destinatário
            await tx.walletTx.create({
                data: {
                    userId: destinatarioId,
                    tipo: "CREDIT",
                    origem: "TRANSFERENCIA_RECEBIDA",
                    valor: valorNumerico,
                    refId: remetenteId
                }
            });

            // histórico gift
            await tx.giftCredito.create({
                data: {
                    remetenteId,
                    destinatarioId,
                    valor: valorNumerico,
                    mensagem: mensagem || null
                }
            });

            return {
                saldoCreditos:
                    remetenteWallet.saldoCreditos
            };
        });

        // realtime
        const io = req.app.get("io");

        if (io?._dp) {

            io._dp.emitToUser(
                destinatarioId,
                "gift:received",
                {
                    valor: valorNumerico,
                    mensagem
                }
            );

            io._dp.emitToUser(
                remetenteId,
                "wallet:update",
                {
                    saldoCreditos:
                        result.saldoCreditos
                }
            );
        }

        return res.json({
            ok: true,
            saldoCreditos:
                result.saldoCreditos
        });

    } catch (e) {

        console.error(e);

        return res.status(500).json({
            error: e.message || "Erro interno"
        });
    }
}