import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch } from "./api.js";

mountLayout("acoes");
setTitle("Ações Admin");
await requireAdmin();

const root = document.getElementById("pageContent");
let page = 1;
const limit = 30;

root.innerHTML = `
  <div class="card-dark p-3">
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <div class="h6 fw-bold m-0">Log de Ações</div>
        <div class="text-secondary small">Tudo que foi feito no painel admin.</div>
      </div>
      <button class="btn btn-outline-light btn-sm" id="reload">
        <i class="fa-solid fa-rotate"></i>
      </button>
    </div>

    <div class="mt-3" id="wrap">Carregando...</div>

    <div class="d-flex justify-content-between align-items-center mt-3">
      <button id="prev" class="btn btn-outline-light btn-sm">Anterior</button>
      <div class="text-secondary small" id="info">-</div>
      <button id="next" class="btn btn-outline-light btn-sm">Próxima</button>
    </div>
  </div>
`;

document.getElementById("reload").onclick = () => load();
document.getElementById("prev").onclick = () => { if (page > 1) { page--; load(); } };
document.getElementById("next").onclick = () => { page++; load(); };

async function load() {
    const wrap = document.getElementById("wrap");
    wrap.innerHTML = "Carregando...";

    try {
        const r = await apiFetch(`/admin/acoes?page=${page}&limit=${limit}`);
        const items = r?.data || [];
        const total = r?.total || 0;

        document.getElementById("info").textContent = `Página ${page} • Total ${total}`;

        if (!items.length) {
            wrap.innerHTML = `<div class="text-secondary">Sem ações.</div>`;
            return;
        }

        wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-darkish align-middle">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Admin</th>
              <th>Alvo</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(a => `
              <tr>
                <td>${new Date(a.criadoEm).toLocaleString()}</td>
                <td><span class="badge text-bg-dark">${a.tipo}</span></td>
                <td class="text-truncate" style="max-width:260px">${a.motivo || "-"}</td>
                <td>${a.admin?.email || "-"}</td>
                <td>${a.alvo?.email ? `<a href="usuario.html?id=${encodeURIComponent(a.alvo.id)}" class="link-light">${a.alvo.email}</a>` : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    } catch (e) {
        wrap.innerHTML = `<div class="alert alert-danger">${e.message || "Erro ao carregar"}</div>`;
    }
}

load();
