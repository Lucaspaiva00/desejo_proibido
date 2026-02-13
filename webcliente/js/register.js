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

// ✅ regra central: define se o perfil está "completo mínimo"
function isPerfilCompleto(p) {
  const nome = (p?.nome || "").trim();
  const estado = (p?.estado || "").trim();
  const genero = (p?.genero || "").trim();
  const nascimento = p?.nascimento;

  // nascimento pode vir ISO string "2026-02-10T00:00:00.000Z"
  const nascOk = !!nascimento && !Number.isNaN(new Date(nascimento).getTime());

  return (
    nome.length >= 2 &&
    estado.length === 2 &&
    genero.length >= 2 &&
    nascOk
  );
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
      localStorage.setItem("usuario", JSON.stringify(r.usuario || {}));

      // ✅ garante que o perfil existe e decide pra onde ir
      let perfil = null;
      try {
        perfil = await apiFetch("/perfil/me");
      } catch (e) {
        // se der erro, joga pro perfil mesmo assim
        perfil = null;
      }

      if (!isPerfilCompleto(perfil)) {
        // mensagem opcional pra dar "ciência"
        localStorage.setItem("dp_after_register", "complete_perfil");
        location.href = "perfil.html";
        return;
      }

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
