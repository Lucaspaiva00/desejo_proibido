// src/controllers/mensagem.controller.js
import { prisma } from "../prisma.js";
import {
    isChatUnlocked,
    isPremiumEfetivo,
    debitWallet,
    ensureWallet,
    getSaldoCreditos
} from "../utils/wallet.js";
import { buildPublicUrl } from "../utils/cloudinary.js";
import { containsContato, contatoReason } from "../utils/antiContato.js";

// ============================
// Config
// ============================
// ✅ agora por padrão 10
const DEFAULT_FOTO_UNLOCK_COST = Number(process.env.FOTO_UNLOCK_COST || 10);
const DEFAULT_AUDIO_UNLOCK_COST = Number(process.env.AUDIO_UNLOCK_COST || 10);

// ✅ custo por mensagem TEXTO
const MSG_SEND_COST = Number(process.env.MSG_SEND_COST || 5);

// ============================
// Helpers locais
// ============================
async function alreadyUnlockedMedia(userId, mensagemId) {
    const tx = await prisma.walletTx.findFirst({
        where: { userId, origem: "MIDIA_UNLOCK", tipo: "DEBIT", refId: String(mensagemId) },
        select: { id: true },
    });
    return !!tx;
}

async function debitForMediaUnlockTx({ userId, mensagemId, valor }) {
    await ensureWallet(userId);

    return prisma.$transaction(async (tx) => {
        const w = await tx.wallet.findUnique({ where: { userId } });
        const saldo = w?.saldoCreditos ?? 0;

        if (saldo < valor) {
            const err = new Error("Saldo insuficiente");
            err.status = 402;
            err.code = "SALDO_INSUFICIENTE";
            throw err;
        }

        await tx.wallet.update({
            where: { userId },
            data: { saldoCreditos: { decrement: valor } },
        });

        await tx.walletTx.create({
            data: { userId, tipo: "DEBIT", origem: "MIDIA_UNLOCK", valor, refId: String(mensagemId) },
        });

        const w2 = await tx.wallet.findUnique({ where: { userId } });
        return { saldoCreditos: w2?.saldoCreditos ?? 0 };
    });
}

function assertParteDaConversa(conv, userId) {
    const match = conv?.match;
    if (!match) return false;
    return match.usuarioAId === userId || match.usuarioBId === userId;
}

function splitPath(p) {
    const s = String(p || "").trim();
    if (!s) return { publicId: null, format: null };
    const lastDot = s.lastIndexOf(".");
    if (lastDot <= 0) return { publicId: s, format: null };
    return { publicId: s.slice(0, lastDot), format: s.slice(lastDot + 1) };
}

// ============================
// TEXT: POST /mensagens
// ============================
export async function enviarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, texto } = req.body;

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!texto || !String(texto).trim()) return res.status(400).json({ erro: "texto é obrigatório" });

        const textoLimpo = String(texto).trim();

        if (containsContato(textoLimpo)) {
            return res.status(400).json({
                erro: "Não é permitido enviar dados de contato (WhatsApp, Instagram, links ou e-mail).",
                code: "CONTATO_BLOQUEADO",
                motivo: contatoReason(textoLimpo),
            });
        }

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);

        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para enviar mensagens.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        if (MSG_SEND_COST > 0) {
            try {
                await debitWallet(userId, MSG_SEND_COST, { origem: "MSG_SEND", refId: conversaId });
            } catch (e) {
                const st = e?.status || e?.statusCode;
                if (st === 402 || e?.code === "SALDO_INSUFICIENTE") {
                    const saldo = await getSaldoCreditos(userId);
                    return res.status(402).json({
                        code: "SALDO_INSUFICIENTE",
                        erro: "Saldo insuficiente para enviar mensagem.",
                        custo: MSG_SEND_COST,
                        saldoCreditos: saldo,
                    });
                }
                throw e;
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "TEXTO",
                texto: textoLimpo,
                textoOriginal: textoLimpo,
                idiomaOriginal,
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        const saldoCreditos = await getSaldoCreditos(userId);
        return res.status(201).json({ ...msg, saldoCreditos, msgCost: MSG_SEND_COST });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar mensagem", detalhe: e.message });
    }
}

// ============================
// FOTO: POST /mensagens/foto
// body: { conversaId, mediaPath, thumbPath?, custoMoedas? }
// ============================
export async function enviarFoto(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, mediaPath, thumbPath, custoMoedas } = req.body || {};

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!mediaPath) return res.status(400).json({ erro: "mediaPath é obrigatório (Cloudinary publicId.format)" });

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({ erro: "Chat bloqueado. Libere o chat com créditos para enviar.", code: "CHAT_LOCKED" });
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();
        const custo = Number.isFinite(Number(custoMoedas)) ? Number(custoMoedas) : DEFAULT_FOTO_UNLOCK_COST;

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "FOTO",
                texto: "📷 Foto",
                textoOriginal: "📷 Foto",
                idiomaOriginal,
                mediaPath: String(mediaPath),
                thumbPath: String(thumbPath || mediaPath),
                bloqueada: true,
                custoMoedas: custo > 0 ? custo : 0,
                metaJson: { kind: "photo", locked: true },
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar foto", detalhe: e.message });
    }
}

// ============================
// AUDIO: POST /mensagens/audio
// body: { conversaId, mediaPath, duracao? }
// ============================
export async function enviarAudio(req, res) {
    try {
        const userId = req.usuario.id;
        const { conversaId, mediaPath, duracao } = req.body || {};

        if (!conversaId) return res.status(400).json({ erro: "conversaId é obrigatório" });
        if (!mediaPath) return res.status(400).json({ erro: "mediaPath é obrigatório (Cloudinary publicId.format)" });

        const conv = await prisma.conversa.findUnique({
            where: { id: conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });

        const isParte = conv.match.usuarioAId === userId || conv.match.usuarioBId === userId;
        if (!isParte) return res.status(403).json({ erro: "Sem acesso a esta conversa" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({ erro: "Chat bloqueado. Libere o chat com créditos para enviar.", code: "CHAT_LOCKED" });
            }
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();
        const custo = DEFAULT_AUDIO_UNLOCK_COST;

        const msg = await prisma.mensagem.create({
            data: {
                conversaId,
                autorId: userId,
                tipo: "AUDIO",
                texto: "🎙️ Áudio",
                textoOriginal: "🎙️ Áudio",
                idiomaOriginal,
                mediaPath: String(mediaPath),
                mediaDuracao: Number.isFinite(Number(duracao)) ? Number(duracao) : null,
                bloqueada: true,
                custoMoedas: custo > 0 ? custo : 0,
                metaJson: { kind: "audio", locked: true },
            },
        });

        await prisma.conversa.update({
            where: { id: conversaId },
            data: { atualizadoEm: new Date() },
        });

        return res.status(201).json(msg);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao enviar áudio", detalhe: e.message });
    }
}

// ============================
// DESBLOQUEAR: POST /mensagens/:id/desbloquear
// ============================
export async function desbloquearMidia(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: mensagemId } = req.params;

        const m = await prisma.mensagem.findUnique({
            where: { id: String(mensagemId) },
            select: {
                id: true,
                conversaId: true,
                tipo: true,
                autorId: true,
                bloqueada: true,
                custoMoedas: true,
                foiApagada: true,
            },
        });

        if (!m) return res.status(404).json({ erro: "Mensagem não encontrada" });
        if (m.foiApagada) return res.status(410).json({ erro: "Mensagem apagada" });
        if (m.tipo !== "FOTO" && m.tipo !== "AUDIO") return res.status(400).json({ erro: "Mensagem não é mídia" });

        if (String(m.autorId) === String(userId)) {
            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: true, saldoCreditos: saldo });
        }

        const conv = await prisma.conversa.findUnique({
            where: { id: m.conversaId },
            include: { match: true },
        });
        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
        if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

        const premiumEfetivo = await isPremiumEfetivo(userId);
        if (!premiumEfetivo) {
            const unlocked = await isChatUnlocked(m.conversaId, userId);
            if (!unlocked) {
                return res.status(402).json({
                    erro: "Chat bloqueado. Libere o chat com créditos para desbloquear mídia.",
                    code: "CHAT_LOCKED",
                });
            }
        }

        const ja = await alreadyUnlockedMedia(userId, m.id);
        if (ja) {
            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: true, saldoCreditos: saldo });
        }

        const custo = Number(m.custoMoedas || 0);
        if (custo <= 0) {
            await prisma.walletTx.create({
                data: { userId, tipo: "DEBIT", origem: "MIDIA_UNLOCK", valor: 0, refId: String(m.id) },
            });

            const saldo = await getSaldoCreditos(userId);
            return res.json({ ok: true, jaLiberado: false, saldoCreditos: saldo });
        }

        const r = await debitForMediaUnlockTx({ userId, mensagemId: m.id, valor: custo });

        return res.json({ ok: true, jaLiberado: false, saldoCreditos: r.saldoCreditos });
    } catch (e) {
        const status = e?.status || 500;
        if (status === 402) {
            return res.status(402).json({ code: e?.code || "SALDO_INSUFICIENTE", erro: e.message || "Saldo insuficiente" });
        }
        return res.status(500).json({ erro: "Erro ao desbloquear mídia", detalhe: e.message });
    }
}

// ============================
// OBTER MÍDIA: GET /mensagens/:id/midia
// ============================
export async function obterMidia(req, res) {
    try {
        const userId = req.usuario.id;
        const { id: mensagemId } = req.params;

        const m = await prisma.mensagem.findUnique({
            where: { id: String(mensagemId) },
            select: {
                id: true,
                conversaId: true,
                tipo: true,
                autorId: true,
                mediaPath: true,
                thumbPath: true,
                bloqueada: true,
                custoMoedas: true,
                mediaDuracao: true,
                foiApagada: true,
            },
        });

        if (!m) return res.status(404).json({ erro: "Mensagem não encontrada" });
        if (m.foiApagada) return res.status(410).json({ erro: "Mensagem apagada" });

        const conv = await prisma.conversa.findUnique({
            where: { id: m.conversaId },
            include: { match: true },
        });
        if (!conv) return res.status(404).json({ erro: "Conversa não encontrada" });
        if (!assertParteDaConversa(conv, userId)) return res.status(403).json({ erro: "Sem acesso" });

        if (m.tipo === "FOTO") {
            const isAutor = String(m.autorId) === String(userId);
            const unlocked = isAutor ? true : await alreadyUnlockedMedia(userId, m.id);

            const { publicId: tId, format: tFmt } = splitPath(m.thumbPath);
            const thumbUrl = tId
                ? buildPublicUrl({
                    publicId: tId,
                    resourceType: "image",
                    format: tFmt || "jpg",
                })
                : null;

            if (!unlocked) {
                return res.json({
                    tipo: "FOTO",
                    locked: true,
                    custoMoedas: Number(m.custoMoedas || 0),
                    thumbUrl,
                });
            }

            const { publicId, format } = splitPath(m.mediaPath);
            const url = publicId ? buildPublicUrl({ publicId, resourceType: "image", format: format || "jpg" }) : null;

            return res.json({ tipo: "FOTO", locked: false, url, thumbUrl });
        }

        if (m.tipo === "AUDIO") {
            const isAutor = String(m.autorId) === String(userId);
            const unlocked = isAutor ? true : await alreadyUnlockedMedia(userId, m.id);

            if (!unlocked) {
                return res.json({
                    tipo: "AUDIO",
                    locked: true,
                    custoMoedas: Number(m.custoMoedas || 0),
                    duracao: m.mediaDuracao ?? null,
                });
            }

            const { publicId, format } = splitPath(m.mediaPath);
            const audioUrl = publicId
                ? buildPublicUrl({ publicId, resourceType: "video", format: format || "mp3" })
                : null;

            return res.json({ tipo: "AUDIO", locked: false, audioUrl, duracao: m.mediaDuracao ?? null });
        }

        return res.status(400).json({ erro: "Mensagem não é mídia" });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao obter mídia", detalhe: e.message });
    }
}

// ============================
// ENCAMINHAR: POST /mensagens/encaminhar
// body: { mensagemId, conversaIdDestino }
// ============================
export async function encaminharMidia(req, res) {
    try {
        const userId = req.usuario.id;
        const { mensagemId, conversaIdDestino } = req.body || {};

        if (!mensagemId) return res.status(400).json({ erro: "mensagemId é obrigatório" });
        if (!conversaIdDestino) return res.status(400).json({ erro: "conversaIdDestino é obrigatório" });

        const m = await prisma.mensagem.findUnique({
            where: { id: String(mensagemId) },
            select: {
                id: true,
                conversaId: true,
                tipo: true,
                autorId: true,
                mediaPath: true,
                thumbPath: true,
                mediaDuracao: true,
                foiApagada: true,
            },
        });

        if (!m) return res.status(404).json({ erro: "Mensagem não encontrada" });
        if (m.foiApagada) return res.status(410).json({ erro: "Mensagem apagada" });
        if (m.tipo !== "FOTO" && m.tipo !== "AUDIO") {
            return res.status(400).json({ erro: "Só é possível encaminhar FOTO ou AUDIO" });
        }

        const convOrigem = await prisma.conversa.findUnique({
            where: { id: m.conversaId },
            include: { match: true },
        });
        if (!convOrigem || !assertParteDaConversa(convOrigem, userId)) {
            return res.status(403).json({ erro: "Sem acesso à conversa de origem" });
        }

        const convDestino = await prisma.conversa.findUnique({
            where: { id: String(conversaIdDestino) },
            include: { match: true },
        });
        if (!convDestino || !assertParteDaConversa(convDestino, userId)) {
            return res.status(403).json({ erro: "Sem acesso à conversa destino" });
        }

        const idiomaOriginal = String(req.usuario?.idioma || "pt").toLowerCase();
        const custo = (m.tipo === "FOTO") ? DEFAULT_FOTO_UNLOCK_COST : DEFAULT_AUDIO_UNLOCK_COST;

        const nova = await prisma.mensagem.create({
            data: {
                conversaId: String(conversaIdDestino),
                autorId: userId,
                tipo: m.tipo,
                texto: m.tipo === "FOTO" ? "📷 Foto" : "🎙️ Áudio",
                textoOriginal: m.tipo === "FOTO" ? "📷 Foto" : "🎙️ Áudio",
                idiomaOriginal,
                mediaPath: m.mediaPath,
                thumbPath: m.thumbPath,
                mediaDuracao: m.mediaDuracao ?? null,
                bloqueada: true,
                custoMoedas: custo > 0 ? custo : 0,
                metaJson: {
                    kind: m.tipo === "FOTO" ? "photo" : "audio",
                    locked: true,
                    forwarded: true,
                    forwardedFromMensagemId: String(m.id),
                    forwardedFromConversaId: String(m.conversaId),
                },
            },
        });

        await prisma.conversa.update({
            where: { id: String(conversaIdDestino) },
            data: { atualizadoEm: new Date() },
        });

        return res.json({ ok: true, mensagem: nova });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao encaminhar", detalhe: e.message });
    }
}

// ============================
// APAGAR: DELETE /mensagens/:id
// ============================
export async function apagarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { id } = req.params;

        const mensagem = await prisma.mensagem.findUnique({
            where: { id: String(id) },
            select: {
                id: true,
                conversaId: true,
                autorId: true,
                tipo: true,
                foiApagada: true,
                metaJson: true,
            },
        });

        if (!mensagem) {
            return res.status(404).json({ erro: "Mensagem não encontrada" });
        }

        if (mensagem.foiApagada) {
            return res.json({ ok: true, jaApagada: true });
        }

        if (String(mensagem.autorId) !== String(userId)) {
            return res.status(403).json({ erro: "Você só pode apagar mensagens enviadas por você" });
        }

        const conv = await prisma.conversa.findUnique({
            where: { id: mensagem.conversaId },
            include: { match: { select: { usuarioAId: true, usuarioBId: true } } },
        });

        if (!conv) {
            return res.status(404).json({ erro: "Conversa não encontrada" });
        }

        const isParte = conv.match?.usuarioAId === userId || conv.match?.usuarioBId === userId;
        if (!isParte) {
            return res.status(403).json({ erro: "Sem acesso a esta conversa" });
        }

        const metaAtual =
            mensagem.metaJson && typeof mensagem.metaJson === "object"
                ? mensagem.metaJson
                : {};

        const msgAtualizada = await prisma.mensagem.update({
            where: { id: String(id) },
            data: {
                foiApagada: true,
                apagadaEm: new Date(),
                apagadaPorId: userId,
                texto: "Mensagem apagada",
                textoOriginal: "Mensagem apagada",
                mediaPath: null,
                thumbPath: null,
                mediaMime: null,
                mediaSize: null,
                mediaDuracao: null,
                bloqueada: false,
                custoMoedas: null,
                metaJson: {
                    ...metaAtual,
                    deleted: true,
                    deletedForEveryone: true,
                },
            },
        });

        return res.json({
            ok: true,
            mensagem: msgAtualizada,
        });
    } catch (e) {
        return res.status(500).json({
            erro: "Erro ao apagar mensagem",
            detalhe: e.message,
        });
    }
}

export async function editarMensagem(req, res) {
    try {
        const userId = req.usuario.id;
        const { id } = req.params;
        const { texto } = req.body;

        console.log("EDITAR req.params.id =", id);
        console.log("EDITAR req.body =", req.body);
        console.log("EDITAR texto =", texto);

        if (!texto || !String(texto).trim()) {
            return res.status(400).json({ erro: "Texto é obrigatório" });
        }

        const mensagem = await prisma.mensagem.findUnique({
            where: { id: String(id) },
            select: {
                id: true,
                conversaId: true,
                autorId: true,
                tipo: true,
                foiApagada: true,
                metaJson: true,
            },
        });

        console.log("EDITAR mensagem encontrada =", mensagem);

        if (!mensagem) {
            return res.status(404).json({ erro: "Mensagem não encontrada" });
        }

        if (mensagem.foiApagada) {
            return res.status(400).json({ erro: "Mensagem já foi apagada" });
        }

        if (mensagem.tipo !== "TEXTO") {
            return res.status(400).json({ erro: "Só é possível editar mensagens de texto" });
        }

        if (String(mensagem.autorId) !== String(userId)) {
            return res.status(403).json({ erro: "Você só pode editar suas próprias mensagens" });
        }

        const textoLimpo = String(texto).trim();

        const atualizada = await prisma.mensagem.update({
            where: { id: String(id) },
            data: {
                texto: textoLimpo,
                textoOriginal: textoLimpo,
            },
        });

        return res.json({ ok: true, mensagem: atualizada });
    } catch (e) {
        console.error("ERRO EDITAR BACK:", e);
        return res.status(500).json({
            erro: "Erro ao editar mensagem",
            detalhe: e.message,
        });
    }
}