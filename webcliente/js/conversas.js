import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

// UI
const q = document.getElementById("q");
const lista = document.getElementById("lista");

const chatNome = document.getElementById("chatNome");
const chatSub = document.getElementById("chatSub");
const chatAvatar = document.getElementById("chatAvatar");
const chatAvatarFallback = document.getElementById("chatAvatarFallback");
const chatStatus = document.getElementById("chatStatus");

const msgs = document.getElementById("msgs");
const texto = document.getElementById("texto");
const btnEnviar = document.getElementById("btnEnviar");

const btnGift = document.getElementById("btnGift");
const btnCall = document.getElementById("btnCall");
const minutosPill = document.getElementById("minutosPill");

// Modal presentes
const giftOverlay = document.getElementById("giftOverlay");
const giftClose = document.getElementById("giftClose");
const giftList = document.getElementById("giftList");

// =====================================
// ✅ Auth robusto (não depende da chave)
// =====================================
function safeJsonParse(v) {
    try {
        return JSON.parse(v);
    } catch {
        return null;
    }
}

function getAuth() {
    // tenta achar token/usuário em várias chaves comuns do projeto
    const keysUser = ["usuarioLogado", "usuario", "user", "authUser"];
    const keysToken = ["token", "authToken", "dp_token", "tokenJwt"];

    let usuario = null;
    for (const k of keysUser) {
        const v = localStorage.getItem(k);
        if (v) {
            const obj = safeJsonParse(v);
            if (obj) {
                usuario = obj;
                break;
            }
        }
    }

    let token = null;
    for (const k of keysToken) {
        const v = localStorage.getItem(k);
        if (v) {
            token = v;
            break;
        }
    }

    // fallback: se você guarda um objeto "auth" com { token, usuario }
    const authRaw = localStorage.getItem("auth");
    if (authRaw) {
        const a = safeJsonParse(authRaw);
        if (a) {
            if (!token && a.token) token = a.token;
            if (!usuario && a.usuario) usuario = a.usuario;
        }
    }

    // fallback final: se o login guardou só "usuarioLogado" e token não
    // (nesse caso, o api.js provavelmente falha; a gente tenta puxar de "usuarioLogado.token")
    if (!token && usuario?.token) token = usuario.token;

    return { usuario, token };
}

const auth = getAuth();

// garante token na chave "token" (muitos api.js usam essa)
if (auth.token && !localStorage.getItem("token")) {
    localStorage.setItem("token", auth.token);
}

// Estado
const state = {
    usuario: auth.usuario,
    conversaId: null,
    outroUsuarioId: null,
    conversas: [],
    presentesCache: null,

    // Ligação MVP
    sessaoIdAtiva: null,
    t0: null,
};

// se não achou nada, manda pro login
if (!state.usuario && !localStorage.getItem("token")) {
    alert("Sessão expirada. Faça login.");
    location.href = "login.html";
}

// ==============================
// Helpers
// ==============================
function setMsg(text, type = "muted") {
    msg.className = `msgline ${type}`;
    msg.textContent = text || "";
}

function escapeHtml(s) {
    return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function openGiftModal() {
    giftOverlay?.classList.add("show");
    giftOverlay?.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
}

function closeGiftModal() {
    giftOverlay?.classList.remove("show");
    giftOverlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
}

giftClose?.addEventListener("click", closeGiftModal);
giftOverlay?.addEventListener("click", (e) => {
    if (e.target === giftOverlay) closeGiftModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeGiftModal();
});

// ==============================
// API endpoints
// ==============================
const API = {
    listarConversas: "/conversas",
    mensagensDaConversa: (conversaId) => `/conversas/${conversaId}/mensagens`,
    enviarMensagem: "/mensagens",

    listarPresentes: "/presentes",
    enviarPresente: "/presentes/enviar",

    saldoMinutos: "/ligacoes/saldo",
    iniciarLigacao: "/ligacoes/iniciar",
    finalizarLigacao: "/ligacoes/finalizar",
};

// ==============================
// Carregar lista de conversas
// ==============================
async function carregarConversas() {
    try {
        setMsg("Carregando conversas...");
        const data = await apiFetch(API.listarConversas);
        state.conversas = Array.isArray(data) ? data : (data.data || []);
        renderLista();
        setMsg("");
    } catch (e) {
        setMsg("Erro ao carregar conversas: " + e.message, "error");
    }
}

function renderLista() {
    const filtro = (q.value || "").toLowerCase().trim();

    const items = state.conversas.filter((c) => {
        const nome = (c.outro?.perfil?.nome || c.outroNome || c.outroEmail || "").toLowerCase();
        return !filtro || nome.includes(filtro);
    });

    if (!items.length) {
        lista.innerHTML = `<div class="empty">Nenhuma conversa.</div>`;
        return;
    }

    lista.innerHTML = items.map((c) => {
        const nome = c.outro?.perfil?.nome || c.outroNome || c.outro?.email || "Usuário";
        const sub = c.ultimaMensagem?.texto || c.ultimaMensagem || "";
        const active = (state.conversaId === c.id) ? "active" : "";
        return `
      <button class="item ${active}" data-id="${c.id}">
        <div class="row1">
          <div class="title">${escapeHtml(nome)}</div>
          <div class="time muted">${c.atualizadoEm ? new Date(c.atualizadoEm).toLocaleDateString() : ""}</div>
        </div>
        <div class="row2 muted">${escapeHtml(sub).slice(0, 60)}</div>
      </button>
    `;
    }).join("");

    [...lista.querySelectorAll("button[data-id]")].forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            abrirConversa(id);
        });
    });
}

q?.addEventListener("input", renderLista);

// ==============================
// Abrir conversa (lado direito)
// ==============================
async function abrirConversa(conversaId) {
    state.conversaId = conversaId;

    const c = state.conversas.find((x) => x.id === conversaId);
    if (!c) return;

    // tenta descobrir "outro usuário"
    const outro = c.outro || c.usuarioB || c.usuarioA || null;
    const nome = outro?.perfil?.nome || c.outroNome || outro?.email || "Conversa";
    const sub = outro?.email ? outro.email : "";

    state.outroUsuarioId =
        c.outroUsuarioId ||
        outro?.id ||
        c.outroId ||
        null;

    chatNome.textContent = nome;
    chatSub.textContent = sub;

    // avatar
    const foto = outro?.fotos?.find?.((f) => f.principal)?.url || outro?.fotoPrincipal || null;
    if (foto) {
        chatAvatar.src = foto;
        chatAvatar.style.display = "block";
        chatAvatarFallback.style.display = "none";
    } else {
        chatAvatar.removeAttribute("src");
        chatAvatar.style.display = "none";
        chatAvatarFallback.style.display = "flex";
        chatAvatarFallback.textContent = (nome || "DP").slice(0, 2).toUpperCase();
    }

    // habilita composer e botões
    if (texto) texto.disabled = false;
    if (btnEnviar) btnEnviar.disabled = false;
    if (btnGift) btnGift.disabled = false;
    if (btnCall) btnCall.disabled = false;

    // render lista com active
    renderLista();

    await atualizarSaldo();
    await carregarMensagens();
}

// ==============================
// Mensagens
// ==============================
async function carregarMensagens() {
    if (!state.conversaId) return;

    try {
        chatStatus.textContent = "Carregando...";
        const data = await apiFetch(API.mensagensDaConversa(state.conversaId));
        const items = Array.isArray(data) ? data : (data.data || []);
        renderMensagens(items);
        chatStatus.textContent = "";
    } catch (e) {
        chatStatus.textContent = "Erro";
        msgs.innerHTML = `<div class="empty">Erro ao carregar mensagens: ${escapeHtml(e.message)}</div>`;
    }
}

function renderMensagens(items) {
    if (!items?.length) {
        msgs.innerHTML = `<div class="empty">Sem mensagens ainda.</div>`;
        return;
    }

    const me = state.usuario?.id;

    msgs.innerHTML = items.map((m) => {
        const isMe = (m.autorId === me);
        const tipo = m.tipo || "TEXTO";

        const dt = m.criadoEm ? new Date(m.criadoEm).toLocaleString() : "";
        const meta = m.metaJson || {};

        let extraClass = "";
        if (tipo === "SISTEMA") extraClass = "system";
        if (tipo === "PRESENTE") extraClass = "gift";

        let conteudo = "";
        if (tipo === "PRESENTE") {
            const nome = meta.nome || (m.texto || "🎁 Presente");
            const min = meta.minutos ?? 0;
            conteudo = `<div><b>🎁 ${escapeHtml(nome)}</b> <span class="dp-pill">${min} min</span></div>`;
        } else {
            conteudo = `<div>${escapeHtml(m.texto || "")}</div>`;
        }

        return `
      <div class="msgRow ${isMe ? "me" : "other"}">
        <div class="bubble ${extraClass}">
          ${conteudo}
          <div class="meta muted">${escapeHtml(dt)}</div>
        </div>
      </div>
    `;
    }).join("");

    msgs.scrollTop = msgs.scrollHeight;
}

async function enviarMensagem() {
    const t = (texto.value || "").trim();
    if (!t || !state.conversaId) return;

    texto.value = "";
    btnEnviar.disabled = true;

    try {
        await apiFetch(API.enviarMensagem, {
            method: "POST",
            body: { conversaId: state.conversaId, texto: t },
        });

        await carregarMensagens();
    } catch (e) {
        alert("Erro ao enviar: " + e.message);
    } finally {
        btnEnviar.disabled = false;
        texto.focus();
    }
}

btnEnviar?.addEventListener("click", enviarMensagem);
texto?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
    }
});

// ==============================
// Presentes (webcliente)
// ==============================
btnGift?.addEventListener("click", async () => {
    if (!state.conversaId) return;
    await carregarPresentes();
    openGiftModal();
});

async function carregarPresentes() {
    giftList.innerHTML = "Carregando...";

    try {
        if (!state.presentesCache) {
            state.presentesCache = await apiFetch(API.listarPresentes);
        }
        const itens = state.presentesCache || [];

        if (!itens.length) {
            giftList.innerHTML = `<div class="muted">Nenhum presente cadastrado.</div>`;
            return;
        }

        giftList.innerHTML = itens.map((p) => `
      <button class="dp-gift" data-id="${p.id}">
        <div>
          <span class="name">${escapeHtml(p.nome)}</span>
          <span class="sub">Crédita ${p.minutos} minuto(s)</span>
        </div>
        <span class="dp-pill">${p.minutos} min</span>
      </button>
    `).join("");

        [...giftList.querySelectorAll("button[data-id]")].forEach((btn) => {
            btn.addEventListener("click", async () => {
                const presenteId = btn.getAttribute("data-id");
                await enviarPresente(presenteId);
            });
        });
    } catch (e) {
        giftList.innerHTML = `<div class="muted">Erro: ${escapeHtml(e.message)}</div>`;
    }
}

async function enviarPresente(presenteId) {
    try {
        await apiFetch(API.enviarPresente, {
            method: "POST",
            body: { conversaId: state.conversaId, presenteId },
        });

        closeGiftModal();
        await carregarMensagens();
        await atualizarSaldo();
    } catch (e) {
        alert("Erro ao enviar presente: " + e.message);
    }
}

// ==============================
// Minutos + Ligações (MVP)
// ==============================
async function atualizarSaldo() {
    try {
        const r = await apiFetch(API.saldoMinutos);
        if (minutosPill) minutosPill.textContent = `⏱️ Minutos: ${r.minutosDisponiveis}`;
    } catch {
        if (minutosPill) minutosPill.textContent = "⏱️ Minutos: -";
    }
}

btnCall?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.sessaoIdAtiva) {
        await iniciarLigacaoMVP();
    } else {
        await finalizarLigacaoMVP();
    }
});

async function iniciarLigacaoMVP() {
    try {
        btnCall.disabled = true;
        chatStatus.textContent = "Iniciando ligação...";

        const r = await apiFetch(API.iniciarLigacao, {
            method: "POST",
            body: { conversaId: state.conversaId },
        });

        state.sessaoIdAtiva = r.sessaoId;
        state.t0 = Date.now();

        chatStatus.textContent = "Ligação em andamento (MVP)";
        btnCall.textContent = "⛔";
    } catch (e) {
        alert("Erro ao iniciar ligação: " + e.message);
        chatStatus.textContent = "";
    } finally {
        btnCall.disabled = false;
    }
}

async function finalizarLigacaoMVP() {
    try {
        btnCall.disabled = true;
        chatStatus.textContent = "Finalizando...";

        const segundos = Math.max(1, Math.floor((Date.now() - state.t0) / 1000));

        const r = await apiFetch(API.finalizarLigacao, {
            method: "POST",
            body: {
                sessaoId: state.sessaoIdAtiva,
                conversaId: state.conversaId,
                segundosConsumidos: segundos,
            },
        });

        state.sessaoIdAtiva = null;
        state.t0 = null;

        btnCall.textContent = "📞";
        chatStatus.textContent = `Finalizada: ${r.sessao?.minutosCobrados ?? "?"} min`;

        await carregarMensagens();
        await atualizarSaldo();
    } catch (e) {
        alert("Erro ao finalizar ligação: " + e.message);
        chatStatus.textContent = "";
    } finally {
        btnCall.disabled = false;
    }
}

// ==============================
// Init
// ==============================
await carregarConversas();

// auto refresh se uma conversa estiver aberta
setInterval(() => {
    if (state.conversaId) carregarMensagens();
}, 4000);
