import { apiFetch, API_BASE, logout } from "./api.js";

const card = document.getElementById("card");
const msg = document.getElementById("msg");

let fila = [];
let atual = null;

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

// ===== Modal limite =====
const overlay = document.getElementById("limiteCurtidasOverlay");
const btnFecharLimite = document.getElementById("btnFecharLimite");
const btnVirarPremium = document.getElementById("btnVirarPremium");

// ===== TOAST =====
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
let toastTimer = null;

function showToast(text, type = "success", ms = 2200) {
    if (!toast || !toastText) return;

    toast.classList.remove("hidden", "success", "error", "warn");
    toast.classList.add(type);

    toastText.textContent = text;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add("hidden");
    }, ms);
}

function mostrarLimiteCurtidas() {
    overlay?.classList.remove("hidden");
    document.body.classList.add("no-scroll");
}

function fecharLimiteCurtidas() {
    overlay?.classList.add("hidden");
    document.body.classList.remove("no-scroll");
}

btnFecharLimite?.addEventListener("click", fecharLimiteCurtidas);
overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) fecharLimiteCurtidas();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharLimiteCurtidas();
});

if (btnVirarPremium) {
    btnVirarPremium.addEventListener("click", async () => {
        try {
            btnVirarPremium.disabled = true;
            btnVirarPremium.textContent = "Abrindo pagamento...";

            const r = await apiFetch("/pagamentos/premium", { method: "POST" });

            // fecha modal
            fecharLimiteCurtidas();

            // redireciona pro MP
            window.location.href = r.init_point;
        } catch (e) {
            alert(e.message || "Erro ao abrir pagamento");
        } finally {
            btnVirarPremium.disabled = false;
            btnVirarPremium.textContent = "Virar Premium";
        }
    });
}

function safe(s) {
    return (s ?? "").toString();
}

async function carregar() {
    msg.textContent = "";
    const r = await apiFetch(`/feed?page=1&limit=20`);
    fila = r.data || [];
    proximo();
}

function render(u) {
    if (!u) {
        card.innerHTML = `
      <div class="tfallback">
        <div class="tbadgeBig">DP</div>
        <div class="muted">Sem pessoas no feed (crie outro usuário com perfil + foto principal).</div>
      </div>
    `;
        return;
    }

    const nome = safe(u.perfil?.nome).trim() || "Sem nome";
    const bio = safe(u.perfil?.bio).trim();
    const cidade = safe(u.perfil?.cidade).trim();
    const estado = safe(u.perfil?.estado).trim();
    const loc = `${cidade} ${estado}`.trim();

    const fotoUrl = u.fotoPrincipal ? `${API_BASE}${u.fotoPrincipal}` : "";

    card.innerHTML = `
    ${fotoUrl ? `<img class="tphoto" src="${fotoUrl}" alt="Foto" />` : ""}
    ${fotoUrl ? `<div class="toverlay"></div>` : `
      <div class="tfallback">
        <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
        <div class="muted">Sem foto principal</div>
      </div>
    `}

    <div class="tcontent">
      <div class="tnameRow">
        <div class="tname">${nome}</div>
      </div>

      <div class="tchipRow">
        ${loc ? `<span class="tchip">📍 ${loc}</span>` : ""}
      </div>

      ${bio ? `<div class="tbio">${bio}</div>` : ""}
    </div>
  `;

    // fallback se imagem quebrar
    const img = card.querySelector(".tphoto");
    if (img) {
        img.onerror = () => {
            card.innerHTML = `
        <div class="tfallback">
          <div class="tbadgeBig">${(nome[0] || "D").toUpperCase()}</div>
          <div class="muted">Não foi possível carregar a foto</div>
        </div>
        <div class="tcontent">
          <div class="tnameRow"><div class="tname">${nome}</div></div>
          <div class="tchipRow">
            ${loc ? `<span class="tchip">📍 ${loc}</span>` : ""}
          </div>
          ${bio ? `<div class="tbio">${bio}</div>` : ""}
        </div>
      `;
        };
    }
}

function proximo() {
    atual = fila.shift() || null;
    render(atual);
}

document.getElementById("btnCurtir").onclick = async () => {
    try {
        if (!atual) return;

        const r = await apiFetch(`/curtidas/${atual.id}`, { method: "POST" });
        showToast(r.matchCriado ? "✅ Deu MATCH! (conversa criada)" : "✅ Curtido", "success");
        proximo();

    } catch (e) {
        const isLimite =
            e?.status === 429 ||
            e?.data?.limite ||
            (e?.message || "").toLowerCase().includes("limite diário");

        if (isLimite) {
            showToast("⚠️ Limite diário atingido", "warn", 1400);
            mostrarLimiteCurtidas();
            return;
        }

        msg.textContent = e.message || "Erro ao curtir";
    }
};

document.getElementById("btnPular").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/skips/${atual.id}`, { method: "POST" });
        msg.textContent = "⟲ Pulado";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

document.getElementById("btnBloquear").onclick = async () => {
    try {
        if (!atual) return;
        await apiFetch(`/bloqueios/${atual.id}`, { method: "POST" });
        msg.textContent = "⛔ Bloqueado";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

document.getElementById("btnDenunciar").onclick = async () => {
    try {
        if (!atual) return;
        const motivo = prompt("Motivo da denúncia (ex: perfil falso):");
        if (!motivo) return;
        const descricao = prompt("Descrição (opcional):") || null;

        await apiFetch(`/denuncias`, {
            method: "POST",
            body: { denunciadoId: atual.id, motivo, descricao }
        });

        msg.textContent = "🚩 Denúncia enviada";
        proximo();
    } catch (e) {
        msg.textContent = e.message;
    }
};

carregar();
