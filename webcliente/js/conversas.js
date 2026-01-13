import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
const q = document.getElementById("q");

const chatAvatar = document.getElementById("chatAvatar");
const chatAvatarFallback = document.getElementById("chatAvatarFallback");
const chatNome = document.getElementById("chatNome");
const chatSub = document.getElementById("chatSub");
const chatStatus = document.getElementById("chatStatus");
const msgsEl = document.getElementById("msgs");

const textoEl = document.getElementById("texto");
const btnEnviar = document.getElementById("btnEnviar");

document.getElementById("btnSair").onclick = logout;

const meu = JSON.parse(localStorage.getItem("usuario") || "null");
const meuId = meu?.id;

let conversas = [];
let conversaAtiva = null;
let timer = null;
let lastMsgHash = "";

function fmtHora(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function safeText(s) {
    return (s ?? "").toString();
}

function setAvatar(elImg, elFallback, url) {
    if (!url) {
        elImg.style.display = "none";
        elFallback.style.display = "flex";
        return;
    }
    elFallback.style.display = "none";
    elImg.style.display = "block";
    elImg.src = url;
    elImg.onerror = () => {
        elImg.style.display = "none";
        elFallback.style.display = "flex";
    };
}

function buildItem(c) {
    const outro = c.outroUsuario;
    const nome = outro?.perfil?.nome || "Sem nome";
    const foto = outro?.fotoPrincipal ? `${API_BASE}${outro.fotoPrincipal}` : "";

    const prev = c.ultimaMensagem?.texto ? c.ultimaMensagem.texto : "Sem mensagens ainda";
    const hora = c.ultimaMensagem?.criadoEm ? fmtHora(c.ultimaMensagem.criadoEm) : "";

    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = c.conversaId;

    div.innerHTML = `
    <div class="avatarWrap">
      <img class="avatar" alt="avatar"/>
      <div class="avatarFallback">DP</div>
    </div>

    <div style="min-width:0">
      <div class="nameRow">
        <div class="name">${safeText(nome)}</div>
        <div class="muted">${hora}</div>
      </div>
      <div class="preview">${safeText(prev)}</div>
    </div>
  `;

    // seta imagem com fallback
    const img = div.querySelector("img.avatar");
    const fb = div.querySelector(".avatarFallback");
    setAvatar(img, fb, foto);

    div.onclick = () => abrirConversa(c.conversaId);
    return div;
}

function renderLista() {
    const termo = (q.value || "").trim().toLowerCase();

    const filtradas = conversas.filter(c => {
        const nome = c.outroUsuario?.perfil?.nome || "";
        const texto = c.ultimaMensagem?.texto || "";
        return (nome + " " + texto).toLowerCase().includes(termo);
    });

    lista.innerHTML = "";
    if (!filtradas.length) {
        lista.innerHTML = `<div class="empty">Nenhuma conversa encontrada.</div>`;
        return;
    }

    filtradas.forEach(c => {
        const el = buildItem(c);
        if (conversaAtiva?.conversaId === c.conversaId) el.classList.add("active");
        lista.appendChild(el);
    });
}

async function carregarConversas({ keepActive = true } = {}) {
    try {
        msg.textContent = "";
        conversas = await apiFetch("/conversas/minhas");
        renderLista();

        // abrir a conversa do match selecionado (se existir)
        const saved = localStorage.getItem("conversaSelecionadaId");

        if (!keepActive) conversaAtiva = null;

        if (!conversaAtiva) {
            if (saved) {
                localStorage.removeItem("conversaSelecionadaId");
                const existe = conversas.find(c => c.conversaId === saved);
                if (existe) await abrirConversa(saved);
                else if (conversas.length) await abrirConversa(conversas[0].conversaId);
            } else if (conversas.length) {
                await abrirConversa(conversas[0].conversaId);
            }
        }
    } catch (e) {
        msg.textContent = e.message;
    }
}

function setAtiva(conversaId) {
    conversaAtiva = conversas.find(c => c.conversaId === conversaId) || null;
    renderLista();
}

function hashMsgs(arr) {
    return (arr || []).map(m => `${m.id}:${m.texto}`).join("|");
}

function renderMensagens(mensagens) {
    msgsEl.innerHTML = "";

    if (!mensagens?.length) {
        msgsEl.innerHTML = `<div class="empty">Sem mensagens ainda. Mande a primeira 🙂</div>`;
        return;
    }

    // sua API retorna DESC, então vamos inverter pra ficar "antiga -> nova" e scroll bottom
    const asc = [...mensagens].reverse();

    asc.forEach(m => {
        const div = document.createElement("div");
        div.className = "bubble" + (m.autorId === meuId ? " me" : "");
        div.innerHTML = `
      ${safeText(m.texto)}
      <span class="time">${fmtHora(m.criadoEm)}</span>
    `;
        msgsEl.appendChild(div);
    });

    // scroll no final (última msg)
    msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function carregarMensagens(conversaId, { silent = false } = {}) {
    try {
        if (!silent) chatStatus.textContent = "Carregando...";
        const r = await apiFetch(`/mensagens/${conversaId}?page=1&limit=40`);
        const mensagens = r.data || [];

        const h = hashMsgs(mensagens);
        if (h !== lastMsgHash) {
            lastMsgHash = h;
            renderMensagens(mensagens);
        }

        chatStatus.textContent = "";
    } catch (e) {
        chatStatus.textContent = "";
        msg.textContent = e.message;
    }
}

async function abrirConversa(conversaId) {
    setAtiva(conversaId);

    const c = conversaAtiva;
    const outro = c?.outroUsuario;

    chatNome.textContent = outro?.perfil?.nome || "Sem nome";
    chatSub.textContent = `${outro?.perfil?.cidade || ""} ${outro?.perfil?.estado || ""}`.trim();

    const foto = outro?.fotoPrincipal ? `${API_BASE}${outro.fotoPrincipal}` : "";
    setAvatar(chatAvatar, chatAvatarFallback, foto);

    textoEl.disabled = false;
    btnEnviar.disabled = false;

    lastMsgHash = "";
    await carregarMensagens(conversaId);

    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        if (!conversaAtiva) return;
        carregarMensagens(conversaAtiva.conversaId, { silent: true });
    }, 2500);
}

async function enviar() {
    try {
        if (!conversaAtiva) return;

        const texto = (textoEl.value || "").trim();
        if (!texto) return;

        textoEl.value = "";

        await apiFetch(`/mensagens/${conversaAtiva.conversaId}`, {
            method: "POST",
            body: { texto }
        });

        await carregarMensagens(conversaAtiva.conversaId);
        await carregarConversas(); // atualiza lista
    } catch (e) {
        msg.textContent = e.message;
    }
}

btnEnviar.onclick = enviar;

textoEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviar();
    }
});

q.addEventListener("input", renderLista);

carregarConversas({ keepActive: false });
