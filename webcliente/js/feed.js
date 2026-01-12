import { apiFetch, logout } from "./api.js";

const card = document.getElementById("card");
const msg = document.getElementById("msg");

let fila = [];
let atual = null;

document.getElementById("btnSair").onclick = logout;

async function carregar() {
    msg.textContent = "";
    const r = await apiFetch(`/feed?page=1&limit=20`);
    fila = r.data || [];
    proximo();
}

function render(u) {
    if (!u) {
        card.innerHTML = `<p>Sem pessoas no feed (crie outro usuário com perfil + foto principal).</p>`;
        return;
    }

    card.innerHTML = `
    <img class="foto" src="http://localhost:3333${u.fotoPrincipal}" onerror="this.style.display='none'"/>
    <h3>${u.perfil?.nome || "Sem nome"}</h3>
    <p>${u.perfil?.bio || ""}</p>
    <small>${u.perfil?.cidade || ""} ${u.perfil?.estado || ""}</small>
    <div class="muted">ID: ${u.id}</div>
  `;
}

function proximo() {
    atual = fila.shift() || null;
    render(atual);
}

document.getElementById("btnCurtir").onclick = async () => {
    try {
        if (!atual) return;
        const r = await apiFetch(`/curtidas/${atual.id}`, { method: "POST" });
        msg.textContent = r.matchCriado ? "✅ Deu MATCH! (conversa criada)" : "✅ Curtido";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

document.getElementById("btnPular").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/skips/${atual.id}`, { method: "POST" });
        msg.textContent = "⏭️ Pulado";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

document.getElementById("btnBloquear").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/bloqueios/${atual.id}`, { method: "POST" });
        msg.textContent = "⛔ Bloqueado";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

document.getElementById("btnDenunciar").onclick = async () => {
    try {
        if (!atual) return;
        const motivo = prompt("Motivo da denúncia (ex: perfil falso):");
        if (!motivo) return;
        const descricao = prompt("Descrição (opcional):") || null;

        await apiFetch(`/denuncias`, {
            method: "POST",
            body: { denunciadoId: atual.id, motivo, descricao }
        });

        msg.textContent = "🚩 Denúncia enviada";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

carregar();
