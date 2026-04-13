import { apiFetch, logout } from "./api.js";

const btnSair = document.getElementById("btnSair");
const btnSairMobile = document.getElementById("btnSairMobile");
const btnRecarregar = document.getElementById("btnRecarregar");

const msg = document.getElementById("msg");
const q = document.getElementById("q");
const listaBloqueados = document.getElementById("listaBloqueados");
const contadorBloqueados = document.getElementById("contadorBloqueados");

btnSair && (btnSair.onclick = logout);
btnSairMobile && (btnSairMobile.onclick = logout);

const state = {
    bloqueados: [],
    carregando: false,
};

function setMsg(text = "", type = "muted") {
    if (!msg) return;
    msg.className = `msgline ${type}`;
    msg.textContent = text;
}

function showToast(text, variant = "success") {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    if (!toast || !toastText) return;

    toastText.textContent = text;
    toast.className = `toast ${variant}`;
    toast.classList.remove("hidden");

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.classList.add("hidden");
    }, 2500);
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatarData(data) {
    try {
        return new Date(data).toLocaleString("pt-BR");
    } catch {
        return "";
    }
}

function getInicial(nome) {
    return String(nome || "U").trim().charAt(0).toUpperCase() || "U";
}

function atualizarContador(total) {
    if (!contadorBloqueados) return;
    contadorBloqueados.textContent = `${total} ${total === 1 ? "usuário" : "usuários"}`;
}

function renderLista() {
    const termo = String(q?.value || "").trim().toLowerCase();

    const filtrados = state.bloqueados.filter((item) => {
        const nome = item?.usuario?.perfil?.nome || "";
        const cidade = item?.usuario?.perfil?.cidade || "";
        const estado = item?.usuario?.perfil?.estado || "";

        const haystack = `${nome} ${cidade} ${estado}`.toLowerCase();
        return !termo || haystack.includes(termo);
    });

    atualizarContador(filtrados.length);

    if (!filtrados.length) {
        listaBloqueados.innerHTML = `
            <div class="bloqueados-vazio">
                Nenhum usuário bloqueado encontrado.
            </div>
        `;
        return;
    }

    listaBloqueados.innerHTML = filtrados.map((item) => {
        const usuario = item.usuario || {};
        const perfil = usuario.perfil || {};
        const nome = perfil.nome || "Usuário";
        const cidade = perfil.cidade || "";
        const estado = perfil.estado || "";
        const foto = usuario.fotoPrincipal || "";
        const criadoEm = formatarData(item.criadoEm);

        return `
            <div class="bloqueado-card">
                <div class="bloqueado-avatar">
                    ${foto
                ? `<img src="${escapeHtml(foto)}" alt="${escapeHtml(nome)}" />`
                : `<div class="bloqueado-avatar-fallback">${escapeHtml(getInicial(nome))}</div>`
            }
                </div>

                <div class="bloqueado-info">
                    <div class="bloqueado-nome">${escapeHtml(nome)}</div>

                    <div class="bloqueado-meta">
                        ${cidade || estado ? `<span class="bloqueado-chip">${escapeHtml([cidade, estado].filter(Boolean).join(" - "))}</span>` : ""}
                        <span class="bloqueado-chip">ID: ${escapeHtml(usuario.id || "")}</span>
                    </div>

                    <div class="bloqueado-data">Bloqueado em: ${escapeHtml(criadoEm)}</div>
                </div>

                <div class="bloqueado-acoes">
                    <button
                        class="btn btn-primary btnDesbloquear"
                        type="button"
                        data-id="${escapeHtml(usuario.id || "")}"
                        data-nome="${escapeHtml(nome)}"
                    >
                        Desbloquear
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function carregarBloqueados() {
    if (state.carregando) return;

    state.carregando = true;
    setMsg("Carregando bloqueados...");

    try {
        const data = await apiFetch("/bloqueios/meus");
        state.bloqueados = Array.isArray(data) ? data : [];
        renderLista();
        setMsg("");
    } catch (e) {
        console.error(e);
        state.bloqueados = [];
        renderLista();
        setMsg("Erro ao carregar bloqueados: " + (e?.message || "erro"), "error");
    } finally {
        state.carregando = false;
    }
}

async function desbloquearUsuario(usuarioId, nome) {
    if (!usuarioId) return;

    const ok = confirm(`Deseja desbloquear ${nome || "este usuário"}?`);
    if (!ok) return;

    try {
        await apiFetch(`/bloqueios/${usuarioId}`, {
            method: "DELETE",
        });

        state.bloqueados = state.bloqueados.filter((item) => item?.usuario?.id !== usuarioId);
        renderLista();
        setMsg("");
        showToast("Usuário desbloqueado com sucesso.", "success");
    } catch (e) {
        console.error(e);
        showToast("Erro ao desbloquear usuário.", "error");
    }
}

q?.addEventListener("input", renderLista);

btnRecarregar?.addEventListener("click", carregarBloqueados);

listaBloqueados?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btnDesbloquear");
    if (!btn) return;

    const usuarioId = btn.getAttribute("data-id");
    const nome = btn.getAttribute("data-nome") || "este usuário";

    btn.disabled = true;
    btn.textContent = "Desbloqueando...";

    try {
        await desbloquearUsuario(usuarioId, nome);
    } finally {
        btn.disabled = false;
        btn.textContent = "Desbloquear";
    }
});

await carregarBloqueados();