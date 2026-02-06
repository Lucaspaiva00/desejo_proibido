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

// ✅ Compat/normalize: evita chamar rota inexistente
function normalizePath(path) {
  if (!path || typeof path !== "string") return path;

  // Se vier /conversas/:id (rota que NÃO existe no backend),
  // converte para /conversas/:id/status (rota que existe)
  if (path.startsWith("/conversas/")) {
    const parts = path.split("/").filter(Boolean); // ["conversas", ":id"]
    if (parts.length === 2) {
      const id = parts[1];
      return `/conversas/${id}/status`;
    }
  }

  return path;
}

async function apiFetch(path, options = {}) {
  if (!path || typeof path !== "string") {
    throw new Error("apiFetch: path inválido");
  }

  if (path.indexOf("undefined") !== -1 || path.indexOf("null") !== -1) {
    throw new Error("apiFetch: path inválido → " + path);
  }

  path = normalizePath(path);

  const method = options.method || "GET";
  const body = options.body;
  const headers = options.headers || {};

  const token = getToken();
  const url = path.indexOf("http") === 0 ? path : API_BASE + path;

  const fetchOptions = {
    method,
    headers: {},
  };

  if (body) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  if (token) {
    fetchOptions.headers["Authorization"] = "Bearer " + token;
  }

  for (const h in headers) {
    fetchOptions.headers[h] = headers[h];
  }

  const res = await fetch(url, fetchOptions);

  const ct = res.headers.get("content-type") || "";
  let data = null;

  if (ct.indexOf("application/json") !== -1) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.erro || data.error || data.message)) ||
      "Erro HTTP " + res.status;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export { API_BASE, getToken, setToken, logout, apiFetch };
