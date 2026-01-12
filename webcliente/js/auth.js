import { apiFetch, setToken } from "./api.js";

const msg = document.getElementById("msg");
const btn = document.getElementById("btnLogin");

btn?.addEventListener("click", async () => {
    try {
        msg.textContent = "";
        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value.trim();

        const r = await apiFetch("/auth/login", { method: "POST", body: { email, senha } });

        setToken(r.token);
        localStorage.setItem("usuario", JSON.stringify(r.usuario));
        location.href = "home.html";
    } catch (e) {
        msg.textContent = e.message;
    }
});
