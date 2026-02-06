const API_BASE = "https://desejoproibido.app/api";
// const API_BASE = "http://localhost:5000";

function getToken() {
  return localStorage.getItem("token") || "";
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("auth");
  location.href = "index.html";
}

async function apiFetch(path, options = {}) {
  if (!path || typeof path !== "string") {
    throw new Error("apiFetch: path inválido");
  }

  if (path.includes("undefined") || path.includes("null")) {
    throw new Error("apiFetch: path inválido → " + path);
  }

  const method = options.method || "GET";
  const body = options.body;
  const headers = options.headers || {};

  const token = getToken();
  const url = path.startsWith("http") ? path : API_BASE + path;

  const fetchOptions = {
    method,
    headers: { ...headers },
  };

  if (body) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  if (token) {
    fetchOptions.headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(url, fetchOptions);

  const ct = res.headers.get("content-type") || "";
  let data = null;

  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const err = new Error(
      data?.erro || data?.error || data?.message || `Erro HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export { API_BASE, getToken, setToken, logout, apiFetch };
