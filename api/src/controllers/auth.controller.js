import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { assinarToken } from "../utils/jwt.js";

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

        // ✅ Busca termos ativos (Termos de Uso + Política)
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

        // ✅ Cria usuário e registra os aceites no mesmo create
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
            return res.status(400).json({ erro: "Email e senha são obrigatórios" });
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario) return res.status(401).json({ erro: "Credenciais inválidas" });

        const ok = await bcrypt.compare(senha, usuario.senhaHash);
        if (!ok) return res.status(401).json({ erro: "Credenciais inválidas" });

        const token = assinarToken({ id: usuario.id, email: usuario.email });

        return res.json({
            usuario: { id: usuario.id, email: usuario.email },
            token,
        });
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao logar", detalhe: e.message });
    }
}

export async function me(req, res) {
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: req.usuario.id },
            select: { id: true, email: true, ativo: true, role: true, criadoEm: true },
        });

        return res.json(usuario);
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao buscar usuário", detalhe: e.message });
    }
}
