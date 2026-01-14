import { apiFetch, logout } from "./api.js";

const grid = document.getElementById("grid");
const q = document.getElementById("q");
const btnReload = document.getElementById("btnReload");
const msg = document.getElementById("msg");

document.getElementById("btnSair")?.addEventListener("click", logout);
document.getElementById("btnSairMobile")?.addEventListener("click", logout);

function setMsg(t, type="muted"){
  if(!msg) return;
  msg.className = `msgline ${type}`;
  msg.textContent = t || "";
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

let matches = [];

async function loadMatches(){
  try{
    setMsg("Carregando matches...");
    const data = await apiFetch("/matches");
    matches = Array.isArray(data) ? data : (data.data || []);
    render();
    setMsg("");
  }catch(e){
    setMsg("Erro ao carregar matches: " + e.message, "error");
    grid.innerHTML = "";
  }
}

function render(){
  const filtro = (q?.value || "").trim().toLowerCase();

  const items = matches.filter(m => {
    const nome = (m.outro?.perfil?.nome || m.outro?.email || "").toLowerCase();
    const cidade = (m.outro?.perfil?.cidade || "").toLowerCase();
    const estado = (m.outro?.perfil?.estado || "").toLowerCase();
    return !filtro || nome.includes(filtro) || cidade.includes(filtro) || estado.includes(filtro);
  });

  if(!items.length){
    grid.innerHTML = `<div class="muted">Nenhum match.</div>`;
    return;
  }

  grid.innerHTML = items.map(m => {
    const outro = m.outro || {};
    const nome = outro?.perfil?.nome || outro?.email || "Usuário";
    const cidade = outro?.perfil?.cidade || "";
    const estado = outro?.perfil?.estado || "";

    const foto = outro?.fotos?.find?.(f => f.principal)?.url || outro?.fotos?.[0]?.url || "";
    const fotoSrc = foto ? foto : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>
        <rect width='100%' height='100%' fill='#1b1b1f'/>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#ffffffaa' font-size='28' font-family='Arial'>Sem foto</text>
      </svg>
    `);

    return `
      <div class="match-card">
        <img class="match-photo" src="${fotoSrc}" alt="foto" />
        <div class="match-body">
          <div class="match-name">${escapeHtml(nome)}</div>
          <div class="match-sub">${escapeHtml(cidade)}${cidade && estado ? " - " : ""}${escapeHtml(estado)}</div>

          <div class="match-actions">
            <button class="btn btn-primary" data-chat="${m.conversaId}">Abrir Chat</button>
            <button class="btn" data-perfil="${outro.id}">Ver perfil</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("button[data-chat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const conversaId = btn.getAttribute("data-chat");
      // ✅ abre chat já focado na conversa
      location.href = `conversas.html?conversaId=${conversaId}`;
    });
  });

  grid.querySelectorAll("button[data-perfil]").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-perfil");
      location.href = `perfil-match.html?id=${uid}`;
    });
  });
}

q?.addEventListener("input", render);
btnReload?.addEventListener("click", loadMatches);

await loadMatches();
