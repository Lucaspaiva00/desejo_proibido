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

// Paywall / Premium UI
const paywall = document.getElementById("paywall");
const premiumBadge = document.getElementById("premiumBadge");
const btnAssinar = document.getElementById("btnAssinar");
const btnEntendi = document.getElementById("btnEntendi");
const btnAssinarTopo = document.getElementById("btnAssinarTopo");
const chatPanel = document.querySelector(".panel.right.chat");

// ✅ Credit wall (liberar chat por créditos)
const creditwall = document.getElementById("creditwall");
const btnLiberarChat = document.getElementById("btnLiberarChat");
const btnComprarCreditos = document.getElementById("btnComprarCreditos");
const unlockCost = document.getElementById("unlockCost");
const saldoCreditosEl = document.getElementById("saldoCreditos");

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

// garante token na chave "token"
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

    // chat unlock
    chatLiberado: false,
    custoChat: 0,
    saldoCreditos: 0,

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
// ✅ CREDIT WALL helpers
// ==============================
function showCreditWall() {
    if (!creditwall) return;
    creditwall.classList.add("show");
    creditwall.setAttribute("aria-hidden", "false");
}

function hideCreditWall() {
    if (!creditwall) return;
    creditwall.classList.remove("show");
    creditwall.setAttribute("aria-hidden", "true");
}

function setCreditWallInfo({ custoCreditos, saldoCreditos }) {
    state.custoChat = Number(custoCreditos ?? 0);
    state.saldoCreditos = Number(saldoCreditos ?? 0);

    if (unlockCost) unlockCost.textContent = `${state.custoChat} créditos`;
    if (saldoCreditosEl) saldoCreditosEl.textContent = String(state.saldoCreditos);

    // ✅ se não tem saldo, desabilita o botão e deixa claro
    if (btnLiberarChat) {
        const insuficiente = state.saldoCreditos < state.custoChat;
        btnLiberarChat.disabled = insuficiente || state.custoChat <= 0 ? false : false; // mantém clicável se custo 0
        if (insuficiente) {
            btnLiberarChat.disabled = true;
            btnLiberarChat.textContent = "Saldo insuficiente";
        }
    }
}

function applyChatLockUI() {
    const hasChat = !!state.conversaId;

    // Premium libera tudo automaticamente
    if (state.premiumAtivo) {
        state.chatLiberado = true;
        hideCreditWall();
        if (texto) texto.disabled = !hasChat;
        if (btnEnviar) btnEnviar.disabled = !hasChat;
        if (btnGift) btnGift.disabled = !hasChat;
        if (btnCall) btnCall.disabled = !hasChat;
        return;
    }

    // sem conversa selecionada
    if (!hasChat) {
        hideCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;
        if (btnGift) btnGift.disabled = true;
        if (btnCall) btnCall.disabled = true;
        return;
    }

    // conversa selecionada, mas chat bloqueado
    if (!state.chatLiberado) {
        showCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;

        // presentes/ligação continuam premium-only
        if (btnGift) btnGift.disabled = true;
        if (btnCall) btnCall.disabled = true;
        return;
    }

    // chat liberado (por créditos)
    hideCreditWall();
    if (texto) texto.disabled = false;
    if (btnEnviar) btnEnviar.disabled = false;

    // presentes/ligação continuam premium-only
    if (btnGift) btnGift.disabled = true;
    if (btnCall) btnCall.disabled = true;
}

// ==============================
// Premium UI (mantido) - SEM chamada /premium/status
// ==============================
function setPremiumUI(isPremium) {
    state.premiumAtivo = !!isPremium;

    if (premiumBadge) {
        premiumBadge.textContent = isPremium
            ? "✅ Conta Premium Ativa"
            : "🔒 Conta Premium Inativa";
    }

    if (btnAssinarTopo) btnAssinarTopo.style.display = isPremium ? "none" : "inline-flex";
    if (paywall) paywall.hidden = isPremium;

    if (chatPanel) chatPanel.classList.toggle("locked", !isPremium);

    applyChatLockUI();
}

function openCheckout() {
    alert("Abrir checkout do Premium (implementar link real).");
}

btnAssinar?.addEventListener("click", openCheckout);
btnAssinarTopo?.addEventListener("click", openCheckout);
btnEntendi?.addEventListener("click", () => {
    if (paywall) paywall.hidden = true;
    setTimeout(() => {
        if (!state.premiumAtivo) paywall.hidden = false;
    }, 900);
});

// ✅ checa premium só por info local (SEM API)
async function checarPremium() {
    const local =
        !!state.usuario?.premiumAtivo ||
        !!state.usuario?.isPremium ||
        !!state.usuario?.premium;

    setPremiumUI(local);
}

// ==============================
// API endpoints (conforme seu backend)
// ==============================
const API = {
    listarConversas: "/conversas",
    mensagensDaConversa: (conversaId) => `/conversas/${conversaId}/mensagens`,
    statusChat: (conversaId) => `/conversas/${conversaId}/status`,
    liberarChat: (conversaId) => `/conversas/${conversaId}/liberar`,
    enviarMensagem: "/mensagens",

    listarPresentes: "/presentes",
    enviarPresente: "/presentes/enviar",

    saldoMinutos: "/ligacoes/saldo",
    iniciarLigacao: "/ligacoes/iniciar",
    finalizarLigacao: "/ligacoes/finalizar",
};

// ==============================
// Erros premium/chat
// ==============================
function isPremiumBlockedError(e) {
    const st = e?.status;
    if (st === 402 || st === 403) return true;
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
// Conversas
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

    lista.innerHTML = items
        .map((c) => {
            const nome = c.outro?.perfil?.nome || c.outroNome || c.outro?.email || "Usuário";
            const sub = c.ultimaMensagem?.texto || c.ultimaMensagem || "";
            const active = state.conversaId === c.id ? "active" : "";
            const lock = c.chatLiberado ? "" : " 🔒";

            return `
        <button class="item ${active}" data-id="${c.id}">
          <div class="row1">
            <div class="title">${escapeHtml(nome)}${lock}</div>
            <div class="time muted">${c.atualizadoEm ? new Date(c.atualizadoEm).toLocaleDateString() : ""}</div>
          </div>
          <div class="row2 muted">${escapeHtml(sub).slice(0, 60)}</div>
        </button>
      `;
        })
        .join("");

    [...lista.querySelectorAll("button[data-id]")].forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            abrirConversa(id);
        });
    });
}

q?.addEventListener("input", renderLista);

// ==============================
// Status chat (créditos)
// ==============================
async function atualizarStatusChat() {
    if (!state.conversaId) return;

    try {
        const r = await apiFetch(API.statusChat(state.conversaId));
        state.chatLiberado = !!r.chatLiberado;
        setCreditWallInfo({ custoCreditos: r.custoCreditos, saldoCreditos: r.saldoCreditos });
        applyChatLockUI();

        // ✅ controla botão liberar
        if (btnLiberarChat) {
            const insuficiente = Number(r.saldoCreditos ?? 0) < Number(r.custoCreditos ?? 0);
            if (insuficiente) {
                btnLiberarChat.disabled = true;
                btnLiberarChat.textContent = "Saldo insuficiente";
            } else {
                btnLiberarChat.disabled = false;
                btnLiberarChat.innerHTML = `Liberar por <span id="unlockCost">${Number(r.custoCreditos ?? 0)} créditos</span>`;
            }
        }
    } catch (e) {
        // se falhar, por segurança trava
        state.chatLiberado = false;
        applyChatLockUI();
    }
}

btnLiberarChat?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    try {
        btnLiberarChat.disabled = true;
        btnLiberarChat.textContent = "Liberando...";

        const r = await apiFetch(API.liberarChat(state.conversaId), { method: "POST" });

        state.chatLiberado = true;
        setCreditWallInfo({ custoCreditos: r.custoCreditos, saldoCreditos: r.saldoCreditos });

        const idx = state.conversas.findIndex((c) => c.id === state.conversaId);
        if (idx >= 0) state.conversas[idx].chatLiberado = true;

        applyChatLockUI();
        renderLista();
        setMsg("Chat liberado ✅", "ok");
        setTimeout(() => setMsg(""), 1200);
    } catch (e) {
        // ✅ se backend retornou 402, atualiza UI e manda comprar créditos
        if (e?.status === 402 && e?.data) {
            setCreditWallInfo({
                custoCreditos: e.data.custoCreditos,
                saldoCreditos: e.data.saldoCreditos,
            });
            showCreditWall();
            alert("Saldo insuficiente. Compre créditos para liberar o chat.");
            return;
        }

        alert(e?.message || "Erro ao liberar chat");
    } finally {
        // restaura botão se não estiver insuficiente
        await atualizarStatusChat();
    }
});

btnComprarCreditos?.addEventListener("click", () => {
    const ret = encodeURIComponent(window.location.href);
    window.location.href = `comprar-creditos.html?return=${ret}`;
});

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

    state.outroUsuarioId = c.outroUsuarioId || outro?.id || c.outroId || null;

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

    renderLista();

    await atualizarSaldo();
    await atualizarStatusChat();
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

        const items = Array.isArray(data)
            ? data
            : (data?.mensagens && Array.isArray(data.mensagens))
                ? data.mensagens
                : (data?.data && Array.isArray(data.data))
                    ? data.data
                    : [];

        renderMensagens(items);
        chatStatus.textContent = "";

        await atualizarStatusChat();
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

    msgs.innerHTML = items
        .map((m) => {
            const isMe = m.autorId === me;
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
        })
        .join("");

    msgs.scrollTop = msgs.scrollHeight;
}

async function enviarMensagem() {
    const t = (texto.value || "").trim();
    if (!t || !state.conversaId) return;

    if (!state.premiumAtivo && !state.chatLiberado) {
        showCreditWall();
        setMsg("Chat bloqueado. Libere com créditos.", "error");
        return;
    }

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
// Presentes (premium-only)
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

        giftList.innerHTML = itens
            .map(
                (p) => `
        <button class="dp-gift" data-id="${p.id}">
          <div>
            <span class="name">${escapeHtml(p.nome)}</span>
            <span class="sub">Crédita ${p.minutos} minuto(s)</span>
          </div>
          <span class="dp-pill">${p.minutos} min</span>
        </button>
      `
            )
            .join("");

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
// Minutos + Ligações (premium-only)
// ==============================
async function atualizarSaldo() {
    try {
        const r = await apiFetch(API.saldoMinutos);
        if (minutosPill) minutosPill.textContent = `⏱️ Minutos: ${r.minutosDisponiveis ?? "-"}`;
    } catch {
        if (minutosPill) minutosPill.textContent = "⏱️ Minutos: -";
    }
}

// ==============================
// Init
// ==============================
await checarPremium();
await carregarConversas();

// ✅ trava para não empilhar requisições no refresh
let refreshLock = false;

setInterval(async () => {
    if (!state.conversaId) return;
    if (refreshLock) return;

    refreshLock = true;
    try {
        await carregarMensagens();
    } finally {
        refreshLock = false;
    }
}, 4000);
