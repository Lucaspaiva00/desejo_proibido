import { startAuthentication } from "https://esm.sh/@simplewebauthn/browser@13.1.1?bundle";
import { apiFetch, setToken } from "./api.js";

const form = document.getElementById("formLogin");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnLogin");
const btnPasskeyLogin = document.getElementById("btnPasskeyLogin");
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

function setPasskeyLoading(loading) {
    if (!btnPasskeyLogin) return;
    btnPasskeyLogin.disabled = loading;
    btnPasskeyLogin.textContent = loading ? "Abrindo biometria..." : "Entrar com biometria";
}

function redirectAfterLogin() {
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get("return") || "home.html";
    location.href = returnUrl;
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

        redirectAfterLogin();
    } catch (e) {
        setAlert(e.message || "Não foi possível entrar.");
    } finally {
        setLoading(false);
    }
});

btnPasskeyLogin?.addEventListener("click", async () => {
    try {
        setAlert("");

        if (
            typeof window.PublicKeyCredential === "undefined" ||
            typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
        ) {
            throw new Error("Este navegador não suporta biometria no login.");
        }

        const disponivel = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!disponivel) {
            throw new Error("Biometria não disponível neste dispositivo ou navegador.");
        }

        const email = document.getElementById("email")?.value?.trim();
        if (!email) {
            throw new Error("Informe seu e-mail para entrar com biometria.");
        }

        setPasskeyLoading(true);

        const { options, state } = await apiFetch("/auth/passkeys/login/options", {
            method: "POST",
            body: { email },
        });

        const response = await startAuthentication({ optionsJSON: options });

        const r = await apiFetch("/auth/passkeys/login/verify", {
            method: "POST",
            body: { response, state },
        });

        setToken(r.token);
        localStorage.setItem("usuario", JSON.stringify(r.usuario));

        redirectAfterLogin();
    } catch (e) {
        if (e?.name === "NotAllowedError") {
            setAlert("Operação cancelada pelo usuário.");
        } else {
            setAlert(e.message || "Não foi possível entrar com biometria.");
        }
    } finally {
        setPasskeyLoading(false);
    }
});