export const API_BASE = "https://desejoproibido.app/api";
// export const API_BASE = "http://localhost:5000";

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  location.href = "index.html";
}

export async function apiFetch(
  path,
  { method = "GET", body, headers = {} } = {}
) {
  const token = getToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && (data.erro || data.error || data.message)) ||
      `Erro HTTP ${res.status}`;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
