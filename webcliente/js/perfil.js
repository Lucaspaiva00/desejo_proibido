import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");
document.getElementById("btnSair").onclick = logout;

const elNome = document.getElementById("nome");
const elCidade = document.getElementById("cidade");
const elEstado = document.getElementById("estado");
const elBio = document.getElementById("bio");

async function carregar() {
    try {
        msg.textContent = "";
        const r = await apiFetch("/perfil/me"); // ✅ seu back já tinha esse padrão
        // r pode vir como perfil direto ou {perfil:...}
        const p = r?.perfil ?? r;

        if (!p) return;

        elNome.value = p.nome || "";
        elCidade.value = p.cidade || "";
        elEstado.value = (p.estado || "").toUpperCase();
        elBio.value = p.bio || "";
    } catch (e) {
        // se ainda não tem perfil, ok
        msg.textContent = "Ainda não tem perfil. Preencha e clique em Salvar.";
    }
}

document.getElementById("btnSalvar").onclick = async () => {
    try {
        msg.textContent = "";

        const body = {
            nome: elNome.value.trim(),
            bio: elBio.value.trim(),
            cidade: elCidade.value.trim(),
            estado: elEstado.value.trim().toUpperCase()
        };

        if (!body.nome) throw new Error("Nome é obrigatório");
        if (!body.estado || body.estado.length !== 2) throw new Error("Estado deve ter 2 letras (ex: SP)");

        // tenta PUT primeiro (atualizar), se falhar, tenta POST (criar)
        try {
            await apiFetch("/perfil", { method: "PUT", body });
            msg.textContent = "✅ Perfil atualizado!";
        } catch (errPut) {
            await apiFetch("/perfil", { method: "POST", body });
            msg.textContent = "✅ Perfil criado!";
        }
    } catch (e) {
        msg.textContent = e.message;
    }
};

carregar();
