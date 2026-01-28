import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
const arquivo = document.getElementById("arquivo");
const btnUpload = document.getElementById("btnUpload");
const uploadHint = document.getElementById("uploadHint");

document.getElementById("btnSair").onclick = logout;

function setMsg(text, isError = false) {
  msg.textContent = text || "";
  msg.style.color = isError ? "rgba(255,120,120,.95)" : "rgba(255,255,255,.72)";
}

function setHint(text) {
  uploadHint.textContent = text || "Selecione uma foto para enviar.";
}

function setLoading(on) {
  btnUpload.classList.toggle("is-loading", !!on);
  btnUpload.disabled = !!on;

  const title = btnUpload.querySelector(".upload-btn-title");
  const sub = btnUpload.querySelector(".upload-btn-sub");

  if (on) {
    title.textContent = "Enviando...";
    sub.textContent = "aguarde alguns segundos";
  } else {
    title.textContent = "Adicionar Foto";
    sub.textContent = "JPG ou PNG • até 10MB";
  }
}

async function listar() {
  setMsg("");
  lista.innerHTML = `<div style="padding:14px; color:rgba(255,255,255,.72);">Carregando...</div>`;

  const fotos = await apiFetch("/fotos/minhas");
  if (!fotos?.length) {
    lista.innerHTML = `<div style="padding:14px; color:rgba(255,255,255,.72);">Você ainda não enviou fotos.</div>`;
    return;
  }

  lista.innerHTML = fotos.map((f) => {
    const principal = !!f.principal;

    return `
      <div class="foto-card">
        <div class="foto-img-wrap">
          <img class="foto-img" src="${f.url}" alt="Foto" />
          ${principal ? `<div class="badge-destaque"><span class="badge-dot"></span>Em Destaque</div>` : ``}
        </div>

        <div class="foto-actions ${principal ? "uma" : "duas"}">
          ${principal ? `` : `
            <button class="fbtn fbtn-red" data-principal="${f.id}">
              Definir como Destaque
            </button>
          `}
          <button class="fbtn ${principal ? "fbtn-red" : "fbtn-dark"}" data-del="${f.id}">
            Remover
          </button>
        </div>
      </div>
    `;
  }).join("");

  // definir principal
  document.querySelectorAll("[data-principal]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        const id = btn.getAttribute("data-principal");
        await apiFetch(`/fotos/${id}/principal`, { method: "PATCH" });
        setMsg("✅ Foto definida como destaque!");
        await listar();
      } catch (e) {
        setMsg(e?.message || "Erro ao definir destaque", true);
      }
    };
  });

  // remover
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        const id = btn.getAttribute("data-del");
        if (!confirm("Remover esta foto?")) return;
        await apiFetch(`/fotos/${id}`, { method: "DELETE" });
        setMsg("🗑️ Foto removida!");
        await listar();
      } catch (e) {
        setMsg(e?.message || "Erro ao remover foto", true);
      }
    };
  });
}

/* =========================
   UPLOAD igual print:
   - botão abre seletor
   - ao escolher arquivo, faz upload
========================= */
btnUpload.onclick = () => {
  setMsg("");
  arquivo.click();
};

arquivo.onchange = async () => {
  const file = arquivo.files?.[0];
  if (!file) return;

  try {
    setMsg("");
    // validações
    const isImg = /^image\//.test(file.type);
    if (!isImg) throw new Error("Arquivo inválido (envie uma imagem).");

    const mb = file.size / (1024 * 1024);
    if (mb > 10) throw new Error("Arquivo acima de 10MB.");

    setHint(`Selecionado: ${file.name}`);
    setLoading(true);

    // ✅ Cloudinary unsigned (SEM SECRET NO FRONT)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "desejoproibido"); // precisa ser UNSIGNED
    formData.append("folder", "desejoproibido");

    const responseUpload = await fetch(
      "https://api.cloudinary.com/v1_1/dfdinbti3/image/upload",
      { method: "POST", body: formData }
    ).then((res) => res.json());

    if (responseUpload.error) {
      throw new Error(responseUpload.error.message);
    }

    // grava no seu backend
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/fotos/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: responseUpload.secure_url }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.erro || `Erro HTTP ${res.status}`);

    // se não veio principal, seta
    if (!data.principal) {
      await apiFetch(`/fotos/${data.id}/principal`, { method: "PATCH" });
    }

    setMsg("✅ Upload feito e definido como principal!");
    setHint("Selecione uma foto para enviar.");
    arquivo.value = "";
    await listar();
  } catch (e) {
    setMsg(e?.message || "Erro no upload", true);
  } finally {
    setLoading(false);
  }
};

listar();
