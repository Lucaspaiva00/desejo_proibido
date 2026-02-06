// src/controllers/auth.controller.js
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { assinarToken } from "../utils/jwt.js";
import { logAcesso } from "../utils/auditoria.js";
import { getPremiumStatus, ensureWallet } from "../utils/wallet.js";

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

        // ✅ Busca termos ativos
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

        // cria wallet imediatamente (opcional, mas ajuda)
        await ensureWallet(usuario.id);

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

        // ✅ devolve status premium efetivo já no login (opcional, mas ajuda no front)
        const { saldoCreditos, premiumEfetivo } = await getPremiumStatus(usuario.id);

        return res.json({
            usuario: {
                id: usuario.id,
                email: usuario.email,
                isPremium: premiumEfetivo,
                plano: usuario.plano,
                saldoCreditos,
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
            isPremium: premiumEfetivo, // ✅ calculado
            saldoCreditos,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}
