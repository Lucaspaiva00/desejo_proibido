export const API_BASE = "http://localhost:3333";

export function getToken() {
    return localStorage.getItem("token");
}

export function setToken(token) {
    localStorage.setItem("token", token);
}

export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    location.href = "index.html";
}

export async function apiFetch(path, { method = "GET", body, headers = {}, isFormData = false } = {}) {
    const token = getToken();

    const finalHeaders = { ...headers };
    if (!isFormData) finalHeaders["Content-Type"] = "application/json";
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: finalHeaders,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
        const msg = data?.erro || data?.message || `Erro HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data;
}
