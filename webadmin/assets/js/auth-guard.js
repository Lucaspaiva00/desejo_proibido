// webadmin/assets/js/auth-guard.js
import { apiFetch, logout } from "./api.js";

export async function requireAdmin() {
    try {
        await apiFetch("/admin/acoes?page=1&limit=1");
    } catch (e) {
        if (e.status === 401) return logout();
        if (e.status === 403) {
            alert("Acesso restrito (ADMIN).");
            return logout();
        }
        alert(e.message || "Erro ao validar acesso admin.");
        return logout();
    }
}
