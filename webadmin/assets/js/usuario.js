import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";
import { apiFetch, API_BASE } from "./api.js";

mountLayout("");
setTitle("Usuário");
await requireAdmin();

const params = new URLSearchParams(location.search);
const id = params.get("id");

const root = document.getElementById("pageContent");
if (!id) {
    root.innerHTML = `<div class="alert alert-danger">ID do usuário não informado.</div>`;
    throw new Error("Missing id");
}

root.innerHTML = `<div class="card-dark p-3" id="box">Carregando...</div>`;

const u = await apiFetch(`/admin/usuarios/${encodeURIComponent(id)}`);
const box = document.getElementById("box");

const fotos = u.fotos || [];
box.innerHTML = `
  <div class="d-flex justify-content-between align-items-start">
    <div>
      <div class="h6 fw-bold m-0">${u.email}</div>
      <div class="text-secondary small">ID: ${u.id}</div>
      <div class="text-secondary small">Ativo: <b>${u.ativo ? "SIM" : "NÃO"}</b> • Role: <b>${u.role}</b></div>
    </div>
    <span class="badge text-bg-dark">${u.banGlobal?.ativo ? "BAN ATIVO" : "SEM BAN"}</span>
  </div>

  <div class="mt-3">
    <div class="h6 fw-bold">Perfil</div>
    <pre class="p-2 rounded" style="border:1px solid rgba(255,255,255,.08); white-space:pre-wrap; margin:0;">
${JSON.stringify(u.perfil, null, 2)}
    </pre>
  </div>

  <div class="mt-3">
    <div class="h6 fw-bold">Fotos</div>
    ${fotos.length
        ? `<div class="row g-2">
            ${fotos.map(f => `
              <div class="col-6 col-md-3">
                <div class="card-dark p-2">
                  <img src="${API_BASE}${f.url}" class="w-100 rounded" style="aspect-ratio:1/1; object-fit:cover;" />
                  <div class="small text-secondary mt-2">${f.principal ? "Principal" : ""}</div>
                </div>
              </div>
            `).join("")}
          </div>`
        : `<div class="text-secondary">Sem fotos.</div>`
    }
  </div>

  <div class="mt-3">
    <div class="h6 fw-bold">Ban Global</div>
    <pre class="p-2 rounded" style="border:1px solid rgba(255,255,255,.08); white-space:pre-wrap; margin:0;">
${JSON.stringify(u.banGlobal, null, 2)}
    </pre>
  </div>
`;
