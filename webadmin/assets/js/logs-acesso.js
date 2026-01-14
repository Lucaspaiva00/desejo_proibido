import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch } from "./api.js";

mountLayout("logs_acesso");
setTitle("Logs de Acesso");
await requireAdmin();

const root = document.getElementById("pageContent");

let page = 1;
const limit = 30;
let evento = ""; // filtro

root.innerHTML = `
  <div class="card-dark p-3">
    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
      <div>
        <div class="h6 fw-bold m-0">Logs de Acesso</div>
        <div class="text-secondary small">Auditoria: login, token inválido, banidos, desativados, etc.</div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <select id="evento" class="form-select form-select-sm" style="width:220px">
          <option value="">(Todos os eventos)</option>
          <option value="LOGIN_OK">LOGIN_OK</option>
          <option value="LOGIN_FALHA">LOGIN_FALHA</option>
          <option value="LOGIN_BLOQUEADO">LOGIN_BLOQUEADO</option>
          <option value="TOKEN_AUSENTE">TOKEN_AUSENTE</option>
          <option value="TOKEN_INVALIDO">TOKEN_INVALIDO</option>
          <option value="USUARIO_INVALIDO">USUARIO_INVALIDO</option>
          <option value="BANIDO">BANIDO</option>
          <option value="DESATIVADO">DESATIVADO</option>
          <option value="LOGIN_ERRO">LOGIN_ERRO</option>
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

document.getElementById("evento").onchange = (e) => {
    evento = e.target.value;
    page = 1;
    load();
};

document.getElementById("btnReload").onclick = () => load();
document.getElementById("prev").onclick = () => { if (page > 1) { page--; load(); } };
document.getElementById("next").onclick = () => { page++; load(); };

async function load() {
    const wrap = document.getElementById("wrap");
    wrap.innerHTML = "Carregando...";

    try {
        const qs = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });

        if (evento) qs.set("evento", evento);

        const r = await apiFetch(`/admin/logs/acessos?${qs.toString()}`);
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
              <th>Evento</th>
              <th>Status</th>
              <th>Usuário</th>
              <th>Rota</th>
              <th>IP</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(l => `
              <tr>
                <td>${l.criadoEm ? new Date(l.criadoEm).toLocaleString() : "-"}</td>
                <td><span class="badge text-bg-dark">${l.evento || "-"}</span></td>
                <td>${l.status ?? "-"}</td>
                <td class="text-truncate" style="max-width:220px;">
                  ${l.usuario?.email || l.email || (l.usuarioId ? l.usuarioId : "-")}
                </td>
                <td class="text-truncate" style="max-width:320px;">${l.metodo || ""} ${l.rota || "-"}</td>
                <td>${l.ip || "-"}</td>
                <td class="text-truncate" style="max-width:320px;">${l.detalhe || "-"}</td>
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
