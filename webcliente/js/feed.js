import { apiFetch, API_BASE, logout } from "./api.js";

const card = document.getElementById("card");
const msg = document.getElementById("msg");

let fila = [];
let atual = null;

document.getElementById("btnSair").onclick = logout;

// botão sair do drawer (se existir)
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

function safe(s) {
    return (s ?? "").toString();
}

async function carregar() {
    msg.textContent = "";
    const r = await apiFetch(`/feed?page=1&limit=20`);
    fila = r.data || [];
    proximo();
}

function render(u) {
    if (!u) {
        card.innerHTML = `
      <div class="tfallback">
        <div class="tbadgeBig">DP</div>
        <div class="muted">Sem pessoas no feed (crie outro usuário com perfil + foto principal).</div>
      </div>
    `;
        return;
    }

    const nome = safe(u.perfil?.nome).trim() || "Sem nome";
    const bio = safe(u.perfil?.bio).trim();
    const cidade = safe(u.perfil?.cidade).trim();
    const estado = safe(u.perfil?.estado).trim();
    const loc = `${cidade} ${estado}`.trim();

    const fotoUrl = u.fotoPrincipal ? `${API_BASE}${u.fotoPrincipal}` : "";

    card.innerHTML = `
    ${fotoUrl ? `<img class="tphoto" src="${fotoUrl}" alt="Foto" />` : ""}
    ${fotoUrl ? `<div class="toverlay"></div>` : `
      <div class="tfallback">
        <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
        <div class="muted">Sem foto principal</div>
      </div>
    `}

    <div class="tcontent">
      <div class="tnameRow">
        <div class="tname">${nome}</div>
      </div>

      <div class="tchipRow">
        ${loc ? `<span class="tchip">📍 ${loc}</span>` : ""}
      </div>

      ${bio ? `<div class="tbio">${bio}</div>` : ""}
    </div>
  `;

    // fallback se imagem quebrar
    const img = card.querySelector(".tphoto");
    if (img) {
        img.onerror = () => {
            card.innerHTML = `
        <div class="tfallback">
          <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
          <div class="muted">Não foi possível carregar a foto</div>
        </div>
        <div class="tcontent">
          <div class="tnameRow"><div class="tname">${nome}</div></div>
          <div class="tchipRow">
            ${loc ? `<span class="tchip">📍 ${loc}</span>` : ""}
          </div>
          ${bio ? `<div class="tbio">${bio}</div>` : ""}
        </div>
      `;
        };
    }
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
        msg.textContent = "⟲ Pulado";
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

async function curtir(paraUsuarioId) {
    try {
        await apiFetch(`/curtidas/${paraUsuarioId}`, { method: "POST" });
        // continua fluxo normal
    } catch (e) {
        if (e.status === 429) {
            mostrarLimiteCurtidas();
            return;
        }

        alert(e.message || "Erro ao curtir");
    }
}

function mostrarLimiteCurtidas() {
    document
        .getElementById("limiteCurtidasOverlay")
        .classList.remove("hidden");
}

function fecharLimiteCurtidas() {
    document
        .getElementById("limiteCurtidasOverlay")
        .classList.add("hidden");
}


carregar();
