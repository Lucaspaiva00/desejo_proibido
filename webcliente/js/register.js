import { apiFetch, setToken } from "./api.js";

const form = document.getElementById("formRegister");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnCadastro");
const toggleSenha = document.getElementById("toggleSenha");

function setAlert(text, type = "error") {
  msg.className = "alert " + (type === "ok" ? "alert-ok" : "alert-error");
  msg.textContent = text || "";
  msg.style.display = text ? "block" : "none";
}

function setLoading(loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Cadastrando..." : "Cadastrar";
}

toggleSenha?.addEventListener("click", () => {
  const input = document.getElementById("senha");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
});

form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  try {
    setAlert("");

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();
    const senha2 = document.getElementById("senha2").value.trim();
    const aceitouTermos = document.getElementById("aceiteTermos").checked;

    if (!email) throw new Error("Informe um e-mail válido.");
    if (!senha) throw new Error("Crie uma senha.");
    if (senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== senha2) throw new Error("As senhas não conferem.");
    if (!aceitouTermos) throw new Error("Você precisa aceitar os Termos e a Política de Privacidade.");

    setLoading(true);

    const r = await apiFetch("/auth/registrar", {
      method: "POST",
      body: { email, senha, aceitouTermos },
    });

    if (r?.token) {
      setToken(r.token);
      localStorage.setItem("usuario", JSON.stringify(r.usuario));
      location.href = "home.html";
      return;
    }

    setAlert("✅ Conta criada! Faça login.", "ok");
    setTimeout(() => (location.href = "index.html"), 700);
  } catch (e) {
    setAlert(e.message || "Não foi possível cadastrar.");
  } finally {
    setLoading(false);
  }
});
