import { verificarToken } from "../utils/jwt.js";

export function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ erro: "Token ausente" });

    const [tipo, token] = header.split(" ");
    if (tipo !== "Bearer" || !token) {
        return res.status(401).json({ erro: "Formato do token inválido" });
    }

    try {
        req.usuario = verificarToken(token); // { id, email }
        return next();
    } catch {
        return res.status(401).json({ erro: "Token inválido ou expirado" });
    }
}
