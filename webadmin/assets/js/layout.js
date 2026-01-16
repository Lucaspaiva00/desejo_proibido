// webadmin/assets/js/layout.js
import { logout } from "./api.js";

export function mountLayout(active = "") {
  const el = document.getElementById("layout");
  if (!el) return;

  el.innerHTML = `
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">
        <div class="brand-dot"></div>
        <div>
          <div class="brand-title">Desejo Proibido</div>
          <div class="brand-sub">Painel Admin</div>
        </div>
      </div>

      <nav class="nav">
        <a class="nav-link ${
          active === "dashboard" ? "active" : ""
        }" href="index.html">
          <i class="fa-solid fa-chart-line"></i><span>Dashboard</span>
        </a>
        <a class="nav-link ${
          active === "denuncias" ? "active" : ""
        }" href="denuncias.html">
          <i class="fa-solid fa-flag"></i><span>Denúncias</span>
        </a>
        <a class="nav-link ${
          active === "acoes" ? "active" : ""
        }" href="acoes.html">
          <i class="fa-solid fa-list-check"></i><span>Ações Admin</span>
        </a>
        <a class="nav-link ${
          active === "logs_acesso" ? "active" : ""
        }" href="logs-acesso.html">
        <i class="fa-solid fa-shield-halved"></i><span>Logs de Acesso</span>
        </a>
        <a class="nav-link ${
          active === "logs_denuncia" ? "active" : ""
        }" href="logs-denuncia.html">
          <i class="fa-solid fa-file-lines"></i><span>Logs de Denúncia</span>
        </a>

        <div class="nav-sep"></div>
        <button class="nav-link danger" id="btnSair">
          <i class="fa-solid fa-right-from-bracket"></i><span>Sair</span>
        </button>
      </nav>

      <div class="sidebar-foot">
        <small>API: <span class="muted">https://desejoproibido.app/api</span></small>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div class="topbar-left">
          <button class="btn btn-outline-light btn-sm d-lg-none" id="btnToggleMenu">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="topbar-title" id="pageTitle">Admin</div>
        </div>
        <div class="topbar-right">
          <span class="badge text-bg-dark">ADMIN</span>
        </div>
      </header>

      <section class="admin-content">
        <div id="pageContent"></div>
      </section>
    </main>
  </div>
  `;

  document.getElementById("btnSair").onclick = logout;

  const btnToggle = document.getElementById("btnToggleMenu");
  if (btnToggle) {
    btnToggle.onclick = () => document.body.classList.toggle("menu-open");
  }
}

export function setTitle(title) {
  const t = document.getElementById("pageTitle");
  if (t) t.textContent = title;
}
