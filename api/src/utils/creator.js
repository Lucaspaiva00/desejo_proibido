export function normalizeGender(value) {
  return String(value || "").trim().toUpperCase();
}

export function isFemaleGender(value) {
  return ["F", "FEMININO", "FEMALE", "MULHER"].includes(normalizeGender(value));
}

export function isMaleGender(value) {
  return ["M", "MASCULINO", "MALE", "HOMEM"].includes(normalizeGender(value));
}

export function idadeEmAnos(nascimento, now = new Date()) {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const month = now.getUTCMonth() - d.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function isAdult(nascimento) {
  const age = idadeEmAnos(nascimento);
  return Number.isInteger(age) && age >= 18;
}

export function creatorApproved(usuario) {
  if (!usuario) return false;
  const status = String(usuario.creatorStatus || "NAO_SOLICITADO").toUpperCase();
  if (status === "APROVADA") return true;
  if (["PENDENTE", "BLOQUEADA", "REPROVADA"].includes(status)) return false;
  // Compatibilidade: perfis já verificados antes deste pacote continuam elegíveis
  // apenas enquanto ainda não passaram pelo novo fluxo administrativo.
  return status === "NAO_SOLICITADO" && usuario?.perfil?.verificado === true;
}

export function creatorCanBroadcast(usuario) {
  return !!usuario?.ativo &&
    isFemaleGender(usuario?.perfil?.genero) &&
    isAdult(usuario?.perfil?.nascimento) &&
    creatorApproved(usuario);
}
