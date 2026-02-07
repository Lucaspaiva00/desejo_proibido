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
    state.custoChat = Number(custoCreditos || 0);
    state.saldoCreditos = Number(saldoCreditos || 0);

    if (unlockCost) unlockCost.textContent = `${state.custoChat} créditos`;
    if (saldoCreditosEl) saldoCreditosEl.textContent = `${state.saldoCreditos}`;
}

// ✅ Regra correta agora:
// - Pode enviar msg se (premiumAtivo) OU (chatLiberado)
// - Presente/ligação só se premiumAtivo
function applyChatLockUI() {
    const hasChat = !!state.conversaId;

    if (!hasChat) {
        hideCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;
        if (btnGift) btnGift.disabled = true;
        if (btnCall) btnCall.disabled = true;
        return;
    }

    // ✅ pode enviar msg se premium OU chatLiberado
    const podeMensagens = !!state.premiumAtivo || !!state.chatLiberado;

    if (!podeMensagens) {
        showCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;
    } else {
        hideCreditWall();
        if (texto) texto.disabled = false;
        if (btnEnviar) btnEnviar.disabled = false;
    }

    // ✅ presentes/ligação: liberados quando premiumAtivo (saldoCreditos > 0)
    const podePremiumAcoes = !!state.premiumAtivo;
    if (btnGift) btnGift.disabled = !podePremiumAcoes;
    if (btnCall) btnCall.disabled = !podePremiumAcoes;
}


// ==============================
// Premium UI (NÃO trava o chat inteiro!)
// ==============================
function setPremiumUI(isPremium, saldoCreditos = null) {
    state.premiumAtivo = !!isPremium;

    // se o backend mandar saldo, atualiza pill do creditwall também
    if (saldoCreditos !== null && saldoCreditos !== undefined) {
        state.saldoCreditos = Number(saldoCreditos || 0);
        if (saldoCreditosEl) saldoCreditosEl.textContent = `${state.saldoCreditos}`;
    }

    if (premiumBadge) {
        premiumBadge.textContent = isPremium ? "✅ Conta Premium Ativa" : "🔒 Conta Premium Inativa";
    }

    if (btnAssinarTopo) btnAssinarTopo.style.display = isPremium ? "none" : "inline-flex";

    // ✅ Paywall só aparece quando o usuário tentar usar recursos premium
    if (paywall) {
        paywall.hidden = true;
        paywall.style.display = "none";
    }

    applyChatLockUI();
}

function openCheckout() {
    // aqui você pode redirecionar para comprar créditos, pois na sua lógica créditos = premium efetivo
    const ret = encodeURIComponent(window.location.href);
    window.location.href = `comprar-creditos.html?return=${ret}`;
}

btnAssinar?.addEventListener("click", openCheckout);
btnAssinarTopo?.addEventListener("click", openCheckout);

btnEntendi?.addEventListener("click", () => {
    if (paywall) {
        paywall.hidden = true;
        paywall.style.display = "none";
    }
});

// ==============================
// API endpoints
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

    premiumStatus: "/premium/me", // deve devolver isPremium calculado + saldoCreditos
};

// ✅ Atualiza localStorage(usuario) quando o backend confirmar premium
function syncUsuarioPremium(isPremium, saldoCreditos = null) {
    try {
        const raw = localStorage.getItem("usuario");
        const u = raw ? JSON.parse(raw) : (state.usuario || {});
        if (!u) return;

        u.isPremium = !!isPremium;
        u.premiumAtivo = !!isPremium;
        u.premium = !!isPremium;

        if (saldoCreditos !== null && saldoCreditos !== undefined) {
            u.saldoCreditos = Number(saldoCreditos || 0);
        }

        localStorage.setItem("usuario", JSON.stringify(u));
        state.usuario = u;
    } catch { }
}

// ==============================
// Checar Premium (REFORÇADO)
// ==============================
async function checarPremium() {
    try {
        const r = await apiFetch(API.premiumStatus); // /premium/me

        const ativo = !!r?.isPremium;
        const saldo = Number(r?.saldoCreditos ?? 0);

        state.premiumAtivo = ativo;
        state.saldoCreditos = saldo;

        // badge premium
        if (premiumBadge) {
            premiumBadge.textContent = ativo ? "✅ Conta Premium Ativa" : "🔒 Conta Premium Inativa";
        }

        // botão topo (se quiser esconder quando premium)
        if (btnAssinarTopo) btnAssinarTopo.style.display = ativo ? "none" : "inline-flex";

        // ✅ "Minutos" vira créditos e mostra saldo
        if (minutosPill) minutosPill.textContent = `💰 Créditos: ${saldo}`;

        // ✅ também atualiza o saldo na creditwall
        if (saldoCreditosEl) saldoCreditosEl.textContent = `${saldo}`;

        // paywall (se existir) fica escondido por padrão
        if (paywall) {
            paywall.hidden = true;
            paywall.style.display = "none";
        }

        applyChatLockUI();
        return ativo;
    } catch (e) {
        state.premiumAtivo = false;

        if (premiumBadge) premiumBadge.textContent = "🔒 Conta Premium Inativa";
        if (btnAssinarTopo) btnAssinarTopo.style.display = "inline-flex";
        if (minutosPill) minutosPill.textContent = "💰 Créditos: -";

        applyChatLockUI();
        return false;
    }
}



// ==============================
// Tratamento para bloqueio 402/403
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
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
        setMsg("Função disponível apenas no Premium.", "error");
        return true;
    }
    return false;
}

// ✅ Detecta o bloqueio de chat por créditos
function isChatLockedError(e) {
    const st = e?.status;
    if (st !== 402) return false;
    const code = e?.data?.code;
    return code === "CHAT_LOCKED";
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
// ✅ Status do chat (créditos)
// ==============================
async function atualizarStatusChat() {
    if (!state.conversaId) {
        state.chatLiberado = false;
        setCreditWallInfo({ custoCreditos: 0, saldoCreditos: state.saldoCreditos || 0 });
        applyChatLockUI();
        return;
    }

    // ✅ Se premium, mensagens liberadas independentemente do unlock
    if (state.premiumAtivo) {
        state.chatLiberado = true;
        applyChatLockUI();
        return;
    }

    try {
        const r = await apiFetch(API.statusChat(state.conversaId));
        state.chatLiberado = !!r.chatLiberado;

        // statusChat já devolve saldo — usa ele
        setCreditWallInfo({ custoCreditos: r.custoCreditos, saldoCreditos: r.saldoCreditos });
        applyChatLockUI();
    } catch {
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
        setCreditWallInfo({ custoCreditos: state.custoChat, saldoCreditos: r.saldoCreditos });

        const idx = state.conversas.findIndex((c) => c.id === state.conversaId);
        if (idx >= 0) state.conversas[idx].chatLiberado = true;

        applyChatLockUI();
        renderLista();
        setMsg("Chat liberado ✅", "ok");
        setTimeout(() => setMsg(""), 1200);
    } catch (e) {
        alert(e?.message || "Erro ao liberar chat");
    } finally {
        btnLiberarChat.disabled = false;
        btnLiberarChat.innerHTML = `Liberar por <span id="unlockCost">${state.custoChat} créditos</span>`;
        const span = btnLiberarChat.querySelector("#unlockCost");
        if (span) span.textContent = `${state.custoChat} créditos`;
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

    renderLista();

    // ✅ RECHECA premium e status do chat
    await checarPremium();
    await atualizarSaldo();
    await atualizarStatusChat();
    await carregarMensagens(); // mantém chamada original
}

// ==============================
// Mensagens
// ==============================
// ✅✅✅ AJUSTE AQUI: agora tem { silent } e não pisca no polling
async function carregarMensagens({ silent = false } = {}) {
    if (!state.conversaId) return;

    try {
        if (!silent) chatStatus.textContent = "Carregando...";

        const data = await apiFetch(API.mensagensDaConversa(state.conversaId));

        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data?.mensagens && Array.isArray(data.mensagens)) {
            items = data.mensagens;
            if (typeof data.chatLiberado === "boolean") {
                state.chatLiberado = data.chatLiberado;
            }
        } else {
            items = (data?.data && Array.isArray(data.data)) ? data.data : [];
        }

        renderMensagens(items);

        if (!silent) chatStatus.textContent = "";

        await atualizarStatusChat();
    } catch (e) {
        if (!silent) {
            chatStatus.textContent = "Erro";
            msgs.innerHTML = `<div class="empty">Erro ao carregar mensagens: ${escapeHtml(e.message)}</div>`;
        }
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
            conteudo = `<div><b> ${escapeHtml(nome)}</b> <span class="dp-pill">${min} min</span></div>`;
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

    // ✅ pode enviar se premium OR chatLiberado
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
        if (isChatLockedError(e)) {
            await atualizarStatusChat();
            showCreditWall();
            setMsg("Chat bloqueado. Libere com créditos.", "error");
            return;
        }

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
// Presentes (Premium efetivo via créditos)
// ==============================
btnGift?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.premiumAtivo) {
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
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

        giftList.innerHTML = itens.map((p) => {
            const custo = Number(p.custoCreditos || 0);
            const saldo = Number(state.saldoCreditos || 0);
            const disabled = custo > saldo;

            return `
    <button class="dp-gift" data-id="${p.id}" ${disabled ? "disabled" : ""}>
      <div>
        <span class="name">${escapeHtml(p.nome)}</span>
        <span class="sub">
          Crédita ${Number(p.minutos || 0)} minuto(s) • Custa ${custo} crédito(s)
        </span>
      </div>
      <span class="dp-pill">💰 ${custo}</span>
    </button>
  `;
        }).join("");

        [...giftList.querySelectorAll("button[data-id]")].forEach((btn) => {
            btn.addEventListener("click", async () => {
                const presenteId = btn.getAttribute("data-id");
                if (btn.disabled) return;
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
        const r = await apiFetch(API.enviarPresente, {
            method: "POST",
            body: { conversaId: state.conversaId, presenteId },
        });

        // ✅ atualiza saldo imediatamente (sem esperar /carteira)
        if (typeof r?.saldoCreditos === "number") {
            state.saldoCreditos = r.saldoCreditos;
            if (minutosPill) minutosPill.textContent = `💰 Créditos: ${r.saldoCreditos}`;
            if (saldoCreditosEl) saldoCreditosEl.textContent = `${r.saldoCreditos}`;
        }

        closeGiftModal();
        await carregarMensagens();
    } catch (e) {
        if (e?.status === 402 && e?.data?.code === "SALDO_INSUFICIENTE") {
            alert("Saldo insuficiente pra enviar esse presente.");
            await atualizarSaldo();
            await carregarPresentes();
            return;
        }
        alert("Erro ao enviar presente: " + e.message);
    }
}


// ==============================
// Minutos + Ligações (Premium efetivo via créditos)
// ==============================
async function atualizarSaldo() {
    // 🔥 agora saldo é de créditos (wallet)
    try {
        const r = await apiFetch("/carteira"); // retorna { saldoCreditos }
        const saldo = Number(r?.saldoCreditos ?? 0);
        state.saldoCreditos = saldo;

        if (minutosPill) minutosPill.textContent = `💰 Créditos: ${saldo}`;
        if (saldoCreditosEl) saldoCreditosEl.textContent = `${saldo}`;

        // ✅ premium efetivo = saldo > 0
        state.premiumAtivo = saldo > 0;
        if (premiumBadge) {
            premiumBadge.textContent = state.premiumAtivo ? "✅ Conta Premium Ativa" : "🔒 Conta Premium Inativa";
        }

        applyChatLockUI();
    } catch {
        if (minutosPill) minutosPill.textContent = "💰 Créditos: -";
    }
}


btnCall?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.premiumAtivo) {
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
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

// ✅ quando voltar do Mercado Pago / trocar aba, revalida premium
document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
        await checarPremium();
        await atualizarSaldo();
        await atualizarStatusChat();
    }
});

// ✅ reforço: revalida premium a cada 10s
setInterval(async () => {
    await checarPremium();
}, 10000);

// ✅✅✅ AJUSTE AQUI: polling agora é silencioso (não pisca "Carregando...")
setInterval(() => {
    if (state.conversaId) carregarMensagens({ silent: true });
}, 4000);
