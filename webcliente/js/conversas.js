// public/js/conversas.js
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

// ✅ NOVO: botão comprar créditos no topo do chat
const btnComprarCreditosTopo = document.getElementById("btnComprarCreditosTopo");

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

// ✅ Video overlay (precisa existir no HTML)
const callOverlay = document.getElementById("callOverlay");
const callTitle = document.getElementById("callTitle");
const callSub = document.getElementById("callSub");
const btnCallClose = document.getElementById("btnCallClose");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnHangup = document.getElementById("btnHangup");
const btnMute = document.getElementById("btnMute");
const btnCam = document.getElementById("btnCam");

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

    // Video
    sessaoId: null,
    roomId: null,
    callActive: false,
    pc: null,
    localStream: null,
    micOn: true,
    camOn: true,
};

// se não achou nada, manda pro login
if (!state.usuario && !localStorage.getItem("token")) {
    alert("Sessão expirada. Faça login.");
    location.href = "login.html";
}

// ==============================
// Socket.IO
// ==============================
// ⚠️ precisa carregar socket.io client no HTML:
// <script src="/socket.io/socket.io.js"></script>
const token = localStorage.getItem("token") || "";

if (!window.io) {
    console.error("socket.io client não carregou. Verifique /socket.io/socket.io.js");
}

const socket = window.io({
    auth: { token },
    transports: ["websocket"],
});

socket.on("connect", () => {
    // ok
});

socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err?.message || err);
});

socket.on("wallet:update", (p) => {
    const saldo = Number(p?.saldoCreditos ?? 0);
    state.saldoCreditos = saldo;
    if (minutosPill) minutosPill.textContent = `💰 Créditos: ${saldo}`;
    if (saldoCreditosEl) saldoCreditosEl.textContent = `${saldo}`;
});

socket.on("call:incoming", async (p) => {
    // p: {sessaoId, roomId, conversaId, de:{id,nome}}
    try {
        const nome = p?.de?.nome || "Usuário";
        const ok = confirm(`📹 ${nome} está te ligando por vídeo. Aceitar?`);
        if (!ok) {
            await apiFetch(`/ligacoes/video/${p.sessaoId}/recusar`, { method: "POST" });
            return;
        }

        // aceita
        const r = await apiFetch(`/ligacoes/video/${p.sessaoId}/aceitar`, { method: "POST" });

        state.sessaoId = r.sessaoId;
        state.roomId = r.roomId;

        openCallOverlay(`📹 Chamada com ${nome}`, "Conectando…");
        await startMedia();
        await createPeerIfNeeded();

        socket.emit("joinRoom", { roomId: state.roomId });

        callSub.textContent = "Aguardando conexão…";
        state.callActive = true;

    } catch (e) {
        alert("Erro ao aceitar chamada: " + (e?.message || "erro"));
        await endCallLocal();
    }
});

socket.on("call:accepted", async (p) => {
    // caller recebe: pode começar offer
    if (!state.roomId || p.roomId !== state.roomId) return;
    callSub.textContent = "Aceita ✅ conectando…";
    try {
        await createOffer();
    } catch (e) {
        console.error("Erro createOffer:", e);
    }
});

socket.on("call:declined", async () => {
    alert("Chamada recusada.");
    await endCallLocal();
});

socket.on("call:ended", async (p) => {
    const motivo = p?.motivo || "FINALIZADA";
    if (motivo === "SALDO_INSUFICIENTE") {
        alert("Chamada encerrada: saldo insuficiente.");
    }
    await endCallLocal();
});

// WebRTC signaling
socket.on("call:offer", async ({ sdp, sessaoId }) => {
    try {
        if (sessaoId && state.sessaoId && sessaoId !== state.sessaoId) return;

        if (!state.pc) await createPeerIfNeeded();

        await state.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const ans = await state.pc.createAnswer();
        await state.pc.setLocalDescription(ans);

        socket.emit("call:answer", { roomId: state.roomId, sdp: ans, sessaoId: state.sessaoId });
    } catch (e) {
        console.error("Erro ao receber offer:", e);
    }
});

socket.on("call:answer", async ({ sdp, sessaoId }) => {
    try {
        if (!state.pc) return;
        if (sessaoId && state.sessaoId && sessaoId !== state.sessaoId) return;
        await state.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (e) {
        console.error("Erro ao receber answer:", e);
    }
});

socket.on("call:ice", async ({ candidate, sessaoId }) => {
    try {
        if (!state.pc) return;
        if (sessaoId && state.sessaoId && sessaoId !== state.sessaoId) return;
        await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.warn("Falha addIceCandidate (normal às vezes):", e?.message || e);
    }
});

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

    const podePremiumAcoes = !!state.premiumAtivo;
    if (btnGift) btnGift.disabled = !podePremiumAcoes;
    if (btnCall) btnCall.disabled = !podePremiumAcoes;
}

// ==============================
// Premium UI
// ==============================
function openCheckout() {
    const ret = encodeURIComponent(window.location.href);
    window.location.href = `comprar-creditos.html?return=${ret}`;
}

btnAssinar?.addEventListener("click", openCheckout);
btnAssinarTopo?.addEventListener("click", openCheckout);
btnComprarCreditos?.addEventListener("click", openCheckout);
btnComprarCreditosTopo?.addEventListener("click", openCheckout);

btnEntendi?.addEventListener("click", () => {
    if (paywall) {
        paywall.hidden = true;
        paywall.style.display = "none";
    }
});

const API = {
    listarConversas: "/conversas",
    mensagensDaConversa: (conversaId) => `/conversas/${conversaId}/mensagens`,
    statusChat: (conversaId) => `/conversas/${conversaId}/status`,
    liberarChat: (conversaId) => `/conversas/${conversaId}/liberar`,
    enviarMensagem: "/mensagens",

    listarPresentes: "/presentes",
    enviarPresente: "/presentes/enviar",

    premiumStatus: "/premium/me",
};

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

async function checarPremium() {
    try {
        const r = await apiFetch(API.premiumStatus);
        const ativo = !!r?.isPremium;
        const saldo = Number(r?.saldoCreditos ?? 0);

        state.premiumAtivo = ativo;
        state.saldoCreditos = saldo;

        if (premiumBadge) premiumBadge.textContent = ativo ? "✅ Conta Premium Ativa" : "🔒 Conta Premium Inativa";
        if (btnAssinarTopo) btnAssinarTopo.style.display = ativo ? "none" : "inline-flex";

        if (minutosPill) minutosPill.textContent = `💰 Créditos: ${saldo}`;
        if (saldoCreditosEl) saldoCreditosEl.textContent = `${saldo}`;

        if (paywall) {
            paywall.hidden = true;
            paywall.style.display = "none";
        }

        syncUsuarioPremium(ativo, saldo);
        applyChatLockUI();
        return ativo;
    } catch {
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
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
        setMsg("Função disponível apenas no Premium.", "error");
        return true;
    }
    return false;
}

function isChatLockedError(e) {
    const st = e?.status;
    if (st !== 402) return false;
    const code = e?.data?.code;
    return code === "CHAT_LOCKED";
}

function isContatoBloqueadoError(e) {
    const st = e?.status;
    if (st !== 422) return false;
    return e?.data?.code === "CONTATO_BLOQUEADO";
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

    if (state.premiumAtivo) {
        state.chatLiberado = true;
        applyChatLockUI();
        return;
    }

    try {
        const r = await apiFetch(API.statusChat(state.conversaId));
        state.chatLiberado = !!r.chatLiberado;
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

// ==============================
// Abrir conversa
// ==============================
async function abrirConversa(conversaId) {
    state.conversaId = conversaId;

    const c = state.conversas.find((x) => x.id === conversaId);
    if (!c) return;

    const outro = c.outro || null;
    const nome = outro?.perfil?.nome || c.outroNome || outro?.email || "Conversa";
    const sub = outro?.email ? outro.email : "";

    state.outroUsuarioId = c.outroUsuarioId || outro?.id || null;

    chatNome.textContent = nome;
    chatSub.textContent = sub;

    const foto = outro?.fotos?.find?.((f) => f.principal)?.url || null;
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

    await checarPremium();
    await atualizarStatusChat();
    await carregarMensagens();
}

// ==============================
// Mensagens
// ==============================
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
            conteudo = `<div><b> ${escapeHtml(nome)}</b> </div>`;
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
        if (isContatoBloqueadoError(e)) {
            setMsg("Por segurança, não é permitido enviar WhatsApp, Instagram, links ou e-mail no chat.", "error");
            return;
        }

        if (isChatLockedError(e)) {
            await atualizarStatusChat();
            showCreditWall();
            setMsg("Chat bloqueado. Libere com créditos.", "error");
            return;
        }

        if (enforcePremiumFromError(e)) return;

        alert("Erro ao enviar: " + (e?.message || "Erro desconhecido"));
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
            return;
        }
        alert("Erro ao enviar presente: " + e.message);
    }
}

// ==============================
// Video Call UI
// ==============================
function openCallOverlay(title, sub) {
    if (!callOverlay) return;
    callOverlay.classList.add("show");
    callOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    if (callTitle) callTitle.textContent = title || "📹 Videochamada";
    if (callSub) callSub.textContent = sub || "Conectando…";
}

function closeCallOverlay() {
    if (!callOverlay) return;
    callOverlay.classList.remove("show");
    callOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
}

btnCallClose?.addEventListener("click", async () => {
    await hangup();
});

btnHangup?.addEventListener("click", async () => {
    await hangup();
});

btnMute?.addEventListener("click", () => {
    state.micOn = !state.micOn;
    if (state.localStream) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = state.micOn);
    }
    btnMute.textContent = state.micOn ? "🎙️ Mudo" : "🔇 Sem mic";
});

btnCam?.addEventListener("click", () => {
    state.camOn = !state.camOn;
    if (state.localStream) {
        state.localStream.getVideoTracks().forEach(t => t.enabled = state.camOn);
    }
    btnCam.textContent = state.camOn ? "📷 Câmera" : "🚫 Sem cam";
});

async function startMedia() {
    if (state.localStream) return;

    state.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });

    if (localVideo) {
        localVideo.srcObject = state.localStream;
        localVideo.muted = true; // evita eco local
        localVideo.playsInline = true;
        await localVideo.play?.().catch(() => { });
    }
}

function getIceServers() {
    // ✅ usando TURN do seu servidor (coturn)
    // você pode trocar user/pass depois
    const turn = {
        urls: [
            "turn:desejoproibido.app:3478?transport=udp",
            "turn:desejoproibido.app:3478?transport=tcp",
        ],
        username: "dpturn",
        credential: "dpturn123",
    };

    const stun = { urls: "stun:stun.l.google.com:19302" };

    return [stun, turn];
}

async function createPeerIfNeeded() {
    if (state.pc) return;

    const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
    });

    state.pc = pc;

    // tracks locais
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
            pc.addTrack(track, state.localStream);
        });
    }

    // ✅ MAIS ESTÁVEL: usa o stream que vem do ontrack
    pc.ontrack = (event) => {
        const stream = event.streams && event.streams[0] ? event.streams[0] : null;
        if (stream && remoteVideo) {
            remoteVideo.srcObject = stream;
            remoteVideo.playsInline = true;
            remoteVideo.muted = false;
            remoteVideo.play?.().catch(() => { });
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("call:ice", {
                roomId: state.roomId,
                candidate: event.candidate,
                sessaoId: state.sessaoId,
            });
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        console.log("PC connectionState:", st);

        if (st === "connected") callSub.textContent = "Conectado ✅";
        if (st === "failed") callSub.textContent = "Falhou ❌ (TURN resolve isso)";
        if (st === "disconnected") callSub.textContent = "Desconectado…";
    };
}

async function createOffer() {
    if (!state.pc) await createPeerIfNeeded();

    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);

    socket.emit("call:offer", {
        roomId: state.roomId,
        sdp: offer,
        sessaoId: state.sessaoId,
    });
}

async function endCallLocal() {
    try {
        state.callActive = false;

        if (state.pc) {
            try { state.pc.ontrack = null; } catch { }
            try { state.pc.onicecandidate = null; } catch { }
            try { state.pc.close(); } catch { }
        }
        state.pc = null;

        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
        }
        state.localStream = null;

        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        state.sessaoId = null;
        state.roomId = null;

        closeCallOverlay();

        btnCall.textContent = "📞";
        chatStatus.textContent = "";
    } catch { }
}

async function hangup() {
    try {
        if (state.sessaoId) {
            socket.emit("call:hangup", { sessaoId: state.sessaoId });
            try { await apiFetch(`/ligacoes/video/${state.sessaoId}/finalizar`, { method: "POST" }); } catch { }
        }
    } finally {
        await endCallLocal();
    }
}

// ==============================
// Video Call - botão
// ==============================
btnCall?.addEventListener("click", async () => {
    if (!state.conversaId) return;

    if (!state.premiumAtivo) {
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
        return;
    }

    if (state.sessaoId) {
        await hangup();
        return;
    }

    try {
        btnCall.disabled = true;
        chatStatus.textContent = "Iniciando chamada…";

        const r = await apiFetch(`/ligacoes/video/iniciar`, {
            method: "POST",
            body: { conversaId: state.conversaId },
        });

        state.sessaoId = r.sessaoId;
        state.roomId = r.roomId;

        openCallOverlay("📹 Videochamada", "Chamando…");
        await startMedia();
        await createPeerIfNeeded();

        socket.emit("joinRoom", { roomId: state.roomId });

        state.callActive = true;

        btnCall.textContent = "⛔";
        chatStatus.textContent = "Chamando…";

    } catch (e) {
        if (isChatLockedError(e)) {
            await atualizarStatusChat();
            showCreditWall();
            setMsg("Libere o chat com créditos para ligar.", "error");
            return;
        }

        if (enforcePremiumFromError(e)) return;

        if (e?.status === 402 && e?.data?.code === "SALDO_INSUFICIENTE") {
            alert("Saldo insuficiente para iniciar chamada.");
            return;
        }

        alert("Erro ao iniciar chamada: " + (e?.message || "erro"));
    } finally {
        btnCall.disabled = false;
        chatStatus.textContent = "";
    }
});

// ==============================
// Init
// ==============================
await checarPremium();
await carregarConversas();

document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
        await checarPremium();
        await atualizarStatusChat();
    }
});

setInterval(async () => {
    await checarPremium();
}, 10000);

setInterval(() => {
    if (state.conversaId) carregarMensagens({ silent: true });
}, 4000);
