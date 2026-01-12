import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { assinarToken } from "../utils/jwt.js";

export async function registrar(req, res) {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: "Email e senha são obrigatórios" });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(409).json({ erro: "Email já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
        data: { email, senhaHash },
        select: { id: true, email: true, criadoEm: true }
    });

    const token = assinarToken({ id: usuario.id, email: usuario.email });
    return res.status(201).json({ usuario, token });
}

export async function login(req, res) {
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
        token
    });
}

export async function me(req, res) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { id: true, email: true, ativo: true, criadoEm: true }
    });

    return res.json(usuario);
}
