import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
document.getElementById("btnSair").onclick = logout;

async function listar() {
    msg.textContent = "";
    lista.innerHTML = "Carregando...";

    const fotos = await apiFetch("/fotos/minhas");
    if (!fotos?.length) {
        lista.innerHTML = "<p class='muted'>Você ainda não enviou fotos.</p>";
        return;
    }

    lista.innerHTML = `<div class="gridFotos">` + fotos.map(f => `
  <div class="fotoCard">
    <img class="fotoImg" src="${API_BASE}${f.url}" />
    <div class="fotoActions">
      <button class="btn ${f.principal ? "btn-primary" : "btn-ghost"}" data-principal="${f.id}">
        ${f.principal ? "✅ Principal" : "Tornar principal"}
      </button>
      <button class="btn btn-danger" data-del="${f.id}">Excluir</button>
    </div>
    
  </div>
`).join("") + `</div>`;


    // listeners
    document.querySelectorAll("[data-principal]").forEach(btn => {
        btn.onclick = async () => {
            try {
                const id = btn.getAttribute("data-principal");
                await apiFetch(`/fotos/${id}/principal`, { method: "PATCH" });
                msg.textContent = "✅ Foto principal atualizada!";
                await listar();
            } catch (e) {
                msg.textContent = e.message;
            }
        };
    });

    document.querySelectorAll("[data-del]").forEach(btn => {
        btn.onclick = async () => {
            try {
                const id = btn.getAttribute("data-del");
                if (!confirm("Excluir esta foto?")) return;
                await apiFetch(`/fotos/${id}`, { method: "DELETE" });
                msg.textContent = "🗑️ Foto excluída!";
                await listar();
            } catch (e) {
                msg.textContent = e.message;
            }
        };
    });
}

document.getElementById("btnUpload").onclick = async () => {
    try {
        msg.textContent = "";

        const file = document.getElementById("arquivo").files?.[0];
        if (!file) throw new Error("Selecione um arquivo");

        const form = new FormData();
        form.append("foto", file);

        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/fotos/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(data?.erro || `Erro HTTP ${res.status}`);

        // ✅ se não veio principal, já seta como principal automaticamente
        if (!data.principal) {
            await apiFetch(`/fotos/${data.id}/principal`, { method: "PATCH" });
        }

        msg.textContent = "✅ Upload feito e definido como principal!";
        document.getElementById("arquivo").value = "";
        await listar();
    } catch (e) {
        msg.textContent = e.message;
    }
};


listar();
