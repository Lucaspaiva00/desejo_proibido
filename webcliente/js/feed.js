import { apiFetch, API_BASE, logout } from "./api.js";

const card = document.getElementById("card");
const msg = document.getElementById("msg");

let fila = [];
let atual = null;

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

function safe(s) {
    return (s ?? "").toString();
}

function setMsg(text) {
    if (!msg) return;
    msg.textContent = text || "";
}

async function carregar() {
    setMsg("");
    const r = await apiFetch(`/feed?page=1&limit=20`);
    fila = r.data || [];
    proximo();
}

function isBoostAtivo(boostAte) {
    if (!boostAte) return false;
    const dt = new Date(boostAte);
    if (Number.isNaN(dt.getTime())) return false;
    return dt.getTime() > Date.now();
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

    const boostAtivo = isBoostAtivo(u.boostAte);

    card.innerHTML = `
    ${fotoUrl ? `<img class="tphoto" src="${fotoUrl}" alt="Foto" />` : ""}

    ${fotoUrl ? `<div class="toverlay"></div>` : `
      <div class="tfallback">
        <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
        <div class="muted">Sem foto principal</div>
      </div>
    `}

    ${boostAtivo ? `
      <div class="tboostBadge" title="Perfil em destaque">🔥 BOOST</div>
    ` : ""}

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

        ${boostAtivo ? `
          <div class="tboostBadge" title="Perfil em destaque">🔥 BOOST</div>
        ` : ""}

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
    if (!atual) return;
    await curtir(atual.id);
};

document.getElementById("btnPular").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/skips/${atual.id}`, { method: "POST" });
        setMsg("⟲ Pulado");
        proximo();
    } catch (e) {
        setMsg(e.message);
    }
};

document.getElementById("btnBloquear").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/bloqueios/${atual.id}`, { method: "POST" });
        setMsg("⛔ Bloqueado");
        proximo();
    } catch (e) {
        setMsg(e.message);
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

        setMsg("🚩 Denúncia enviada");
        proximo();
    } catch (e) {
        setMsg(e.message);
    }
};

async function curtir(paraUsuarioId) {
    try {
        const r = await apiFetch(`/curtidas/${paraUsuarioId}`, { method: "POST" });

        setMsg(r.matchCriado ? "✅ Deu MATCH! (conversa criada)" : "✅ Curtido");
        proximo();
    } catch (e) {
        if (e.status === 429) {
            mostrarLimiteCurtidas();
            return;
        }

        setMsg(e.message || "Erro ao curtir");
    }
}

function mostrarLimiteCurtidas() {
    const el = document.getElementById("limiteCurtidasOverlay");
    if (!el) return;
    el.classList.remove("hidden");
}

window.fecharLimiteCurtidas = function fecharLimiteCurtidas() {
    const el = document.getElementById("limiteCurtidasOverlay");
    if (!el) return;
    el.classList.add("hidden");
};

carregar();
