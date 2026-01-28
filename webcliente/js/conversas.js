import { apiFetch, logout, API_BASE } from "./api.js";

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

// Paywall / Premium UI
const paywall = document.getElementById("paywall");
const premiumBadge = document.getElementById("premiumBadge");
const btnAssinar = document.getElementById("btnAssinar");
const btnEntendi = document.getElementById("btnEntendi");
const btnAssinarTopo = document.getElementById("btnAssinarTopo");
const chatPanel = document.querySelector(".panel.right.chat");

// Modal presentes
const giftOverlay = document.getElementById("giftOverlay");
const giftClose = document.getElementById("giftClose");
const giftList = document.getElementById("giftList");

// =====================================
// ✅ Auth robusto (não depende da chave)
// =====================================
function safeJsonParse(v) {
    try { return JSON.parse(v); } catch { return null; }
}

function getAuth() {
    const keysUser = ["usuarioLogado", "usuario", "user", "authUser"];
    const keysToken = ["token", "authToken", "dp_token", "tokenJwt"];

    let usuario = null;
    for (const k of keysUser) {
        const v = localStorage.getItem(k);
        if (v) {
            const obj = safeJsonParse(v);
            if (obj) { usuario = obj; break; }
        }
    }

    let token = null;
    for (const k of keysToken) {
        const v = localStorage.getItem(k);
        if (v) { token = v; break; }
    }

    const authRaw = localStorage.getItem("auth");
    if (authRaw) {
        const a = safeJsonParse(authRaw);
        if (a) {
            if (!token && a.token) token = a.token;
            if (!usuario && a.usuario) usuario = a.usuario;
        }
    }

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
    premiumAtivo: false,

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
    if (!msg) return;
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
// Premium UI
// ==============================
function setPremiumUI(isPremium) {
    state.premiumAtivo = !!isPremium;

    if (premiumBadge) {
        premiumBadge.textContent = isPremium ? "✅ Conta Premium Ativa" : "🔒 Conta Premium Inativa";
    }

    if (btnAssinarTopo) btnAssinarTopo.style.display = isPremium ? "none" : "inline-flex";
    if (paywall) paywall.hidden = isPremium;

    const lock = !isPremium;

    // só libera se existir conversa aberta
    const hasChat = !!state.conversaId;

    if (texto) texto.disabled = lock || !hasChat;
    if (btnEnviar) btnEnviar.disabled = lock || !hasChat;
    if (btnGift) btnGift.disabled = lock || !hasChat;
    if (btnCall) btnCall.disabled = lock || !hasChat;

    if (chatPanel) chatPanel.classList.toggle("locked", lock);
}

function openCheckout() {
    // ✅ aqui você joga pra página real de assinatura
    // Ex: location.href = "premium.html";
    alert("Abrir checkout do Premium (implementar link real).");
}

btnAssinar?.addEventListener("click", openCheckout);
btnAssinarTopo?.addEventListener("click", openCheckout);
btnEntendi?.addEventListener("click", () => {
    // só fecha overlay visualmente (não destrava)
    if (paywall) paywall.hidden = true;
    setTimeout(() => { if (!state.premiumAtivo) paywall.hidden = false; }, 900);
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

    // ✅ Premium (se existir no backend)
    premiumStatus: "/premium/status",
};

// ==============================
// Checar Premium
// - tenta endpoint /premium/status
// - fallback: tenta ler do usuario local
// ==============================
async function checarPremium() {
    // fallback local (se você já salva isso no login)
    const local =
        !!state.usuario?.premiumAtivo ||
        !!state.usuario?.isPremium ||
        !!state.usuario?.premium;

    try {
        // tenta endpoint (recomendado)
        const r = await apiFetch(API.premiumStatus);
        // aceita formatos diferentes
        const ativo =
            !!r?.premiumAtivo ||
            !!r?.ativo ||
            !!r?.isPremium ||
            !!r?.premium;

        setPremiumUI(ativo);
        return;
    } catch (e) {
        // se endpoint não existe ainda, usa fallback local
        setPremiumUI(local);
    }
}

// ==============================
// Tratamento para bloqueio 402/403
// ==============================
function isPremiumBlockedError(e) {
    const st = e?.status;
    // 402 Payment Required ou 403 Forbidden
    if (st === 402 || st === 403) return true;

    // fallback por mensagem
    const m = (e?.message || "").toLowerCase();
    return m.includes("premium") || m.includes("assin") || m.includes("pag");
}

function enforcePremiumFromError(e) {
    if (isPremiumBlockedError(e)) {
        setPremiumUI(false);
        if (paywall) paywall.hidden = false;
        setMsg("Função disponível apenas no Premium.", "error");
        return true;
    }
    return false;
}

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
    const filtro = (q?.value || "").toLowerCase().trim();

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
// Abrir conversa
// ==============================
async function abrirConversa(conversaId) {
    state.conversaId = conversaId;

    const c = state.conversas.find((x) => x.id === conversaId);
    if (!c) return;

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

    const foto = outro?.fotos?.find?.((f) => f.principal)?.url || outro?.fotoPrincipal || null;
    if (foto) {
        chatAvatar.src = foto;
        chatAvatar.style.display = "block";
        chatAvatarFallback.style.display = "none";
    } else {
        chatAvatar.removeAttribute("src");
        chatAvatar.style.display = "none";
        chatAvatarFallback.style.display = "grid";
        chatAvatarFallback.textContent = (nome || "DP").slice(0, 2).toUpperCase();
    }

    // aplica premium (trava/destrava)
    setPremiumUI(state.premiumAtivo);

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
    if (!state.premiumAtivo) {
        if (paywall) paywall.hidden = false;
        return;
    }

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
        if (enforcePremiumFromError(e)) return;
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
// Presentes
// ==============================
btnGift?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.premiumAtivo) {
        if (paywall) paywall.hidden = false;
        return;
    }

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
        if (enforcePremiumFromError(e)) return;
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
        if (enforcePremiumFromError(e)) return;
        alert("Erro ao enviar presente: " + e.message);
    }
}

// ==============================
// Minutos + Ligações (MVP)
// ==============================
async function atualizarSaldo() {
    try {
        const r = await apiFetch(API.saldoMinutos);
        if (minutosPill) minutosPill.textContent = `⏱️ Minutos: ${r.minutosDisponiveis ?? "-"}`;
    } catch {
        if (minutosPill) minutosPill.textContent = "⏱️ Minutos: -";
    }
}

btnCall?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.premiumAtivo) {
        if (paywall) paywall.hidden = false;
        return;
    }

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

        chatStatus.textContent = "Ligação em andamento";
        btnCall.textContent = "⛔";
    } catch (e) {
        if (enforcePremiumFromError(e)) return;
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
        if (enforcePremiumFromError(e)) return;
        alert("Erro ao finalizar ligação: " + e.message);
        chatStatus.textContent = "";
    } finally {
        btnCall.disabled = false;
    }
}

// ==============================
// Init
// ==============================
await checarPremium();
await carregarConversas();

// auto refresh se uma conversa estiver aberta
setInterval(() => {
    if (state.conversaId) carregarMensagens();
}, 4000);
