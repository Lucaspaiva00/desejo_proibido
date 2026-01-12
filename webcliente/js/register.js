import { apiFetch, setToken } from "./api.js";

const msg = document.getElementById("msg");
const btn = document.getElementById("btnCadastro");

btn.addEventListener("click", async () => {
    try {
        msg.textContent = "";

        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value.trim();
        const senha2 = document.getElementById("senha2").value.trim();

        if (!email || !senha) throw new Error("Preencha email e senha");
        if (senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
        if (senha !== senha2) throw new Error("As senhas não conferem");

        // ✅ ajuste aqui conforme seu backend:
        // se for /auth/registrar, deixa assim.
        const r = await apiFetch("/auth/registrar", {
            method: "POST",
            body: { email, senha }
        });

        // Se seu backend já retorna token ao registrar, loga direto:
        if (r?.token) {
            setToken(r.token);
            localStorage.setItem("usuario", JSON.stringify(r.usuario));
            location.href = "home.html";
            return;
        }

        // Se NÃO retorna token, manda pro login:
        msg.textContent = "✅ Conta criada! Faça login.";
        setTimeout(() => (location.href = "index.html"), 700);

    } catch (e) {
        msg.textContent = e.message;
    }
});
