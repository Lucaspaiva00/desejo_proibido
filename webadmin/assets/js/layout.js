import { logout } from "./api.js";

const groups = [
  ["VISÃO GERAL", [
    ["dashboard","index.html","fa-chart-pie","Dashboard"],
    ["usuarios","usuarios.html","fa-users","Usuários"],
  ]],
  ["OPERAÇÃO", [
    ["criadoras","criadoras.html","fa-certificate","Criadoras"],
    ["lives","lives.html","fa-tower-broadcast","Lives"],
    ["denuncias","denuncias.html","fa-flag","Moderação"],
  ]],
  ["FINANCEIRO", [
    ["financeiro","financeiro.html","fa-sack-dollar","Financeiro"],
    ["transacoes","transacoes.html","fa-arrow-right-arrow-left","Transações"],
    ["pagamentos","pagamentos.html","fa-credit-card","Pagamentos"],
    ["saques","saques.html","fa-money-bill-transfer","Saques"],
  ]],
  ["MONETIZAÇÃO", [
    ["presentes","presentes.html","fa-gift","Presentes"],
    ["configuracoes","configuracoes.html","fa-sliders","Configurações"],
  ]],
  ["SEGURANÇA & AUDITORIA", [
    ["acoes","acoes.html","fa-list-check","Ações Admin"],
    ["logs_acesso","logs-acesso.html","fa-shield-halved","Logs de acesso"],
    ["logs_denuncia","logs-denuncia.html","fa-file-shield","Logs de denúncia"],
  ]],
];

export function mountLayout(active = "") {
  const el = document.getElementById("layout");
  if (!el) return;
  const nav = groups.map(([label, items]) => `<div class="nav-group">${label}</div><div class="admin-nav">${items.map(([key,href,icon,title]) => `<a class="nav-link ${active===key?"active":""}" href="${href}"><i class="fa-solid ${icon}"></i><span>${title}</span></a>`).join("")}</div>`).join("");
  el.innerHTML = `<div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand"><div class="brand-mark">DP</div><div><div class="brand-title">Desejo Proibido</div><div class="brand-sub">Operations Center</div></div></div>
      ${nav}
      <button class="nav-link danger" id="btnSair"><i class="fa-solid fa-right-from-bracket"></i><span>Sair</span></button>
      <div class="sidebar-foot">Admin 2.0 • Operação e monetização</div>
    </aside>
    <main class="admin-main">
      <header class="admin-topbar">
        <div class="topbar-left"><button class="btn-admin sm d-lg-none" id="btnToggleMenu"><i class="fa-solid fa-bars"></i></button><div class="topbar-title" id="pageTitle">Admin</div></div>
        <div class="global-search"><i class="fa-solid fa-magnifying-glass"></i><input id="globalUserSearch" placeholder="Buscar usuário por nome ou e-mail…"></div>
        <div class="topbar-right"><span class="top-chip hide-mobile"><span class="status-dot"></span> Operação online</span><span class="top-chip"><i class="fa-solid fa-user-shield"></i> ADMIN</span></div>
      </header>
      <section class="admin-content"><div id="pageContent"></div></section>
    </main>
  </div>`;
  document.getElementById("btnSair").onclick = logout;
  const btnToggle=document.getElementById("btnToggleMenu"); if(btnToggle) btnToggle.onclick=()=>document.body.classList.toggle("menu-open");
  const search=document.getElementById("globalUserSearch"); if(search) search.addEventListener("keydown",e=>{if(e.key==="Enter"&&search.value.trim()) location.href=`usuarios.html?q=${encodeURIComponent(search.value.trim())}`});
  document.addEventListener("click",e=>{if(innerWidth<992 && document.body.classList.contains("menu-open") && !e.target.closest(".admin-sidebar") && !e.target.closest("#btnToggleMenu")) document.body.classList.remove("menu-open")});
}
export function setTitle(title){const t=document.getElementById("pageTitle");if(t)t.textContent=title}
