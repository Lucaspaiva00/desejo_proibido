import { apiFetch, setToken } from "./api.js";

const msg = document.getElementById("msg");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const btn = document.getElementById("btnLogin");

function showError(text) {
    msg.textContent = text;
    msg.classList.remove("d-none");
}

btn.onclick = async () => {
    msg.classList.add("d-none");
    btn.disabled = true;

    try {
        const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: email.value.trim(), senha: senha.value }),
        });

        // ajuste aqui conforme seu backend retorna:
        // exemplo esperado: { token, usuario }
        if (!data?.token) throw new Error("Login não retornou token.");

        setToken(data.token);
        localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario || null));

        // valida que é admin (batendo no /admin/acoes)
        await apiFetch("/admin/acoes?page=1&limit=1");

        location.href = "index.html";
    } catch (e) {
        showError(e.message || "Erro no login");
    } finally {
        btn.disabled = false;
    }
};
