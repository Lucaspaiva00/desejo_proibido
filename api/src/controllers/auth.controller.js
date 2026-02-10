// src/controllers/auth.controller.js
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { assinarToken } from "../utils/jwt.js";
import { logAcesso } from "../utils/auditoria.js";
import { getPremiumStatus, ensureWallet } from "../utils/wallet.js";

import { sendEmail } from "../utils/email.js";
import { gerarTokenRaw, hashToken, addMinutes, safeInt } from "../utils/tokens.js";

/**
 * Monta URL pública (domínio do site/app).
 * - APP_URL deve ser algo como: https://desejoproibido.app
 * - Não coloca /api aqui; você passa o path completo na chamada.
 */
function appUrl(path) {
    const base = (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");
    const p = String(path || "");
    return base + (p.startsWith("/") ? p : `/${p}`);
}

export async function registrar(req, res) {
    try {
        const { email, senha, aceitouTermos } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: "Email e senha são obrigatórios" });
        }

        if (!aceitouTermos) {
            return res
                .status(400)
                .json({ erro: "É obrigatório aceitar os Termos e a Política de Privacidade" });
        }

        const existe = await prisma.usuario.findUnique({ where: { email } });
        if (existe) return res.status(409).json({ erro: "Email já cadastrado" });

        const termosAtivos = await prisma.termo.findMany({
            where: {
                ativo: true,
                tipo: { in: ["TERMOS_USO", "POLITICA_PRIVACIDADE"] },
            },
            select: { id: true, tipo: true },
        });

        if (termosAtivos.length < 2) {
            return res.status(500).json({
                erro:
                    "Termos legais não configurados. Crie TERMOS_USO e POLITICA_PRIVACIDADE como ativos no banco.",
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = await prisma.usuario.create({
            data: {
                email,
                senhaHash,
                emailVerificado: false,
                emailVerificadoEm: null,
                aceitesTermos: {
                    create: termosAtivos.map((t) => ({
                        termoId: t.id,
                        origem: "WEB",
                        ip: req.ip,
                        userAgent: req.headers["user-agent"] || null,
                    })),
                },
            },
            select: { id: true, email: true, criadoEm: true },
        });

        await ensureWallet(usuario.id);

        // ✅ token verificação e-mail
        try {
            const minutes = safeInt(process.env.EMAIL_TOKEN_MINUTES, 60);
            const raw = gerarTokenRaw();
            const tokenHash = hashToken(raw);

            await prisma.emailVerificacaoToken.upsert({
                where: { usuarioId: usuario.id },
                update: { tokenHash, expiraEm: addMinutes(new Date(), minutes) },
                create: { usuarioId: usuario.id, tokenHash, expiraEm: addMinutes(new Date(), minutes) },
            });

            // ✅ Link aponta pra rota do backend (que agora existe em /api e /api/v1)
            const link = appUrl(`/api/auth/verify-email?token=${raw}`);

            await sendEmail({
                to: usuario.email,
                subject: "Confirme seu e-mail — Desejo Proibido",
                html: `
          <p>Olá! Falta só confirmar seu e-mail.</p>
          <p><a href="${link}">Clique aqui para confirmar</a></p>
          <p>Se você não criou conta, ignore esta mensagem.</p>
        `,
            });
        } catch (e) {
            console.error("email verification send error:", e?.message || e);
        }

        const token = assinarToken({ id: usuario.id, email: usuario.email });
        return res.status(201).json({ usuario, token });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao registrar", detalhe: e.message });
    }
}

export async function login(req, res) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            await logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 400,
                email: email || null,
                detalhe: "Email/senha ausentes",
            });
            return res.status(400).json({ erro: "Email e senha são obrigatórios" });
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario) {
            await logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 401,
                email,
                detalhe: "Email não encontrado",
            });
            return res.status(401).json({ erro: "Credenciais inválidas" });
        }

        const ok = await bcrypt.compare(senha, usuario.senhaHash);
        if (!ok) {
            await logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 401,
                usuarioId: usuario.id,
                email,
                detalhe: "Senha inválida",
            });
            return res.status(401).json({ erro: "Credenciais inválidas" });
        }

        if (!usuario.ativo) {
            await logAcesso(req, {
                evento: "LOGIN_BLOQUEADO",
                status: 403,
                usuarioId: usuario.id,
                email,
                detalhe: "Usuário desativado",
            });
            return res.status(403).json({ erro: "Usuário desativado" });
        }

        const ban = await prisma.banGlobal.findUnique({ where: { usuarioId: usuario.id } });
        if (ban?.ativo) {
            const agora = new Date();
            const dentroDoPrazo = !ban.ate || new Date(ban.ate) > agora;
            if (dentroDoPrazo) {
                await logAcesso(req, {
                    evento: "LOGIN_BLOQUEADO",
                    status: 403,
                    usuarioId: usuario.id,
                    email,
                    detalhe: ban.motivo || "Ban global ativo",
                });
                return res.status(403).json({ erro: "Usuário banido" });
            }
        }

        await ensureWallet(usuario.id);

        const token = assinarToken({ id: usuario.id, email: usuario.email });

        await logAcesso(req, {
            evento: "LOGIN_OK",
            status: 200,
            usuarioId: usuario.id,
            email: usuario.email,
        });

        const { saldoCreditos, premiumEfetivo } = await getPremiumStatus(usuario.id);

        return res.json({
            usuario: {
                id: usuario.id,
                email: usuario.email,
                isPremium: premiumEfetivo,
                plano: usuario.plano,
                saldoCreditos,
                emailVerificado: !!usuario.emailVerificado,
            },
            token,
        });
    } catch (e) {
        await logAcesso(req, { evento: "LOGIN_ERRO", status: 500, detalhe: e.message });
        return res.status(500).json({ erro: "Erro ao logar", detalhe: e.message });
    }
}

export async function me(req, res) {
    try {
        const userId = req.usuario.id;
        const { usuario, saldoCreditos, premiumEfetivo } = await getPremiumStatus(userId);

        if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });

        return res.json({
            id: usuario.id,
            email: usuario.email,
            ativo: usuario.ativo,
            role: usuario.role,
            criadoEm: usuario.criadoEm,
            plano: usuario.plano,
            isPremium: premiumEfetivo,
            saldoCreditos,
            emailVerificado: !!usuario.emailVerificado,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}

// ===============================
// ✅ ESQUECI MINHA SENHA
// ===============================
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ erro: "Email é obrigatório" });

        const u = await prisma.usuario.findUnique({ where: { email } });

        // ✅ resposta neutra SEM vazar existência
        if (!u) return res.json({ ok: true });

        const minutes = safeInt(process.env.RESET_TOKEN_MINUTES, 30);
        const raw = gerarTokenRaw();
        const tokenHash = hashToken(raw);

        await prisma.resetSenhaToken.updateMany({
            where: { usuarioId: u.id, usadoEm: null },
            data: { usadoEm: new Date() },
        });

        await prisma.resetSenhaToken.create({
            data: {
                usuarioId: u.id,
                tokenHash,
                expiraEm: addMinutes(new Date(), minutes),
            },
        });

        // ✅ link do FRONT (página pública)
        const link = appUrl(`/reset-password.html?token=${raw}`);

        await sendEmail({
            to: u.email,
            subject: "Redefinir senha — Desejo Proibido",
            html: `
        <p>Você solicitou redefinição de senha.</p>
        <p><a href="${link}">Clique aqui para redefinir</a></p>
        <p>Esse link expira em ${minutes} minutos.</p>
        <p>Se não foi você, ignore.</p>
      `,
        });

        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao solicitar reset", detalhe: e.message });
    }
}

export async function resetPassword(req, res) {
    try {
        const { token, novaSenha } = req.body;

        if (!token || !novaSenha) {
            return res.status(400).json({ erro: "Token e novaSenha são obrigatórios" });
        }

        if (String(novaSenha).length < 6) {
            return res.status(400).json({ erro: "A senha deve ter no mínimo 6 caracteres" });
        }

        const tokenHash = hashToken(token);

        const t = await prisma.resetSenhaToken.findFirst({
            where: {
                tokenHash,
                usadoEm: null,
                expiraEm: { gt: new Date() },
            },
            select: { id: true, usuarioId: true },
        });

        if (!t) return res.status(400).json({ erro: "Token inválido ou expirado" });

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        await prisma.$transaction([
            prisma.usuario.update({
                where: { id: t.usuarioId },
                data: { senhaHash },
            }),
            prisma.resetSenhaToken.update({
                where: { id: t.id },
                data: { usadoEm: new Date() },
            }),
        ]);

        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao redefinir senha", detalhe: e.message });
    }
}

// ===============================
// ✅ VERIFICAÇÃO DE E-MAIL
// ===============================
export async function resendEmailVerification(req, res) {
    try {
        const userId = req.usuario.id;

        const u = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, email: true, emailVerificado: true },
        });

        if (!u) return res.status(401).json({ erro: "Usuário inválido" });
        if (u.emailVerificado) return res.json({ ok: true, jaVerificado: true });

        const minutes = safeInt(process.env.EMAIL_TOKEN_MINUTES, 60);
        const raw = gerarTokenRaw();
        const tokenHash = hashToken(raw);

        await prisma.emailVerificacaoToken.upsert({
            where: { usuarioId: u.id },
            update: { tokenHash, expiraEm: addMinutes(new Date(), minutes) },
            create: { usuarioId: u.id, tokenHash, expiraEm: addMinutes(new Date(), minutes) },
        });

        const link = appUrl(`/api/auth/verify-email?token=${raw}`);

        await sendEmail({
            to: u.email,
            subject: "Confirme seu e-mail — Desejo Proibido",
            html: `
        <p>Confirme seu e-mail:</p>
        <p><a href="${link}">Clique aqui para confirmar</a></p>
        <p>Se não foi você, ignore.</p>
      `,
        });

        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao reenviar verificação", detalhe: e.message });
    }
}

export async function verifyEmail(req, res) {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send("Token ausente");

        const tokenHash = hashToken(String(token));

        const t = await prisma.emailVerificacaoToken.findFirst({
            where: {
                tokenHash,
                expiraEm: { gt: new Date() },
            },
            select: { id: true, usuarioId: true },
        });

        if (!t) return res.status(400).send("Token inválido ou expirado");

        await prisma.$transaction([
            prisma.usuario.update({
                where: { id: t.usuarioId },
                data: { emailVerificado: true, emailVerificadoEm: new Date() },
            }),
            prisma.emailVerificacaoToken.delete({ where: { id: t.id } }),
        ]);

        return res.redirect(appUrl(`/email-verified.html`));
    } catch (e) {
        return res.status(500).send("Erro ao verificar e-mail");
    }
}
