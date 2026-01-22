import { apiFetch, API_BASE, logout } from "./api.js";

const card = document.getElementById("card");
const msg = document.getElementById("msg");

let fila = [];
let atual = null;

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

// ======== Filtros UI ========
const fQ = document.getElementById("fQ");
const fCidade = document.getElementById("fCidade");
const fEstado = document.getElementById("fEstado");
const fIdadeMin = document.getElementById("fIdadeMin");
const fIdadeMax = document.getElementById("fIdadeMax");
const fGenero = document.getElementById("fGenero");
const fSomenteFoto = document.getElementById("fSomenteFoto");
const fSomenteVerificado = document.getElementById("fSomenteVerificado");
const fOrdenar = document.getElementById("fOrdenar");

const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
const btnSalvarPrefs = document.getElementById("btnSalvarPrefs");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

// ======== Modal filtros (NOVO) ========
const filtrosOverlay = document.getElementById("filtrosOverlay");
const btnOpenFiltros = document.getElementById("btnOpenFiltros");
const btnCloseFiltros = document.getElementById("btnCloseFiltros");
const filtrosResumo = document.getElementById("filtrosResumo");

function openFiltros() {
  if (!filtrosOverlay) return;
  filtrosOverlay.classList.add("show");
  filtrosOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");

  // foco no primeiro campo
  setTimeout(() => fQ?.focus(), 10);
}

function closeFiltros() {
  if (!filtrosOverlay) return;
  filtrosOverlay.classList.remove("show");
  filtrosOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

btnOpenFiltros?.addEventListener("click", openFiltros);
btnCloseFiltros?.addEventListener("click", closeFiltros);

// fecha clicando fora
filtrosOverlay?.addEventListener("click", (e) => {
  if (e.target === filtrosOverlay) closeFiltros();
});

// fecha ESC (sem atrapalhar teu nav drawer)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && filtrosOverlay?.classList.contains("show")) closeFiltros();
});

// ======== helpers ========
function safe(s) {
  return (s ?? "").toString();
}

function setMsg(text) {
  if (!msg) return;
  msg.textContent = text || "";
}

function toast(text) {
  const el = document.getElementById("toast");
  const txt = document.getElementById("toastText");
  if (!el || !txt) return;
  txt.textContent = text || "";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function isBoostAtivo(boostAte) {
  if (!boostAte) return false;
  const dt = new Date(boostAte);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() > Date.now();
}

function getFiltrosAtual() {
  const idadeMin = fIdadeMin?.value ? Number(fIdadeMin.value) : null;
  const idadeMax = fIdadeMax?.value ? Number(fIdadeMax.value) : null;

  return {
    q: safe(fQ?.value).trim(),
    cidade: safe(fCidade?.value).trim(),
    estado: safe(fEstado?.value).trim(),
    genero: safe(fGenero?.value || "QUALQUER").trim(),

    idadeMin: Number.isFinite(idadeMin) ? idadeMin : null,
    idadeMax: Number.isFinite(idadeMax) ? idadeMax : null,

    somenteComFoto: !!fSomenteFoto?.checked,
    somenteVerificados: !!fSomenteVerificado?.checked,
    ordenarPor: safe(fOrdenar?.value || "recent").trim(),
  };
}

function montarQuery(f) {
  const qs = new URLSearchParams();
  if (f.q) qs.set("q", f.q);
  if (f.cidade) qs.set("cidade", f.cidade);
  if (f.estado) qs.set("estado", f.estado);
  if (f.genero && f.genero !== "QUALQUER") qs.set("genero", f.genero);
  if (f.idadeMin != null) qs.set("idadeMin", String(f.idadeMin));
  if (f.idadeMax != null) qs.set("idadeMax", String(f.idadeMax));
  if (f.somenteComFoto) qs.set("somenteComFoto", "true");
  if (f.somenteVerificados) qs.set("somenteVerificados", "true");
  if (f.ordenarPor) qs.set("ordenarPor", f.ordenarPor);
  return qs.toString();
}

// ======== Resumo chips (NOVO) ========
function renderResumoFiltros() {
  if (!filtrosResumo) return;

  const f = getFiltrosAtual();
  const chips = [];

  // ordenação
  chips.push(f.ordenarPor === "boost" ? "Boost" : "Recentes");

  if (f.q) chips.push(`Busca: ${f.q}`);
  if (f.cidade) chips.push(`Cidade: ${f.cidade}`);
  if (f.estado) chips.push(`UF: ${f.estado}`);
  if (f.genero && f.genero !== "QUALQUER") chips.push(`Gênero: ${f.genero}`);
  if (f.idadeMin != null || f.idadeMax != null) chips.push(`Idade: ${f.idadeMin ?? 18}-${f.idadeMax ?? 99}`);
  if (f.somenteComFoto) chips.push("Com foto");
  if (f.somenteVerificados) chips.push("Verificados");

  if (chips.length <= 1) {
    filtrosResumo.innerHTML = `
      <span class="fchip">${chips[0]}</span>
      <span class="fchip muted">Sem filtros</span>
    `;
    return;
  }

  // limita visualmente
  const max = 4;
  const show = chips.slice(0, max);
  const rest = chips.length - show.length;

  filtrosResumo.innerHTML = `
    ${show.map(c => `<span class="fchip">${c}</span>`).join("")}
    ${rest > 0 ? `<span class="fchip muted">+${rest}</span>` : ""}
  `;
}

// ======== render ========
function render(u) {
  if (!u) {
    card.innerHTML = `
      <div class="tfallback">
        <div class="tbadgeBig">DP</div>
        <div class="muted">Sem pessoas no feed com esses filtros.</div>
      </div>
    `;
    return;
  }

  const nome = safe(u.perfil?.nome).trim() || "Sem nome";
  const bio = safe(u.perfil?.bio).trim();
  const cidade = safe(u.perfil?.cidade).trim();
  const estado = safe(u.perfil?.estado).trim();
  const loc = `${cidade} ${estado}`.trim();

  const fotoUrl = u.fotoPrincipal ? `${u.fotoPrincipal}` : "";
  const boostAtivo = isBoostAtivo(u.boostAte);

  card.innerHTML = `
    ${fotoUrl ? `<img class="tphoto" src="${fotoUrl}" alt="Foto" />` : ""}

    ${fotoUrl
      ? `<div class="toverlay"></div>`
      : `
      <div class="tfallback">
        <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
        <div class="muted">Sem foto principal</div>
      </div>
    `
    }

    ${boostAtivo ? `<div class="tboostBadge" title="Perfil em destaque">🔥 BOOST</div>` : ""}

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

        ${boostAtivo ? `<div class="tboostBadge" title="Perfil em destaque">🔥 BOOST</div>` : ""}

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

// ======== API: carregar feed ========
async function carregarPreferencias() {
  try {
    const pref = await apiFetch("/busca/preferencias");

    if (fCidade) fCidade.value = pref.cidade || "";
    if (fEstado) fEstado.value = pref.estado || "";
    if (fGenero) fGenero.value = pref.generoAlvo || "QUALQUER";
    if (fIdadeMin) fIdadeMin.value = pref.idadeMin ?? "";
    if (fIdadeMax) fIdadeMax.value = pref.idadeMax ?? "";
    if (fSomenteVerificado) fSomenteVerificado.checked = !!pref.somenteVerificados;
    if (fSomenteFoto) fSomenteFoto.checked = !!pref.somenteComFoto;
    if (fOrdenar) fOrdenar.value = pref.ordenarPor || "recent";

    renderResumoFiltros();
  } catch (e) {
    console.warn("Não carregou preferências:", e.message);
  }
}

async function carregarComFiltros() {
  setMsg("");
  const filtros = getFiltrosAtual();
  const qs = montarQuery(filtros);

  try {
    setMsg("Carregando...");
    const r = await apiFetch(`/busca${qs ? `?${qs}` : ""}`);
    fila = Array.isArray(r) ? r : r.data || [];
    setMsg("");
    proximo();

    renderResumoFiltros();
  } catch (e) {
    setMsg(e.message || "Erro ao carregar feed");
  }
}

// ======== Curtir/Pular/Bloquear/Denunciar ========
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
      body: { denunciadoId: atual.id, motivo, descricao },
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

// ======== Limite Curtidas ========
function mostrarLimiteCurtidas() {
  const el = document.getElementById("limiteCurtidasOverlay");
  if (!el) return;
  el.classList.remove("hidden");
}

const btnFecharLimite = document.getElementById("btnFecharLimite");
btnFecharLimite?.addEventListener("click", () => {
  const el = document.getElementById("limiteCurtidasOverlay");
  if (!el) return;
  el.classList.add("hidden");
});

// ======== Eventos filtros ========
btnAplicarFiltros?.addEventListener("click", async () => {
  await carregarComFiltros();
  toast("Filtros aplicados");
  closeFiltros();
});

btnSalvarPrefs?.addEventListener("click", async () => {
  try {
    const f = getFiltrosAtual();

    await apiFetch("/busca/preferencias", {
      method: "PUT",
      body: {
        idadeMin: f.idadeMin ?? 18,
        idadeMax: f.idadeMax ?? 99,
        cidade: f.cidade || null,
        estado: f.estado || null,
        generoAlvo: f.genero || "QUALQUER",
        somenteVerificados: f.somenteVerificados,
        somenteComFoto: f.somenteComFoto,
        ordenarPor: f.ordenarPor || "recent",
      },
    });

    toast("Preferências salvas ✅");
    renderResumoFiltros();
    closeFiltros();
  } catch (e) {
    alert("Erro ao salvar preferências: " + (e.message || e));
  }
});

btnLimparFiltros?.addEventListener("click", async () => {
  if (fQ) fQ.value = "";
  if (fCidade) fCidade.value = "";
  if (fEstado) fEstado.value = "";
  if (fIdadeMin) fIdadeMin.value = "";
  if (fIdadeMax) fIdadeMax.value = "";
  if (fGenero) fGenero.value = "QUALQUER";
  if (fSomenteFoto) fSomenteFoto.checked = false;
  if (fSomenteVerificado) fSomenteVerificado.checked = false;
  if (fOrdenar) fOrdenar.value = "recent";

  await carregarComFiltros();
  toast("Filtros limpos");
  // não fecho o modal aqui de propósito (pra você mexer novamente)
});

// Enter no campo de busca aplica filtros
fQ?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    carregarComFiltros().then(() => closeFiltros());
  }
});

// ======== Init ========
async function init() {
  await carregarPreferencias();
  await carregarComFiltros();
  renderResumoFiltros();
}

init();
