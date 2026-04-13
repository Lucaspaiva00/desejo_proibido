import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
const arquivo = document.getElementById("arquivo");
const btnUpload = document.getElementById("btnUpload");
const uploadHint = document.getElementById("uploadHint");

const fotoModal = document.getElementById("fotoModal");
const fotoModalImg = document.getElementById("fotoModalImg");
const fotoModalClose = document.getElementById("fotoModalClose");
const fotoModalBackdrop = document.getElementById("fotoModalBackdrop");

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

function openFotoModal(src, alt = "Foto ampliada") {
  if (!fotoModal || !fotoModalImg || !src) return;

  fotoModalImg.src = src;
  fotoModalImg.alt = alt;
  fotoModal.classList.remove("hidden");
  fotoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeFotoModal() {
  if (!fotoModal || !fotoModalImg) return;

  fotoModal.classList.add("hidden");
  fotoModal.setAttribute("aria-hidden", "true");
  fotoModalImg.src = "";
  fotoModalImg.alt = "Foto ampliada";
  document.body.classList.remove("no-scroll");
}

fotoModalClose?.addEventListener("click", closeFotoModal);
fotoModalBackdrop?.addEventListener("click", closeFotoModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fotoModal && !fotoModal.classList.contains("hidden")) {
    closeFotoModal();
  }
});

function bindCardActions() {
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

  document.querySelectorAll(".foto-img").forEach((img) => {
    img.addEventListener("click", () => {
      const src = img.getAttribute("data-full") || img.src;
      openFotoModal(src, img.alt || "Foto ampliada");
    });

    img.addEventListener("error", () => {
      img.style.opacity = "0.55";
      img.alt = "Não foi possível carregar a foto";
    });
  });
}

async function listar() {
  setMsg("");
  lista.innerHTML = `<div style="padding:14px; color:rgba(255,255,255,.72);">Carregando...</div>`;

  try {
    const fotos = await apiFetch("/fotos/minhas");

    if (!fotos?.length) {
      lista.innerHTML = `<div class="fotos-empty" style="padding:14px; color:rgba(255,255,255,.72);">Você ainda não enviou fotos.</div>`;
      return;
    }

    lista.innerHTML = fotos.map((f, index) => {
      const principal = !!f.principal;
      const alt = principal ? `Foto ${index + 1} em destaque` : `Foto ${index + 1}`;

      return `
        <div class="foto-card">
          <div class="foto-img-wrap">
            <img
              class="foto-img"
              src="${f.url}"
              data-full="${f.url}"
              alt="${alt}"
              loading="lazy"
            />
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

    bindCardActions();
  } catch (e) {
    lista.innerHTML = `<div class="fotos-empty" style="padding:14px; color:rgba(255,120,120,.95);">Erro ao carregar fotos.</div>`;
    setMsg(e?.message || "Erro ao listar fotos", true);
  }
}

/* =========================
   UPLOAD
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

    const isImg = /^image\//.test(file.type);
    if (!isImg) throw new Error("Arquivo inválido (envie uma imagem).");

    const mb = file.size / (1024 * 1024);
    if (mb > 10) throw new Error("Arquivo acima de 10MB.");

    setHint(`Selecionado: ${file.name}`);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "desejoproibido");
    formData.append("folder", "desejoproibido");

    const responseUpload = await fetch(
      "https://api.cloudinary.com/v1_1/dfdinbti3/image/upload",
      { method: "POST", body: formData }
    ).then((res) => res.json());

    if (responseUpload.error) {
      throw new Error(responseUpload.error.message);
    }

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