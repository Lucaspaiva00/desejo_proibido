import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
const busca = document.getElementById("busca");
document.getElementById("btnSair").onclick = logout;

let matches = [];
let conversaPorMatch = new Map(); // matchId -> conversaId

function normalizar(s) {
    return (s || "").toString().toLowerCase().trim();
}

function filtrar() {
    const q = normalizar(busca.value);
    if (!q) return matches;

    return matches.filter(m => {
        const p = m?.outroUsuario?.perfil;
        const nome = normalizar(p?.nome);
        const cidade = normalizar(p?.cidade);
        const estado = normalizar(p?.estado);
        return nome.includes(q) || cidade.includes(q) || estado.includes(q);
    });
}

function render() {
    const data = filtrar();

    if (!data.length) {
        lista.innerHTML = `<p class="muted">Nenhum match ainda. Curta alguém que te curta de volta 😉</p>`;
        return;
    }

    lista.innerHTML =
        `<div class="gridMatch">` +
        data.map(m => {
            const u = m.outroUsuario;
            const p = u?.perfil || {};
            const foto = u?.fotoPrincipal ? `${API_BASE}${u.fotoPrincipal}` : "";

            const conversaId = conversaPorMatch.get(m.matchId) || null;

            return `
        <div class="mCard">
          <img class="mFoto" src="${foto}" onerror="this.style.opacity=.25" />
          <div class="mNome">${p.nome || "Sem nome"}</div>
          <div class="mMeta">${p.cidade || ""} ${p.estado || ""}</div>

          <div class="mActions">
            <button class="btn btn-primary" data-chat="${m.matchId}" ${conversaId ? "" : "disabled"}>
              ${conversaId ? "Abrir Chat" : "Sem conversa"}
            </button>
            <button class="btn btn-ghost" data-ver="${u.id}">
              Ver perfil
            </button>
          </div>
        </div>
      `;
        }).join("") +
        `</div>`;

    document.querySelectorAll("[data-chat]").forEach(btn => {
        btn.onclick = () => {
            const matchId = btn.getAttribute("data-chat");
            const conversaId = conversaPorMatch.get(matchId);
            if (!conversaId) return;
            // guarda a conversa selecionada e manda pro chat
            localStorage.setItem("conversaSelecionadaId", conversaId);
            location.href = "conversas.html";
        };
    });

    document.querySelectorAll("[data-ver]").forEach(btn => {
        btn.onclick = () => {
            const userId = btn.getAttribute("data-ver");
            location.href = `perfil-match.html?userId=${userId}`;
        };
    });
}

async function carregar() {
    try {
        msg.textContent = "";
        lista.innerHTML = `<p class="muted">Carregando...</p>`;

        // 1) pega matches
        const r = await apiFetch("/matches/minhas");
        matches = r || [];

        // 2) pega conversas e monta mapa matchId -> conversaId
        const c = await apiFetch("/conversas/minhas");
        conversaPorMatch = new Map((c || []).map(x => [x.matchId, x.conversaId]));

        render();
    } catch (e) {
        msg.textContent = e.message;
        lista.innerHTML = "";
    }
}

document.getElementById("btnRecarregar").onclick = carregar;
busca.addEventListener("input", render);

carregar();
