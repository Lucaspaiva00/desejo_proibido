import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch } from "./api.js";

mountLayout("denuncias");
setTitle("Denúncias");
await requireAdmin();

const root = document.getElementById("pageContent");

let status = "ABERTA";
let page = 1;
const limit = 20;

root.innerHTML = `
  <div class="card-dark p-3">
    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
      <div>
        <div class="h6 fw-bold m-0">Lista de denúncias</div>
        <div class="text-secondary small">Filtre por status e clique para ver detalhes.</div>
      </div>

      <div class="d-flex gap-2">
        <select id="status" class="form-select form-select-sm" style="width:170px">
          <option value="ABERTA">ABERTA</option>
          <option value="EM_ANALISE">EM_ANALISE</option>
          <option value="RESOLVIDA">RESOLVIDA</option>
          <option value="IGNORADA">IGNORADA</option>
        </select>
        <button id="btnReload" class="btn btn-outline-light btn-sm">
          <i class="fa-solid fa-rotate"></i>
        </button>
      </div>
    </div>

    <div class="mt-3" id="tableWrap">Carregando...</div>

    <div class="d-flex justify-content-between align-items-center mt-3">
      <button id="prev" class="btn btn-outline-light btn-sm">Anterior</button>
      <div class="text-secondary small" id="pageInfo">-</div>
      <button id="next" class="btn btn-outline-light btn-sm">Próxima</button>
    </div>
  </div>
`;

document.getElementById("status").value = status;
document.getElementById("status").onchange = (e) => {
    status = e.target.value;
    page = 1;
    load();
};
document.getElementById("btnReload").onclick = () => load();
document.getElementById("prev").onclick = () => { if (page > 1) { page--; load(); } };
document.getElementById("next").onclick = () => { page++; load(); };

async function load() {
    const wrap = document.getElementById("tableWrap");
    wrap.innerHTML = "Carregando...";

    try {
        const r = await apiFetch(`/admin/denuncias?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`);
        const items = r?.data || [];
        const total = r?.total || 0;

        document.getElementById("pageInfo").textContent = `Página ${page} • Total ${total}`;

        if (!items.length) {
            wrap.innerHTML = `<div class="text-secondary">Nenhuma denúncia nesse status.</div>`;
            return;
        }

        wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-darkish align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Denunciante</th>
              <th>Denunciado</th>
              <th>Status</th>
              <th>Criado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map(d => `
              <tr>
                <td class="text-truncate" style="max-width:140px">${d.id}</td>
                <td>${d.denunciante?.email || "-"}</td>
                <td>${d.denunciado?.email || "-"}</td>
                <td><span class="badge text-bg-dark">${d.status}</span></td>
                <td>${new Date(d.criadoEm).toLocaleString()}</td>
                <td class="text-end">
                  <a class="btn btn-danger btn-sm" href="denuncia-detalhe.html?id=${encodeURIComponent(d.id)}">
                    <i class="fa-solid fa-eye"></i> Ver
                  </a>
                </td>
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
