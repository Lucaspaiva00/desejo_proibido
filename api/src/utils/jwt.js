import jwt from "jsonwebtoken";

export function assinarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
