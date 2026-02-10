import { apiFetch, setToken } from "./api.js";

const form = document.getElementById("formLogin");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnLogin");
const toggleSenha = document.getElementById("toggleSenha");
const linkForgot = document.getElementById("linkForgot");

function setAlert(text, type = "error") {
    msg.className = "alert " + (type === "ok" ? "alert-ok" : "alert-error");
    msg.textContent = text || "";
    msg.style.display = text ? "block" : "none";
}

function setLoading(loading) {
    btn.disabled = loading;
    btn.textContent = loading ? "Entrando..." : "Entrar";
}

toggleSenha?.addEventListener("click", () => {
    const input = document.getElementById("senha");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
});

linkForgot?.addEventListener("click", async (ev) => {
    ev.preventDefault();

    try {
        const email = document.getElementById("email")?.value?.trim();
        if (!email) return setAlert("Digite seu e-mail acima para recuperar a senha.");

        setAlert("");
        linkForgot.textContent = "Enviando...";

        await apiFetch("/auth/forgot-password", {
            method: "POST",
            body: { email },
        });

        setAlert("Se esse e-mail existir, enviamos um link de recuperação.", "ok");
    } catch (e) {
        setAlert("Não foi possível solicitar recuperação agora.");
    } finally {
        linkForgot.textContent = "Esqueci minha senha";
    }
});

form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    try {
        setAlert("");
        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value.trim();

        if (!email) throw new Error("Informe seu e-mail.");
        if (!senha) throw new Error("Informe sua senha.");

        setLoading(true);

        const r = await apiFetch("/auth/login", {
            method: "POST",
            body: { email, senha }
        });

        setToken(r.token);
        localStorage.setItem("usuario", JSON.stringify(r.usuario));

        const params = new URLSearchParams(location.search);
        const returnUrl = params.get("return") || "home.html";
        location.href = returnUrl;
    } catch (e) {
        setAlert(e.message || "Não foi possível entrar.");
    } finally {
        setLoading(false);
    }
});
