// webadmin/assets/js/api.js
export const API_BASE = "http://localhost:3333"; // sua API

export function getToken() {
    return localStorage.getItem("token");
}

export function setToken(token) {
    localStorage.setItem("token", token);
}

export function clearAuth() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioLogado");
}

export function logout() {
    clearAuth();
    location.href = "login.html";
}

export async function apiFetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });

    // tenta ler json mesmo em erro
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
        data = await res.json().catch(() => null);
    } else {
        const text = await res.text().catch(() => "");
        data = text ? { raw: text } : null;
    }

    if (!res.ok) {
        const msg = data?.erro || data?.message || `Erro HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}
