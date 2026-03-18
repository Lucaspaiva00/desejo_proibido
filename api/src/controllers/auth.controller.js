// src/controllers/auth.controller.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { prisma } from "../prisma.js";
import { assinarToken } from "../utils/jwt.js";
import { logAcesso } from "../utils/auditoria.js";
import { getPremiumStatus, ensureWallet } from "../utils/wallet.js";

import { sendEmail, isSmtpConfigured } from "../utils/email.js";
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

// ======================================================
// PASSKEY / WEBAUTHN HELPERS
// ======================================================

function getExpectedOrigin() {
    return (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");
}

function getRpID() {
    if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID.trim();

    try {
        return new URL(getExpectedOrigin()).hostname;
    } catch {
        return "localhost";
    }
}

function getRpName() {
    return process.env.WEBAUTHN_RP_NAME || "Desejo Proibido";
}

function signPasskeyState(payload, expiresIn = "10m") {
    return jwt.sign(
        { ...payload, type: "passkey_state" },
        process.env.JWT_SECRET,
        { expiresIn }
    );
}

function verifyPasskeyState(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.type !== "passkey_state") {
        throw new Error("State inválido");
    }
    return decoded;
}

function parseTransports(transports) {
    if (!transports) return [];
    if (Array.isArray(transports)) return transports.filter(Boolean);

    try {
        const parsed = JSON.parse(transports);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return String(transports)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
}

function stringifyTransports(transports) {
    return JSON.stringify(Array.isArray(transports) ? transports : []);
}

async function validarUsuarioAtivoPorId(req, userId) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
    });

    if (!usuario) {
        logAcesso(req, {
            evento: "LOGIN_FALHA",
            status: 401,
            detalhe: "Usuário não encontrado",
        });
        return { erro: { status: 401, body: { erro: "Usuário inválido" } } };
    }

    if (!usuario.ativo) {
        logAcesso(req, {
            evento: "LOGIN_BLOQUEADO",
            status: 403,
            usuarioId: usuario.id,
            email: usuario.email,
            detalhe: "Usuário desativado",
        });
        return { erro: { status: 403, body: { erro: "Usuário desativado" } } };
    }

    const ban = await prisma.banGlobal.findUnique({ where: { usuarioId: usuario.id } });
    if (ban?.ativo) {
        const agora = new Date();
        const dentroDoPrazo = !ban.ate || new Date(ban.ate) > agora;
        if (dentroDoPrazo) {
            logAcesso(req, {
                evento: "LOGIN_BLOQUEADO",
                status: 403,
                usuarioId: usuario.id,
                email: usuario.email,
                detalhe: ban.motivo || "Ban global ativo",
            });
            return { erro: { status: 403, body: { erro: "Usuário banido" } } };
        }
    }

    return { usuario };
}

async function montarRespostaLogin(req, usuario) {
    await ensureWallet(usuario.id);

    const token = assinarToken({ id: usuario.id, email: usuario.email });

    logAcesso(req, {
        evento: "LOGIN_OK",
        status: 200,
        usuarioId: usuario.id,
        email: usuario.email,
    });

    const { saldoCreditos, premiumEfetivo } = await getPremiumStatus(usuario.id);

    return {
        usuario: {
            id: usuario.id,
            email: usuario.email,
            isPremium: premiumEfetivo,
            plano: usuario.plano,
            saldoCreditos,
            emailVerificado: !!usuario.emailVerificado,
            idioma: usuario.idioma || "pt",
        },
        token,
    };
}

async function getOrCreateWebauthnUserId(usuarioId) {
    const existing = await prisma.passkey.findFirst({
        where: { usuarioId },
        select: { webauthnUserId: true },
    });

    if (existing?.webauthnUserId) return existing.webauthnUserId;

    return crypto.randomUUID();
}

// ======================================================
// AUTH PADRÃO
// ======================================================

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

        // ✅ token verificação e-mail (NÃO derruba cadastro se SMTP faltar)
        try {
            const minutes = safeInt(process.env.EMAIL_TOKEN_MINUTES, 60);
            const raw = gerarTokenRaw();
            const tokenHash = hashToken(raw);

            await prisma.emailVerificacaoToken.upsert({
                where: { usuarioId: usuario.id },
                update: { tokenHash, expiraEm: addMinutes(new Date(), minutes) },
                create: { usuarioId: usuario.id, tokenHash, expiraEm: addMinutes(new Date(), minutes) },
            });

            if (isSmtpConfigured()) {
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
            } else {
                console.warn("[auth] SMTP não configurado — verificação de e-mail não enviada");
            }
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
            logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 400,
                email: email || null,
                detalhe: "Email/senha ausentes",
            });
            return res.status(400).json({ erro: "Email e senha são obrigatórios" });
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario) {
            logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 401,
                email,
                detalhe: "Email não encontrado",
            });
            return res.status(401).json({ erro: "Credenciais inválidas" });
        }

        const ok = await bcrypt.compare(senha, usuario.senhaHash);
        if (!ok) {
            logAcesso(req, {
                evento: "LOGIN_FALHA",
                status: 401,
                usuarioId: usuario.id,
                email,
                detalhe: "Senha inválida",
            });
            return res.status(401).json({ erro: "Credenciais inválidas" });
        }

        if (!usuario.ativo) {
            logAcesso(req, {
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
                logAcesso(req, {
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

        // não bloquear resposta
        logAcesso(req, {
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
                idioma: usuario.idioma || "pt",
            },
            token,
        });
    } catch (e) {
        logAcesso(req, { evento: "LOGIN_ERRO", status: 500, detalhe: e?.message || String(e) });
        return res.status(500).json({ erro: "Erro ao logar" });
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
            idioma: usuario.idioma || "pt",
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}

// ======================================================
// PASSKEY / WEBAUTHN
// ======================================================

export async function passkeyRegisterOptions(req, res) {
    try {
        const userId = req.usuario.id;

        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, email: true, ativo: true },
        });

        if (!usuario) return res.status(401).json({ erro: "Usuário inválido" });
        if (!usuario.ativo) return res.status(403).json({ erro: "Usuário desativado" });

        const existingPasskeys = await prisma.passkey.findMany({
            where: { usuarioId: usuario.id },
            select: {
                credentialId: true,
                transports: true,
            },
        });

        const webauthnUserId = await getOrCreateWebauthnUserId(usuario.id);

        const options = await generateRegistrationOptions({
            rpName: getRpName(),
            rpID: getRpID(),
            userID: Buffer.from(webauthnUserId, "utf8"),
            userName: usuario.email,
            userDisplayName: usuario.email,
            timeout: 60000,
            attestationType: "none",
            excludeCredentials: existingPasskeys.map((p) => ({
                id: p.credentialId,
                transports: parseTransports(p.transports),
            })),
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "required",
                authenticatorAttachment: "platform",
            },
            supportedAlgorithmIDs: [-7, -257],
        });

        const state = signPasskeyState({
            action: "register",
            challenge: options.challenge,
            usuarioId: usuario.id,
            webauthnUserId,
        });

        return res.json({ options, state });
    } catch (e) {
        console.error("passkeyRegisterOptions error:", e);
        return res.status(500).json({ erro: "Erro ao gerar opções de cadastro da biometria" });
    }
}

export async function passkeyRegisterVerify(req, res) {
    try {
        const { response, state } = req.body;

        if (!response || !state) {
            return res.status(400).json({ erro: "response e state são obrigatórios" });
        }

        let decoded;
        try {
            decoded = verifyPasskeyState(state);
        } catch {
            return res.status(400).json({ erro: "State inválido ou expirado" });
        }

        if (decoded.action !== "register") {
            return res.status(400).json({ erro: "State inválido para cadastro de passkey" });
        }

        if (decoded.usuarioId !== req.usuario.id) {
            return res.status(403).json({ erro: "State não pertence ao usuário autenticado" });
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: decoded.challenge,
            expectedOrigin: getExpectedOrigin(),
            expectedRPID: getRpID(),
            requireUserVerification: true,
        });

        const { verified, registrationInfo } = verification;

        if (!verified || !registrationInfo) {
            return res.status(400).json({ erro: "Não foi possível validar a biometria" });
        }

        const credentialId = registrationInfo.credential.id;

        const jaExiste = await prisma.passkey.findUnique({
            where: { credentialId },
            select: { id: true },
        });

        if (jaExiste) {
            return res.json({ ok: true, duplicada: true });
        }

        await prisma.passkey.create({
            data: {
                usuarioId: decoded.usuarioId,
                webauthnUserId: decoded.webauthnUserId,
                credentialId,
                publicKey: Buffer.from(registrationInfo.credential.publicKey),
                counter: registrationInfo.credential.counter,
                deviceType: registrationInfo.credentialDeviceType,
                backedUp: registrationInfo.credentialBackedUp,
                transports: stringifyTransports(response.response?.transports || []),
            },
        });

        logAcesso(req, {
            evento: "PASSKEY_REGISTRO_OK",
            status: 200,
            usuarioId: decoded.usuarioId,
            email: req.usuario.email,
        });

        return res.json({ ok: true });
    } catch (e) {
        console.error("passkeyRegisterVerify error:", e);
        logAcesso(req, {
            evento: "PASSKEY_REGISTRO_ERRO",
            status: 500,
            usuarioId: req.usuario?.id,
            email: req.usuario?.email,
            detalhe: e?.message || String(e),
        });
        return res.status(500).json({ erro: "Erro ao validar cadastro da biometria" });
    }
}

export async function passkeyLoginOptions(req, res) {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ erro: "Email é obrigatório para login com biometria" });
        }

        const usuario = await prisma.usuario.findUnique({
            where: { email },
            select: { id: true, email: true, ativo: true },
        });

        // resposta neutra só até onde der; para login biométrico precisa haver passkey cadastrada
        if (!usuario) {
            return res.status(404).json({ erro: "Nenhuma biometria cadastrada para este e-mail" });
        }

        if (!usuario.ativo) {
            return res.status(403).json({ erro: "Usuário desativado" });
        }

        const passkeys = await prisma.passkey.findMany({
            where: { usuarioId: usuario.id },
            select: {
                credentialId: true,
                transports: true,
            },
        });

        if (!passkeys.length) {
            return res.status(404).json({ erro: "Nenhuma biometria cadastrada para este e-mail" });
        }

        const options = await generateAuthenticationOptions({
            rpID: getRpID(),
            timeout: 60000,
            userVerification: "required",
            allowCredentials: passkeys.map((p) => ({
                id: p.credentialId,
                transports: parseTransports(p.transports),
            })),
        });

        const state = signPasskeyState({
            action: "login",
            challenge: options.challenge,
            email: usuario.email,
        });

        return res.json({ options, state });
    } catch (e) {
        console.error("passkeyLoginOptions error:", e);
        return res.status(500).json({ erro: "Erro ao gerar opções de login com biometria" });
    }
}

export async function passkeyLoginVerify(req, res) {
    try {
        const { response, state } = req.body;

        if (!response || !state) {
            return res.status(400).json({ erro: "response e state são obrigatórios" });
        }

        let decoded;
        try {
            decoded = verifyPasskeyState(state);
        } catch {
            return res.status(400).json({ erro: "State inválido ou expirado" });
        }

        if (decoded.action !== "login") {
            return res.status(400).json({ erro: "State inválido para login de passkey" });
        }

        const credentialId = response.id;
        if (!credentialId) {
            return res.status(400).json({ erro: "Credencial inválida" });
        }

        const passkey = await prisma.passkey.findUnique({
            where: { credentialId },
            include: {
                usuario: true,
            },
        });

        if (!passkey) {
            logAcesso(req, {
                evento: "PASSKEY_LOGIN_FALHA",
                status: 401,
                email: decoded.email || null,
                detalhe: "Credencial não encontrada",
            });
            return res.status(401).json({ erro: "Credencial inválida" });
        }

        if (decoded.email && passkey.usuario.email !== decoded.email) {
            logAcesso(req, {
                evento: "PASSKEY_LOGIN_FALHA",
                status: 401,
                email: decoded.email,
                usuarioId: passkey.usuarioId,
                detalhe: "Credencial não pertence ao e-mail informado",
            });
            return res.status(401).json({ erro: "Credencial inválida" });
        }

        const validacao = await validarUsuarioAtivoPorId(req, passkey.usuarioId);
        if (validacao.erro) {
            return res.status(validacao.erro.status).json(validacao.erro.body);
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: decoded.challenge,
            expectedOrigin: getExpectedOrigin(),
            expectedRPID: getRpID(),
            credential: {
                id: passkey.credentialId,
                publicKey: new Uint8Array(passkey.publicKey),
                counter: passkey.counter,
                transports: parseTransports(passkey.transports),
            },
            requireUserVerification: true,
        });

        const { verified, authenticationInfo } = verification;

        if (!verified) {
            logAcesso(req, {
                evento: "PASSKEY_LOGIN_FALHA",
                status: 401,
                usuarioId: passkey.usuarioId,
                email: passkey.usuario.email,
                detalhe: "Verificação WebAuthn falhou",
            });
            return res.status(401).json({ erro: "Falha ao autenticar com biometria" });
        }

        await prisma.passkey.update({
            where: { id: passkey.id },
            data: {
                counter: authenticationInfo.newCounter,
                atualizadoEm: new Date(),
            },
        });

        logAcesso(req, {
            evento: "PASSKEY_LOGIN_OK",
            status: 200,
            usuarioId: passkey.usuarioId,
            email: passkey.usuario.email,
        });

        const payload = await montarRespostaLogin(req, passkey.usuario);
        return res.json(payload);
    } catch (e) {
        console.error("passkeyLoginVerify error:", e);
        logAcesso(req, {
            evento: "PASSKEY_LOGIN_ERRO",
            status: 500,
            detalhe: e?.message || String(e),
        });
        return res.status(500).json({ erro: "Erro ao autenticar com biometria" });
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

        const link = appUrl(`/reset-password.html?token=${raw}`);

        if (isSmtpConfigured()) {
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
        } else {
            console.warn("[auth] SMTP não configurado — forgot-password não enviou e-mail");
        }

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

        if (isSmtpConfigured()) {
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
        } else {
            console.warn("[auth] SMTP não configurado — resend-verification não enviou e-mail");
        }

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