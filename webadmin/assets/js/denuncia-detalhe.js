import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch } from "./api.js";

mountLayout("denuncias");
setTitle("Detalhe da denúncia");
await requireAdmin();

const params = new URLSearchParams(location.search);
const id = params.get("id");

const root = document.getElementById("pageContent");
if (!id) {
  root.innerHTML = `<div class="alert alert-danger">ID da denúncia não informado.</div>`;
  throw new Error("Missing id");
}

root.innerHTML = `
  <div class="row g-3">
    <div class="col-12 col-lg-8">
      <div class="card-dark p-3" id="boxDenuncia">Carregando...</div>
      <div id="msg" class="mt-3"></div>
    </div>
    <div class="col-12 col-lg-4">
      <div class="card-dark p-3">
        <div class="h6 fw-bold">Ações</div>
        <div class="text-secondary small mb-3">Atualize status ou aplique ban global.</div>

        <label class="form-label small">Status</label>
        <select id="status" class="form-select form-select-sm mb-2">
          <option value="ABERTA">ABERTA</option>
          <option value="EM_ANALISE">EM_ANALISE</option>
          <option value="RESOLVIDA">RESOLVIDA</option>
          <option value="IGNORADA">IGNORADA</option>
        </select>

        <label class="form-label small">Detalhes (log)</label>
        <textarea id="detalhes" class="form-control form-control-sm mb-2" rows="3"
          placeholder="Motivo / observação..."></textarea>

        <button id="btnSalvarStatus" class="btn btn-outline-light btn-sm w-100 mb-3">
          Salvar status
        </button>

        <div class="border-top pt-3" style="border-color: rgba(255,255,255,.08)!important;">
          <label class="form-label small">Motivo do Ban</label>
          <input id="motivoBan" class="form-control form-control-sm mb-2" placeholder="Ex.: Conteúdo impróprio" />

          <label class="form-label small">Até (opcional ISO)</label>
          <input id="ateBan" class="form-control form-control-sm mb-2" placeholder="2026-02-10T00:00:00.000Z" />

          <button id="btnBan" class="btn btn-danger btn-sm w-100 mb-2">
            Ban global
          </button>

          <button id="btnDesban" class="btn btn-outline-light btn-sm w-100">
            Desbanir
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const msg = document.getElementById("msg");

function showMsg(type, text) {
  msg.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.oldText ??= btn.innerHTML;
  btn.innerHTML = loading ? "Aguarde..." : btn.dataset.oldText;
}

let denuncia = null;

async function load() {
  const box = document.getElementById("boxDenuncia");
  box.innerHTML = "Carregando...";
  msg.innerHTML = "";

  denuncia = await apiFetch(`/admin/denuncias/${encodeURIComponent(id)}`);

  // IMPORTANTÍSSIMO: garantir denunciadoId
  const denunciadoId =
    denuncia?.denunciadoId ||
    denuncia?.denunciado?.id ||
    null;

  root.dataset.denunciadoId = denunciadoId || "";

  document.getElementById("status").value = denuncia.status;

  box.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div>
        <div class="h6 fw-bold m-0">Denúncia</div>
        <div class="text-secondary small">ID: ${denuncia.id}</div>
      </div>
      <span class="badge text-bg-dark">${denuncia.status}</span>
    </div>

    <div class="row mt-3 g-3">
      <div class="col-12 col-md-6">
        <div class="p-2 rounded" style="border:1px solid rgba(255,255,255,.08);">
          <div class="small text-secondary">Denunciante</div>
          <div class="fw-semibold">${denuncia.denunciante?.email || "-"}</div>
          <a class="btn btn-sm btn-outline-light mt-2"
             href="usuario.html?id=${encodeURIComponent(denuncia.denuncianteId)}">
            Ver usuário
          </a>
        </div>
      </div>

      <div class="col-12 col-md-6">
        <div class="p-2 rounded" style="border:1px solid rgba(255,255,255,.08);">
          <div class="small text-secondary">Denunciado</div>
          <div class="fw-semibold">${denuncia.denunciado?.email || "-"}</div>
          <div class="text-secondary small">
            Ban: ${denuncia.denunciado?.banGlobal?.ativo ? "ATIVO" : "NÃO"}
          </div>
          ${denunciadoId
      ? `<a class="btn btn-sm btn-outline-light mt-2"
                    href="usuario.html?id=${encodeURIComponent(denunciadoId)}">
                   Ver usuário
                 </a>`
      : `<div class="text-warning small mt-2">⚠ Não encontrei denunciadoId nessa denúncia.</div>`
    }
        </div>
      </div>
    </div>

    <div class="mt-3 p-3 rounded" style="border:1px solid rgba(255,255,255,.08);">
      <div class="small text-secondary">Conteúdo / Motivo</div>
      <div class="mt-1">${(denuncia.motivo || denuncia.descricao || "-")}</div>
    </div>

    <div class="mt-3 text-secondary small">
      Criado em: ${new Date(denuncia.criadoEm).toLocaleString()}
    </div>
  `;
}

const btnSalvar = document.getElementById("btnSalvarStatus");
const btnBan = document.getElementById("btnBan");
const btnDesban = document.getElementById("btnDesban");

btnSalvar.onclick = async () => {
  setLoading(btnSalvar, true);
  try {
    const status = document.getElementById("status").value;
    const detalhes = document.getElementById("detalhes").value.trim() || null;

    await apiFetch(`/admin/denuncias/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, detalhes }),
    });

    showMsg("success", "Status atualizado com sucesso.");
    await load();
  } catch (e) {
    console.error(e);
    showMsg("danger", `Erro ao salvar status: ${e.message}`);
  } finally {
    setLoading(btnSalvar, false);
  }
};

btnBan.onclick = async () => {
  setLoading(btnBan, true);
  try {
    const usuarioId = root.dataset.denunciadoId;
    if (!usuarioId) throw new Error("denunciadoId não encontrado. Verifique retorno do /admin/denuncias/:id");

    const motivo = document.getElementById("motivoBan").value.trim() || null;
    const ateRaw = document.getElementById("ateBan").value.trim();
    const ate = ateRaw ? ateRaw : null;

    await apiFetch(`/admin/ban-global`, {
      method: "POST",
      body: JSON.stringify({ usuarioId, motivo, ate }),
    });

    showMsg("success", "Ban aplicado com sucesso.");
    await load();
  } catch (e) {
    console.error(e);
    showMsg("danger", `Erro ao aplicar ban: ${e.message}`);
  } finally {
    setLoading(btnBan, false);
  }
};

btnDesban.onclick = async () => {
  setLoading(btnDesban, true);
  try {
    const usuarioId = root.dataset.denunciadoId;
    if (!usuarioId) throw new Error("denunciadoId não encontrado.");

    await apiFetch(`/admin/desbanir`, {
      method: "POST",
      body: JSON.stringify({ usuarioId }),
    });

    showMsg("success", "Usuário desbanido com sucesso.");
    await load();
  } catch (e) {
    console.error(e);
    showMsg("danger", `Erro ao desbanir: ${e.message}`);
  } finally {
    setLoading(btnDesban, false);
  }
};

load();
