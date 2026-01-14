import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch } from "./api.js";

mountLayout("logs_denuncia");
setTitle("Logs de Denúncia");
await requireAdmin();

const root = document.getElementById("pageContent");

let page = 1;
const limit = 30;
let tipo = ""; // filtro

root.innerHTML = `
  <div class="card-dark p-3">
    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
      <div>
        <div class="h6 fw-bold m-0">Logs de Denúncia</div>
        <div class="text-secondary small">Auditoria do ciclo de denúncias (criação, status, ban, desban).</div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <select id="tipo" class="form-select form-select-sm" style="width:240px">
          <option value="">(Todos os tipos)</option>
          <option value="DENUNCIA_CRIADA">DENUNCIA_CRIADA</option>
          <option value="STATUS_ALTERADO">STATUS_ALTERADO</option>
          <option value="BAN_APLICADO">BAN_APLICADO</option>
          <option value="DESBANIDO">DESBANIDO</option>
        </select>

        <button id="btnReload" class="btn btn-outline-light btn-sm">
          <i class="fa-solid fa-rotate"></i>
        </button>
      </div>
    </div>

    <div class="mt-3" id="wrap">Carregando...</div>

    <div class="d-flex justify-content-between align-items-center mt-3">
      <button id="prev" class="btn btn-outline-light btn-sm">Anterior</button>
      <div class="text-secondary small" id="info">-</div>
      <button id="next" class="btn btn-outline-light btn-sm">Próxima</button>
    </div>
  </div>
`;

document.getElementById("tipo").onchange = (e) => {
    tipo = e.target.value;
    page = 1;
    load();
};

document.getElementById("btnReload").onclick = () => load();
document.getElementById("prev").onclick = () => { if (page > 1) { page--; load(); } };
document.getElementById("next").onclick = () => { page++; load(); };

function shortId(v) {
    if (!v) return "-";
    return String(v).length > 10 ? `${String(v).slice(0, 6)}…${String(v).slice(-4)}` : v;
}

async function load() {
    const wrap = document.getElementById("wrap");
    wrap.innerHTML = "Carregando...";

    try {
        const qs = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });

        if (tipo) qs.set("tipo", tipo);

        const r = await apiFetch(`/admin/logs/denuncias?${qs.toString()}`);
        const items = r?.data || [];
        const total = r?.total || 0;

        document.getElementById("info").textContent = `Página ${page} • Total ${total}`;

        if (!items.length) {
            wrap.innerHTML = `<div class="text-secondary">Nenhum log encontrado.</div>`;
            return;
        }

        wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-darkish align-middle">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Denúncia</th>
              <th>Denunciante</th>
              <th>Denunciado</th>
              <th>Status</th>
              <th>Admin</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(l => `
              <tr>
                <td>${l.criadoEm ? new Date(l.criadoEm).toLocaleString() : "-"}</td>
                <td><span class="badge text-bg-dark">${l.tipo || "-"}</span></td>
                <td title="${l.denunciaId || ""}">${shortId(l.denunciaId)}</td>
                <td title="${l.denuncianteId || ""}">${shortId(l.denuncianteId)}</td>
                <td title="${l.denunciadoId || ""}">${shortId(l.denunciadoId)}</td>
                <td>
                  ${(l.statusAntes || l.statusDepois) ? `
                    <span class="text-secondary">${l.statusAntes || "-"}</span>
                    <span class="text-secondary">→</span>
                    <span class="fw-semibold">${l.statusDepois || "-"}</span>
                  ` : "-"}
                </td>
                <td title="${l.adminId || ""}">${shortId(l.adminId)}</td>
                <td class="text-truncate" style="max-width:320px;">${l.motivo || l.detalhes || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    } catch (e) {
        console.error(e);
        wrap.innerHTML = `<div class="alert alert-danger">Erro ao carregar logs: ${e.message}</div>`;
    }
}

load();
