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
const composer = document.getElementById("composer");

// ✅ Mídia
const btnFoto = document.getElementById("btnFoto");
const btnAudio = document.getElementById("btnAudio");
const inputFoto = document.getElementById("inputFoto");
const inputAudio = document.getElementById("inputAudio");

const btnGift = document.getElementById("btnGift");
const btnCall = document.getElementById("btnCall");
const minutosPill = document.getElementById("minutosPill");

// botão comprar créditos no topo
const btnComprarCreditosTopo = document.getElementById("btnComprarCreditosTopo");

// Paywall / Premium UI
const paywall = document.getElementById("paywall");
const premiumBadge = document.getElementById("premiumBadge");
const btnAssinar = document.getElementById("btnAssinar");
const btnEntendi = document.getElementById("btnEntendi");
const btnAssinarTopo = document.getElementById("btnAssinarTopo");

// Credit wall
const creditwall = document.getElementById("creditwall");
const btnLiberarChat = document.getElementById("btnLiberarChat");
const btnComprarCreditos = document.getElementById("btnComprarCreditos");
const unlockCost = document.getElementById("unlockCost");
const saldoCreditosEl = document.getElementById("saldoCreditos");

// Modal presentes
const giftOverlay = document.getElementById("giftOverlay");
const giftClose = document.getElementById("giftClose");
const giftList = document.getElementById("giftList");

// Quick gifts
const quickGiftsBar = document.getElementById("quickGiftsBar");

// Video overlay
const callOverlay = document.getElementById("callOverlay");
const callTitle = document.getElementById("callTitle");
const callSub = document.getElementById("callSub");
const btnCallClose = document.getElementById("btnCallClose");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnHangup = document.getElementById("btnHangup");
const btnMute = document.getElementById("btnMute");
const btnCam = document.getElementById("btnCam");

const imageViewerOverlay = document.getElementById("imageViewerOverlay");
const imageViewerClose = document.getElementById("imageViewerClose");
const imageViewerImg = document.getElementById("imageViewerImg");
const chatPanel = document.getElementById("chatPanel");
const screenGuard = document.getElementById("screenGuard");
const btnCancelarAudio = document.getElementById("btnCancelarAudio");

// NOVA UI DE GRAVAÇÃO
const audioRecorderBar = document.getElementById("audioRecorderBar");
const audioRecorderTime = document.getElementById("audioRecorderTime");
const audioRecorderSlide = document.getElementById("audioRecorderSlide");
const audioRecorderHint = document.getElementById("audioRecorderHint");


function bindAcoesChat() {
    const btnBloquear = document.getElementById("btnBloquear");
    const btnDenunciar = document.getElementById("btnDenunciar");

    if (btnBloquear) {
        btnBloquear.onclick = async () => {
            const c = state.conversas.find(x => x.id === state.conversaId);
            const outro = c?.outro;

            if (!outro?.id) return;

            if (!confirm("Deseja bloquear este usuário?")) return;

            try {
                await apiFetch(`/bloqueios/${outro.id}`, {
                    method: "POST"
                });

                alert("Usuário bloqueado");

                state.conversas = state.conversas.filter(x => x.id !== c.id);
                state.conversaId = null;
                state.outroUsuarioId = null;

                renderLista();

                if (msgs) {
                    msgs.innerHTML = `<div class="empty">Escolha uma conversa à esquerda para iniciar uma interação privada.</div>`;
                }

                if (chatNome) chatNome.textContent = "Selecione uma conversa";
                if (chatSub) chatSub.textContent = "";
                if (chatStatus) chatStatus.textContent = "";

                if (chatAvatar) {
                    chatAvatar.removeAttribute("src");
                    chatAvatar.style.display = "none";
                }

                if (chatAvatarFallback) {
                    chatAvatarFallback.style.display = "grid";
                    chatAvatarFallback.textContent = "DP";
                }

                const old = document.getElementById("chatActions");
                if (old) old.remove();

                applyChatLockUI();
            } catch (e) {
                console.error(e);
                alert("Erro ao bloquear");
            }
        };
    }

    if (btnDenunciar) {
        btnDenunciar.onclick = async () => {
            const c = state.conversas.find(x => x.id === state.conversaId);
            const outro = c?.outro;

            if (!outro?.id) return;

            const motivo = prompt("Digite o motivo da denúncia:");
            if (!motivo || !motivo.trim()) return;

            try {
                await apiFetch(`/denuncias`, {
                    method: "POST",
                    body: {
                        denunciadoId: outro.id,
                        motivo: motivo.trim()
                    }
                });

                alert("Denúncia enviada");
            } catch (e) {
                console.error(e);
                alert("Erro ao denunciar");
            }
        };
    }
}

// function abrirChatMobile() {
//     if (window.innerWidth <= 980) {
//         document.querySelector(".panel.left").style.display = "none";
//         document.querySelector(".panel.right.chat").style.display = "flex";
//     }
// }

// ==============================
// Scroll helpers
// ==============================
function isNearBottom(el, threshold = 140) {
    if (!el) return true;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return distance <= threshold;
}
function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
}

// ==============================
// Auth robusto
// ==============================
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

const state = {
    usuario: auth.usuario,
    premiumAtivo: false,

    conversaId: null,
    outroUsuarioId: null,
    conversas: [],
    presentesCache: null,

    chatLiberado: false,
    custoChat: 0,
    saldoCreditos: 0,

    // Cache visual do chat
    lastMessagesHash: null,
    isLoadingMessages: false,

    // Video
    sessaoId: null,
    roomId: null,
    callActive: false,

    pc: null,
    localStream: null,

    micOn: true,
    camOn: true,

    // READY handshake
    calleeReady: false,
    callerOfferSent: false,
    offerRetryTimer: null,
};

// se não achou nada, manda pro login
if (!state.usuario && !localStorage.getItem("token")) {
    alert("Sessão expirada. Faça login.");
    location.href = "login.html";
}

// ==============================
// ✅ Socket.IO
// ==============================
const token = localStorage.getItem("token") || "";

const socket = window.io({
    path: "/api/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
});

socket.on("connect", () => {
    console.log("[socket] conectado", socket.id);
});

socket.on("connect_error", (err) => {
    console.error("[socket] connect_error:", err?.message || err);
});

socket.onAny((event, ...args) => {
    if (String(event).startsWith("call:")) console.log("[socket event]", event, args?.[0]);
});

socket.on("wallet:update", (p) => {
    const saldo = Number(p?.saldoCreditos ?? 0);
    state.saldoCreditos = saldo;
    if (minutosPill) minutosPill.textContent = `💰 Créditos: ${saldo}`;
    if (saldoCreditosEl) saldoCreditosEl.textContent = `${saldo}`;
});

// READY
socket.on("call:ready", async ({ sessaoId }) => {
    if (!state.sessaoId || String(sessaoId) !== String(state.sessaoId)) return;

    state.calleeReady = true;
    if (callSub) callSub.textContent = "Conectando…";

    try {
        await ensurePeerAndMedia();
        await createOfferOnce();
        scheduleOfferRetry();
    } catch (e) {
        console.error("Erro call:ready -> createOffer:", e);
    }
});

socket.on("call:incoming", async (p) => {
    try {
        const nome = p?.de?.nome || "Usuário";
        const ok = confirm(`📹 ${nome} está te ligando por vídeo. Aceitar?`);
        if (!ok) {
            await apiFetch(`/ligacoes/video/${p.sessaoId}/recusar`, { method: "POST" });
            return;
        }

        const r = await apiFetch(`/ligacoes/video/${p.sessaoId}/aceitar`, { method: "POST" });

        state.sessaoId = r.sessaoId;
        state.roomId = r.roomId;

        state.calleeReady = true;
        state.callerOfferSent = false;

        openCallOverlay(`📹 Chamada com ${nome}`, "Entrando na sala…");

        await ensurePeerAndMedia();
        joinRoomNow();

        socket.emit("call:ready", { roomId: state.roomId, sessaoId: state.sessaoId });

        if (callSub) callSub.textContent = "Aguardando conexão…";
        state.callActive = true;
    } catch (e) {
        alert("Erro ao aceitar chamada: " + (e?.message || "erro"));
        await endCallLocal();
    }
});

socket.on("call:accepted", async (p) => {
    if (!p?.roomId) return;
    if (!state.roomId || p.roomId !== state.roomId) return;

    if (callSub) callSub.textContent = "Aceita ✅ aguardando entrada do outro…";
    state.callActive = true;

    setTimeout(async () => {
        if (!state.calleeReady && state.sessaoId) {
            console.warn("READY não chegou, tentando offer por fallback…");
            try {
                await ensurePeerAndMedia();
                await createOfferOnce();
                scheduleOfferRetry();
            } catch { }
        }
    }, 2000);
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

// signaling
socket.on("call:offer", async ({ sdp, sessaoId }) => {
    try {
        if (sessaoId && state.sessaoId && sessaoId !== state.sessaoId) return;

        await ensurePeerAndMedia();

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
        console.warn("Falha addIceCandidate (às vezes é normal):", e?.message || e);
    }
});

// ==============================
// Helpers UI
// ==============================
function setMsg(text, type = "muted") {
    if (!msg) return;
    msg.className = `msgline ${type}`;
    msg.textContent = text || "";
}

function showScreenGuard(mode = "blur") {
    if (!chatPanel) return;

    chatPanel.classList.add("chatProtected");

    if (mode === "hard") {
        chatPanel.classList.remove("protect-blur");
        chatPanel.classList.add("protect-hard");
    } else {
        chatPanel.classList.remove("protect-hard");
        chatPanel.classList.add("protect-blur");
    }

    if (screenGuard) {
        screenGuard.classList.add("show");
        screenGuard.setAttribute("aria-hidden", "false");
    }
}

function hideScreenGuard() {
    if (!chatPanel) return;

    chatPanel.classList.remove("protect-blur");
    chatPanel.classList.remove("protect-hard");
    chatPanel.classList.add("chatProtected");

    if (screenGuard) {
        screenGuard.classList.remove("show");
        screenGuard.setAttribute("aria-hidden", "true");
    }
}

function enableChatProtection() {
    if (!chatPanel) return;

    chatPanel.classList.add("chatProtected");

    // bloqueia menu de contexto
    document.addEventListener("contextmenu", (e) => {
        const insideChat = e.target?.closest?.("#chatPanel");
        const insideViewer = e.target?.closest?.("#imageViewerOverlay");
        if (insideChat || insideViewer) {
            e.preventDefault();
        }
    });

    // bloqueia arrastar imagem
    document.addEventListener("dragstart", (e) => {
        const media = e.target?.closest?.("#chatPanel img, #chatPanel video, #imageViewerImg");
        if (media) e.preventDefault();
    });

    // bloqueia seleção dentro do chat
    document.addEventListener("selectstart", (e) => {
        const insideChat = e.target?.closest?.("#chatPanel");
        if (insideChat) e.preventDefault();
    });

    // atalhos comuns
    document.addEventListener("keydown", (e) => {
        const key = String(e.key || "").toLowerCase();

        const blocked =
            key === "printscreen" ||
            (e.ctrlKey && key === "p") ||
            (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
            (e.key === "F12");

        if (blocked) {
            e.preventDefault();
            e.stopPropagation();
            showScreenGuard("hard");

            setTimeout(() => {
                hideScreenGuard();
            }, 1800);
        }
    });

    // quando perder foco, oculta temporariamente
    window.addEventListener("blur", () => {
        showScreenGuard("blur");
    });

    window.addEventListener("focus", () => {
        hideScreenGuard();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            showScreenGuard("hard");
        } else {
            hideScreenGuard();
        }
    });

    // tentativa de print screen em alguns navegadores/sistemas
    document.addEventListener("keyup", (e) => {
        const key = String(e.key || "").toLowerCase();
        if (key === "printscreen") {
            showScreenGuard("hard");
            setTimeout(() => {
                hideScreenGuard();
            }, 1800);
        }
    });
}

function escapeHtml(s) {
    return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function garantirAcoesChat() {
    let header = document.querySelector(".dp-userRight");

    if (!header) return;

    const old = document.getElementById("chatActions");
    if (old) old.remove();

    const div = document.createElement("div");
    div.id = "chatActions";
    div.style.display = "flex";
    div.style.gap = "8px";
    div.style.marginTop = "8px";
    div.style.justifyContent = "flex-end";
    div.style.flexWrap = "wrap";

    div.innerHTML = `
        <button id="btnBloquear" type="button" class="dp-actionBtn">🚫 <span class="lbl">Bloquear</span></button>
        <button id="btnDenunciar" type="button" class="dp-actionBtn">⚠️ <span class="lbl">Denunciar</span></button>
    `;

    header.appendChild(div);

    bindAcoesChat();
}

function splitEmojiAndText(nome) {
    const chars = Array.from(String(nome || "").trim());
    const emoji = chars.shift() || "🎁";
    const text = chars.join("").trim();
    return { emoji, text };
}

function normalizarTexto(v) {
    return String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function buildMessagesHash(items) {
    if (!Array.isArray(items) || !items.length) return "empty";

    const last = items[items.length - 1];
    const prev = items.length > 1 ? items[items.length - 2] : null;

    return JSON.stringify({
        total: items.length,
        lastId: last?.id || "",
        lastTipo: last?.tipo || "",
        lastTexto: last?.texto || last?.textoExibido || "",
        lastCriadoEm: last?.criadoEm || "",
        prevId: prev?.id || "",
    });
}

// presentes modal
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

// CREDIT WALL
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

function applyChatLockUI() {
    const hasChat = !!state.conversaId;

    if (!hasChat) {
        hideCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;

        if (btnFoto) btnFoto.disabled = true;
        if (btnAudio) btnAudio.disabled = true;

        if (btnGift) btnGift.disabled = true;
        if (btnCall) btnCall.disabled = true;

        btnGift?.classList.remove("lockedAction");
        btnCall?.classList.remove("lockedAction");
        return;
    }

    const podeEnviar = !!state.premiumAtivo || !!state.chatLiberado;

    if (!podeEnviar) {
        showCreditWall();
        if (texto) texto.disabled = true;
        if (btnEnviar) btnEnviar.disabled = true;

        if (btnFoto) btnFoto.disabled = true;
        if (btnAudio) btnAudio.disabled = true;
    } else {
        hideCreditWall();
        if (texto) texto.disabled = false;
        if (btnEnviar) btnEnviar.disabled = false;

        if (btnFoto) btnFoto.disabled = false;
        if (btnAudio) btnAudio.disabled = false;
    }

    if (btnGift) btnGift.disabled = false;
    if (btnCall) btnCall.disabled = false;

    btnGift?.classList.toggle("lockedAction", !state.premiumAtivo);
    btnCall?.classList.toggle("lockedAction", !state.premiumAtivo);
}

// Premium UI
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
    traduzirMensagem: (mensagemId, lang) => `/mensagens/${mensagemId}/traduzir?lang=${encodeURIComponent(lang)}`,
};

function syncUsuarioPremium(isPremium, saldoCreditos = null) {
    try {
        const raw = localStorage.getItem("usuario");
        const fromStorage = raw ? JSON.parse(raw) : null;
        const base = state.usuario || {};
        const u = { ...(fromStorage || {}), ...(base || {}) };

        if (!u.id && base.id) u.id = base.id;
        if (!u.token && base.token) u.token = base.token;

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

// erros
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
    if (st !== 400) return false;
    return e?.data?.code === "CONTATO_BLOQUEADO";
}

// Conversas
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
        if (lista) lista.innerHTML = `<div class="empty">Nenhuma conversa.</div>`;
        return;
    }

    lista.innerHTML = items.map((c) => {
        const nome = c.outro?.perfil?.nome || c.outroNome || c.outro?.email || "Usuário";
        const sub =
            c.ultimaMensagem?.textoExibido ||
            c.ultimaMensagem?.texto ||
            c.ultimaMensagem ||
            "";
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

// Status chat
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



// Abrir conversa
async function abrirConversa(conversaId) {
    state.conversaId = conversaId;
    state.lastMessagesHash = null;

    const c = state.conversas.find((x) => x.id === conversaId);
    if (!c) return;

    const outro = c.outro || null;
    const nome = outro?.perfil?.nome || c.outroNome || outro?.email || "Conversa";
    const cidade = outro?.cidade || outro?.perfil?.cidade || "";
    const estado = outro?.estado || outro?.perfil?.estado || outro?.perfil?.uf || "";

    const localizacao = [cidade, estado].filter(Boolean).join(" - ");

    state.outroUsuarioId = c.outroUsuarioId || outro?.id || null;

    chatNome.textContent = nome;
    chatSub.textContent = localizacao || "";

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
    garantirAcoesChat();
    await checarPremium();
    await atualizarStatusChat();
    await carregarMensagens({ forceRender: true });

}

// Mensagens
async function carregarMensagens({ silent = false, forceRender = false } = {}) {
    if (!state.conversaId || state.isLoadingMessages) return;

    state.isLoadingMessages = true;

    try {
        if (!silent) chatStatus.textContent = "";

        const shouldStick = isNearBottom(msgs);
        const data = await apiFetch(API.mensagensDaConversa(state.conversaId));

        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data?.mensagens && Array.isArray(data.mensagens)) {
            items = data.mensagens;
            if (typeof data.chatLiberado === "boolean") state.chatLiberado = data.chatLiberado;
        } else {
            items = (data?.data && Array.isArray(data.data)) ? data.data : [];
        }

        const newHash = buildMessagesHash(items);
        const changed = forceRender || newHash !== state.lastMessagesHash;

        if (changed) {
            renderMensagens(items, { stickToBottom: shouldStick });
            state.lastMessagesHash = newHash;
        }

        if (!silent) chatStatus.textContent = "";
        await atualizarStatusChat();
    } catch (e) {
        if (!silent) {
            chatStatus.textContent = "";
            msgs.innerHTML = `<div class="empty">Erro ao carregar mensagens: ${escapeHtml(e.message)}</div>`;
        }
    } finally {
        state.isLoadingMessages = false;
    }
}

async function unlockMedia(mensagemId) {
    try {
        const r = await apiFetch(`/mensagens/${mensagemId}/desbloquear`, { method: "POST" });

        if (typeof r?.saldoCreditos === "number") {
            state.saldoCreditos = r.saldoCreditos;

            if (minutosPill) minutosPill.textContent = `💰 Créditos: ${r.saldoCreditos}`;
            if (saldoCreditosEl) saldoCreditosEl.textContent = `${r.saldoCreditos}`;
        }

        await carregarMensagens({ forceRender: true });
    } catch (e) {
        if (e?.status === 402) {
            alert("Saldo insuficiente para desbloquear.");
            return;
        }
        alert("Erro ao desbloquear mídia");
    }
}

// 🔥 deixar função global para o onclick
window.unlockMedia = unlockMedia;

function renderMensagens(items, { stickToBottom = true } = {}) {
    if (!items?.length) {
        msgs.innerHTML = `<div class="empty">Sem mensagens ainda.</div>`;
        return;
    }

    const me = state.usuario?.id;

    const html = items.map((m) => {
        const isMe = (String(m.autorId) === String(me));
        const tipo = m.tipo || "TEXTO";
        const dt = m.criadoEm ? new Date(m.criadoEm).toLocaleString() : "";
        const meta = m.metaJson || {};
        const foiApagada = !!m.foiApagada;

        let extraClass = "";
        if (tipo === "SISTEMA") extraClass = "system";
        if (tipo === "PRESENTE") extraClass = "gift";

        let conteudo = "";

        if (foiApagada) {
            conteudo = `<div class="msgDeletedText">🚫 Mensagem apagada</div>`;
        } else if (m.tipo === "FOTO") {
            const imgSrc = m.mediaUrl || m.thumbUrl || "";

            conteudo = `
                <div class="bubble foto ${m.locked ? "locked" : ""}" 
                    data-id="${m.id}"
                    ${m.locked ? `onclick="unlockMedia('${m.id}')"` : ""}>
                    <img
                        src="${imgSrc}"
                        ${!m.locked && m.mediaUrl ? `class="msgPhotoOpen" data-full="${m.mediaUrl}"` : ""}
                        alt="Foto enviada no chat"
                    />
                    ${m.locked ? `
                        <div class="media-lock">
                            🔒 Desbloquear por ${m.custoMoedas || 10} créditos
                        </div>
                    ` : ""}
                </div>
            `;
        } else if (tipo === "AUDIO") {
            conteudo = `
                <div class="audioBox" data-mid="${m.id}">
                    <div class="audioLoading">🎙️ Carregando áudio...</div>
                </div>
            `;

            setTimeout(async () => {
                try {
                    const box = document.querySelector(`[data-mid="${m.id}"]`);
                    if (!box) return;

                    const r = await apiFetch(`/mensagens/${m.id}/midia`);

                    if (r.locked) {
                        box.innerHTML = `
                            <div class="mediaLocked audioLocked" data-mid="${m.id}">
                                🎙️ Áudio bloqueado
                                <div class="muted">
                                    Toque para desbloquear por ${r.custoMoedas} créditos
                                </div>
                            </div>
                        `;
                    } else {
                        box.innerHTML = `
                            <audio controls preload="metadata" src="${r.audioUrl}"></audio>
                        `;
                    }
                } catch (e) {
                    const box = document.querySelector(`[data-mid="${m.id}"]`);
                    if (!box) return;

                    if (e?.status === 410) {
                        box.innerHTML = `<div class="msgDeletedText">🚫 Mensagem apagada</div>`;
                        return;
                    }

                    console.error("Erro carregando áudio:", e);
                }
            }, 50);
        } else if (tipo === "PRESENTE") {
            const img = meta.imagemUrl || "/assets/presentes/presente.png";
            const nome = meta.nome || "Presente";

            conteudo = `
                <div class="giftBig">
                    <img class="giftImg" src="${img}" alt="${escapeHtml(nome)}">
                </div>
            `;
        } else {
            const textToShow = m.textoExibido ?? m.texto ?? "";
            conteudo = `<div>${escapeHtml(textToShow)}</div>`;
        }

        const actions = isMe && !foiApagada ? `
            <div class="msgActions">
                <button class="btnMsgDelete" onclick="apagarMensagem('${m.id}')">Apagar</button>
            </div>
        ` : "";

        return `
            <div class="msgRow ${isMe ? "me" : "other"} ${foiApagada ? "deleted" : ""}">
                <div class="bubble ${extraClass} ${foiApagada ? "deletedBubble" : ""}">
                    ${conteudo}
                    <div class="meta muted">${escapeHtml(dt)}</div>
                    ${actions}
                </div>
            </div>
        `;
    }).join("");

    msgs.innerHTML = html;

    if (stickToBottom) scrollToBottom(msgs);
}

// ✅ Delegation
if (msgs && !msgs.__dpMediaHandlerAttached) {

    msgs.__dpMediaHandlerAttached = true;

    msgs.addEventListener("click", async (ev) => {
        const openedImg = ev.target?.closest?.(".msgPhotoOpen");
        if (openedImg) {
            const full = openedImg.getAttribute("data-full") || openedImg.getAttribute("src");
            if (full) openImageViewer(full);
            return;
        }

        const fwd = ev.target?.closest?.(".btnForward");
        if (fwd) {
            const mid = fwd.getAttribute("data-mid");
            if (!mid) return;

            const listaDestinos = state.conversas
                .filter(c => c.id !== state.conversaId)
                .map((c, idx) => {
                    const nome = c.outro?.perfil?.nome || c.outro?.email || "Usuário";
                    return `${idx + 1} - ${nome}`;
                })
                .join("\n");

            if (!listaDestinos) {
                alert("Você não tem outra conversa para encaminhar.");
                return;
            }

            const escolha = prompt("Encaminhar para qual conversa?\n\n" + listaDestinos);
            const n = Number(escolha || 0);
            if (!Number.isFinite(n) || n <= 0) return;

            const destinos = state.conversas.filter(c => c.id !== state.conversaId);
            const destino = destinos[n - 1];
            if (!destino) return;

            try {
                await apiFetch("/mensagens/encaminhar", {
                    method: "POST",
                    body: { mensagemId: mid, conversaIdDestino: destino.id },
                });
                alert("Encaminhado ✅");
            } catch (e) {
                alert("Erro ao encaminhar: " + (e?.message || "erro"));
            }
            return;
        }

        const box = ev.target?.closest?.(".mediaLocked");
        if (!box) return;

        const mid = box.getAttribute("data-mid");
        if (!mid) return;

        try {
            const r = await apiFetch(`/mensagens/${mid}/desbloquear`, { method: "POST" });

            if (typeof r?.saldoCreditos === "number") {
                state.saldoCreditos = r.saldoCreditos;
                if (minutosPill) minutosPill.textContent = `💰 Créditos: ${r.saldoCreditos}`;
                if (saldoCreditosEl) saldoCreditosEl.textContent = `${r.saldoCreditos}`;
            }

            await carregarMensagens({ forceRender: true });
        } catch (e) {
            if (e?.status === 402) {
                alert("Saldo insuficiente para desbloquear.");
                return;
            }
            alert("Erro ao desbloquear mídia: " + (e?.message || "erro"));
        }
    });
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
        const r = await apiFetch(API.enviarMensagem, {
            method: "POST",
            body: { conversaId: state.conversaId, texto: t },
        });

        if (typeof r?.saldoCreditos === "number") {
            state.saldoCreditos = Number(r.saldoCreditos);
            if (minutosPill) minutosPill.textContent = `💰 Créditos: ${state.saldoCreditos}`;
            if (saldoCreditosEl) saldoCreditosEl.textContent = `${state.saldoCreditos}`;
        }

        await carregarMensagens({ forceRender: true });
    } catch (e) {
        if (e?.status === 402 && e?.data?.code === "SALDO_INSUFICIENTE") {
            if (typeof e?.data?.saldoCreditos === "number") {
                state.saldoCreditos = Number(e.data.saldoCreditos);
                if (minutosPill) minutosPill.textContent = `💰 Créditos: ${state.saldoCreditos}`;
                if (saldoCreditosEl) saldoCreditosEl.textContent = `${state.saldoCreditos}`;
            }
            setMsg("Saldo insuficiente. Compre créditos para continuar.", "error");
            return;
        }

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
// PRESENTES
// ==============================
btnGift?.addEventListener("click", async () => {
    if (!state.conversaId) {
        alert("Selecione uma conversa primeiro.");
        return;
    }

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

function openImageViewer(src) {
    if (!src || !imageViewerOverlay || !imageViewerImg) return;

    imageViewerImg.src = src;
    imageViewerOverlay.classList.add("show");
    imageViewerOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    document.body.classList.add("dp-no-context-menu");
}

function closeImageViewer() {
    if (!imageViewerOverlay || !imageViewerImg) return;

    imageViewerOverlay.classList.remove("show");
    imageViewerOverlay.setAttribute("aria-hidden", "true");
    imageViewerImg.removeAttribute("src");
    document.body.classList.remove("no-scroll");
    document.body.classList.remove("dp-no-context-menu");
}
imageViewerClose?.addEventListener("click", closeImageViewer);

imageViewerOverlay?.addEventListener("click", (e) => {
    if (e.target === imageViewerOverlay) closeImageViewer();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeImageViewer();
});

async function garantirPresentesCache(force = false) {
    if (force || !state.presentesCache) {
        const data = await apiFetch(API.listarPresentes);
        state.presentesCache = Array.isArray(data) ? data : (data?.data || []);
    }
    return state.presentesCache || [];
}

function renderQuickGifts(itens = []) {
    if (!quickGiftsBar) return;

    if (!Array.isArray(itens) || !itens.length) {
        quickGiftsBar.innerHTML = `<div class="muted">Nenhum presente disponível.</div>`;
        return;
    }

    quickGiftsBar.innerHTML = itens.map((p) => {
        const img = p.imagemUrl || `/assets/presentes/${p.slug || "presente"}.png`;
        const nome = p.nome || "Presente";
        const custo = Number(p.custoCreditos || 0);
        const saldo = Number(state.saldoCreditos || 0);
        const disabled = custo > saldo;

        return `
    <button
        class="quickGiftBtn ${disabled ? "is-disabled" : ""}"
        data-id="${p.id}"
        type="button"
        title="${escapeHtml(nome)} - ${custo} créditos"
        aria-label="${escapeHtml(nome)} - ${custo} créditos"
        ${disabled ? "disabled" : ""}
    >
        <span class="quickGiftPrice">💎 ${custo}</span>
        <span class="quickGiftIconWrap">
            <img src="${img}" alt="${escapeHtml(nome)}">
        </span>
    </button>
`;
    }).join("");
}

async function carregarPresentes() {
    giftList.innerHTML = "Carregando...";

    try {
        const itens = await garantirPresentesCache();

        renderQuickGifts(itens);

        if (!itens.length) {
            giftList.innerHTML = `<div class="muted">Nenhum presente cadastrado.</div>`;
            return;
        }

        giftList.innerHTML = itens.map((p) => {
            const custo = Number(p.custoCreditos || 0);
            const saldo = Number(state.saldoCreditos || 0);
            const disabled = custo > saldo;

            const img = p.imagemUrl || `/assets/presentes/${p.slug || "presente"}.png`;

            return `
                <button class="dp-gift" data-id="${p.id}" ${disabled ? "disabled" : ""} type="button">
                    <img class="gift-icon" src="${img}" alt="${escapeHtml(p.nome)}">
                    <div>
                        <span class="sub">${custo} créditos</span>
                    </div>
                </button>
            `;
        }).join("");

        [...giftList.querySelectorAll("button[data-id]")].forEach((btn) => {
            btn.addEventListener("click", async () => {
                const presenteId = btn.getAttribute("data-id");
                if (!presenteId || btn.disabled) return;

                try {
                    btn.disabled = true;
                    await enviarPresente(presenteId);
                } finally {
                    btn.disabled = false;
                }
            });
        });
    } catch (e) {
        if (enforcePremiumFromError(e)) return;
        giftList.innerHTML = `<div class="muted">Erro: ${escapeHtml(e.message || "erro ao carregar presentes")}</div>`;
    }
}

quickGiftsBar?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".quickGiftBtn");
    if (!btn) return;

    if (!state.conversaId) {
        alert("Selecione uma conversa primeiro.");
        return;
    }

    if (!state.premiumAtivo) {
        if (paywall) {
            paywall.hidden = false;
            paywall.style.display = "flex";
        }
        return;
    }

    const presenteId = btn.dataset.id;
    if (!presenteId || btn.disabled) return;

    try {
        btn.disabled = true;
        await enviarPresente(presenteId);
    } catch (e) {
        alert("Erro ao enviar presente: " + (e?.message || "erro"));
    } finally {
        btn.disabled = false;
    }
});

async function enviarPresente(presenteId) {
    try {
        const r = await apiFetch(API.enviarPresente, {
            method: "POST",
            body: { conversaId: state.conversaId, presenteId },
        });

        if (typeof r?.saldoCreditos === "number") {
            state.saldoCreditos = Number(r.saldoCreditos);
            if (minutosPill) minutosPill.textContent = `💰 Créditos: ${state.saldoCreditos}`;
            if (saldoCreditosEl) saldoCreditosEl.textContent = `${state.saldoCreditos}`;
        }

        closeGiftModal();
        await carregarMensagens({ forceRender: true });

        return r;
    } catch (e) {
        if (e?.status === 402 && e?.data?.code === "SALDO_INSUFICIENTE") {
            alert("Saldo insuficiente pra enviar esse presente.");
            return;
        }

        if (enforcePremiumFromError(e)) return;

        alert("Erro ao enviar presente: " + (e?.message || "erro"));
    }
}

// ==============================
// Video Call UI + WebRTC
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

btnCallClose?.addEventListener("click", async () => { await hangup(); });
btnHangup?.addEventListener("click", async () => { await hangup(); });

btnMute?.addEventListener("click", () => {
    state.micOn = !state.micOn;
    if (state.localStream) state.localStream.getAudioTracks().forEach(t => t.enabled = state.micOn);
    btnMute.textContent = state.micOn ? "🎙️ Mudo" : "🔇 Sem mic";
});

btnCam?.addEventListener("click", () => {
    state.camOn = !state.camOn;
    if (state.localStream) state.localStream.getVideoTracks().forEach(t => t.enabled = state.camOn);
    btnCam.textContent = state.camOn ? "📷 Câmera" : "🚫 Sem cam";
});

async function startMedia() {
    if (state.localStream) return;
    state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    if (localVideo) {
        localVideo.srcObject = state.localStream;
        localVideo.muted = true;
        localVideo.playsInline = true;
        localVideo.autoplay = true;
        await localVideo.play?.().catch(() => { });
    }
}

function getIceServers() {
    const stun = { urls: "stun:stun.l.google.com:19302" };
    const turn = {
        urls: [
            "turn:desejoproibido.app:3478?transport=udp",
            "turn:desejoproibido.app:3478?transport=tcp",
        ],
        username: "dpturn",
        credential: "dpturn123",
    };
    return [stun, turn];
}

async function createPeerIfNeeded() {
    if (state.pc) return;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    state.pc = pc;

    if (state.localStream) {
        state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
    }

    pc.ontrack = (event) => {
        const stream = event.streams && event.streams[0] ? event.streams[0] : null;
        if (stream && remoteVideo) {
            remoteVideo.srcObject = stream;
            remoteVideo.playsInline = true;
            remoteVideo.autoplay = true;
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
        console.log("[webrtc] iceConnectionState:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" && callSub) callSub.textContent = "Falhou ICE (provável falta de TURN)";
    };

    pc.onconnectionstatechange = () => {
        console.log("[webrtc] connectionState:", pc.connectionState);
        const st = pc.connectionState;
        if (!callSub) return;
        if (st === "connected") callSub.textContent = "Conectado ✅";
        if (st === "disconnected") callSub.textContent = "Desconectado…";
        if (st === "failed") callSub.textContent = "Falhou ❌";
    };
}

async function ensurePeerAndMedia() {
    await startMedia();
    await createPeerIfNeeded();
}

function joinRoomNow() {
    if (!state.roomId) return;
    console.log("[socket] joinRoom", state.roomId);
    socket.emit("joinRoom", { roomId: state.roomId });
}

async function createOfferOnce() {
    if (state.callerOfferSent) return;
    if (!state.pc) await createPeerIfNeeded();

    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);

    socket.emit("call:offer", {
        roomId: state.roomId,
        sdp: offer,
        sessaoId: state.sessaoId,
    });

    state.callerOfferSent = true;
    console.log("[webrtc] offer enviado");
}

function scheduleOfferRetry() {
    clearOfferRetry();

    state.offerRetryTimer = setTimeout(async () => {
        if (!state.pc || state.pc.connectionState !== "connected") {
            console.warn("[webrtc] retry offer (fallback)");
            state.callerOfferSent = false;
            try { await createOfferOnce(); } catch { }
            scheduleOfferRetry();
        }
    }, 2500);
}

function clearOfferRetry() {
    if (state.offerRetryTimer) clearTimeout(state.offerRetryTimer);
    state.offerRetryTimer = null;
}

async function endCallLocal() {
    try {
        clearOfferRetry();

        state.callActive = false;
        state.calleeReady = false;
        state.callerOfferSent = false;

        if (state.pc) {
            try { state.pc.ontrack = null; } catch { }
            try { state.pc.onicecandidate = null; } catch { }
            try { state.pc.close(); } catch { }
        }
        state.pc = null;

        if (state.localStream) state.localStream.getTracks().forEach(t => t.stop());
        state.localStream = null;

        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        state.sessaoId = null;
        state.roomId = null;

        closeCallOverlay();

        if (btnCall) btnCall.textContent = "📞";
        if (chatStatus) chatStatus.textContent = "";
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

// botão ligar
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
        if (chatStatus) chatStatus.textContent = "";

        const r = await apiFetch(`/ligacoes/video/iniciar`, {
            method: "POST",
            body: { conversaId: state.conversaId },
        });

        state.sessaoId = r.sessaoId;
        state.roomId = r.roomId;

        state.calleeReady = false;
        state.callerOfferSent = false;

        openCallOverlay("📹 Videochamada", "Chamando…");

        await ensurePeerAndMedia();
        joinRoomNow();

        state.callActive = true;

        btnCall.textContent = "⛔";
        if (chatStatus) chatStatus.textContent = "";
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
        if (chatStatus) chatStatus.textContent = "";
    }
});

// ==============================
// ✅ MÍDIA: Foto / Áudio
// ==============================
const CLOUD_NAME = "dfdinbti3";
const UPLOAD_PRESET = "desejoproibido";

// FOTO
btnFoto?.addEventListener("click", () => {
    if (!state.conversaId) return;
    if (!state.premiumAtivo && !state.chatLiberado) {
        showCreditWall();
        return;
    }
    inputFoto?.click();
});

inputFoto?.addEventListener("change", async () => {
    const file = inputFoto?.files?.[0];
    if (!file || !state.conversaId) return;

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "desejoproibido/chat/photos");

        const responseUpload = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            { method: "POST", body: formData }
        ).then((res) => res.json());

        if (responseUpload.error) throw new Error(responseUpload.error.message);

        const mediaPath = responseUpload.public_id + "." + responseUpload.format;

        await apiFetch("/mensagens/foto", {
            method: "POST",
            body: {
                conversaId: state.conversaId,
                mediaPath,
                thumbPath: mediaPath,
                custoMoedas: 10,
            },
        });

        await carregarMensagens({ forceRender: true });
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar foto: " + (e?.message || "erro"));
    } finally {
        if (inputFoto) inputFoto.value = "";
    }
});

// ÁUDIO — estilo segurar para gravar
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecordingAudio = false;
let isAudioStarting = false;
let audioPressStartedAt = 0;
let activeAudioPointerId = null;
let audioWasCanceled = false;
let isPointerOverCancel = false;

const MIN_AUDIO_MS = 500;

// NOVAS VARIÁVEIS DA UI
let audioStartX = 0;
let audioCurrentDeltaX = 0;
// const AUDIO_CANCEL_THRESHOLD = 110;
let audioRecTimer = null;
let audioRecSeconds = 0;

function getAudioCancelThreshold() {
    const isMobile = window.innerWidth <= 768;
    return isMobile ? 55 : 110;
}

function formatAudioTime(totalSeconds) {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
}

function startAudioTimer() {
    stopAudioTimer();
    audioRecSeconds = 0;
    if (audioRecorderTime) audioRecorderTime.textContent = "0:00";

    audioRecTimer = setInterval(() => {
        audioRecSeconds += 1;
        if (audioRecorderTime) {
            audioRecorderTime.textContent = formatAudioTime(audioRecSeconds);
        }
    }, 1000);
}

function stopAudioTimer() {
    if (audioRecTimer) clearInterval(audioRecTimer);
    audioRecTimer = null;
}

function showAudioRecordingUI() {
    composer?.classList.add("is-recording");
    if (audioRecorderBar) {
        audioRecorderBar.hidden = false;
        audioRecorderBar.setAttribute("aria-hidden", "false");
    }
    if (audioRecorderTime) audioRecorderTime.textContent = "0:00";
    if (audioRecorderSlide) {
        audioRecorderSlide.style.transform = "translateX(0px)";
        audioRecorderSlide.style.opacity = "1";
        audioRecorderSlide.classList.remove("is-canceling");
    }
    if (audioRecorderHint) {
        audioRecorderHint.textContent = "Deslize para cancelar";
    }
}

function hideAudioRecordingUI() {
    composer?.classList.remove("is-recording");
    if (audioRecorderBar) {
        audioRecorderBar.hidden = true;
        audioRecorderBar.setAttribute("aria-hidden", "true");
    }
    if (audioRecorderSlide) {
        audioRecorderSlide.style.transform = "translateX(0px)";
        audioRecorderSlide.style.opacity = "1";
        audioRecorderSlide.classList.remove("is-canceling");
    }
    if (audioRecorderHint) {
        audioRecorderHint.textContent = "Deslize para cancelar";
    }
}

function updateAudioSlideUI(deltaX) {
    if (!audioRecorderSlide) return;

    const limited = Math.max(deltaX, -160);
    const opacity = Math.max(0.18, 1 - Math.abs(limited) / 170);

    audioRecorderSlide.style.transform = `translateX(${limited}px)`;
    audioRecorderSlide.style.opacity = String(opacity);

    const cancelThreshold = getAudioCancelThreshold();
    const canceling = deltaX <= -cancelThreshold;

    audioRecorderSlide.classList.toggle("is-canceling", canceling);

    if (audioRecorderHint) {
        audioRecorderHint.textContent = canceling ? "Solte para cancelar" : "Deslize para cancelar";
    }
}

function resetAudioUI() {
    btnAudio?.classList.remove("gravando");
    btnCancelarAudio?.classList.remove("is-hover");

    if (btnAudio) {
        btnAudio.disabled = false;
        btnAudio.textContent = "🎙️";
    }

    hideCancelAudioButton();
    hideAudioRecordingUI();
    stopAudioTimer();

    isPointerOverCancel = false;
    audioCurrentDeltaX = 0;
    audioStartX = 0;
}

function showCancelAudioButton() {
    if (!btnCancelarAudio) return;
    btnCancelarAudio.hidden = false;
    btnCancelarAudio.classList.add("show");
}

function hideCancelAudioButton() {
    if (!btnCancelarAudio) return;
    btnCancelarAudio.hidden = true;
    btnCancelarAudio.classList.remove("show");
    btnCancelarAudio.classList.remove("is-hover");
}

function stopAudioTracks() {
    try {
        audioStream?.getTracks()?.forEach((t) => t.stop());
    } catch { }
    audioStream = null;
}

function getSupportedAudioMimeType() {
    const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "video/webm",
    ];

    return mimeCandidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

function isEventOverCancelButton(ev) {
    if (!btnCancelarAudio || btnCancelarAudio.hidden) return false;

    const x = ev?.clientX;
    const y = ev?.clientY;

    if (typeof x !== "number" || typeof y !== "number") return false;

    const rect = btnCancelarAudio.getBoundingClientRect();

    return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
    );
}

function updateCancelHover(ev) {
    const overCancel = isEventOverCancelButton(ev);
    isPointerOverCancel = overCancel;

    if (btnCancelarAudio) {
        btnCancelarAudio.classList.toggle("is-hover", overCancel);
    }
}

function detachAudioDragListeners() {
    document.removeEventListener("pointermove", handleAudioPointerMove, true);
    document.removeEventListener("pointerup", handleAudioPointerUp, true);
    document.removeEventListener("pointercancel", handleAudioPointerCancel, true);
}

function attachAudioDragListeners() {
    document.addEventListener("pointermove", handleAudioPointerMove, true);
    document.addEventListener("pointerup", handleAudioPointerUp, true);
    document.addEventListener("pointercancel", handleAudioPointerCancel, true);
}

function getClientXFromEvent(ev) {
    if (typeof ev?.clientX === "number") return ev.clientX;
    if (ev?.touches?.[0] && typeof ev.touches[0].clientX === "number") return ev.touches[0].clientX;
    if (ev?.changedTouches?.[0] && typeof ev.changedTouches[0].clientX === "number") return ev.changedTouches[0].clientX;
    return 0;
}

function releaseAudioPointerCapture() {
    if (btnAudio && activeAudioPointerId != null && btnAudio.releasePointerCapture) {
        try {
            if (btnAudio.hasPointerCapture?.(activeAudioPointerId)) {
                btnAudio.releasePointerCapture(activeAudioPointerId);
            }
        } catch { }
    }
}

async function iniciarGravacao(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    if (!state.conversaId) return;

    if (!state.premiumAtivo && !state.chatLiberado) {
        showCreditWall();
        return;
    }

    if (isRecordingAudio || isAudioStarting) return;

    try {
        isAudioStarting = true;
        activeAudioPointerId = ev?.pointerId ?? null;
        audioPressStartedAt = Date.now();
        audioWasCanceled = false;
        isPointerOverCancel = false;

        if (btnAudio && ev?.pointerId != null && btnAudio.setPointerCapture) {
            try {
                btnAudio.setPointerCapture(ev.pointerId);
            } catch { }
        }

        audioStartX = getClientXFromEvent(ev);
        audioCurrentDeltaX = 0;

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia não suportado neste navegador");
        }

        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeType = getSupportedAudioMimeType();
        mediaRecorder = mimeType
            ? new MediaRecorder(audioStream, { mimeType })
            : new MediaRecorder(audioStream);

        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onerror = (e) => {
            console.error("MediaRecorder error:", e);
        };

        mediaRecorder.start();

        isRecordingAudio = true;
        showCancelAudioButton(); // mantido para não quebrar funcionalidade existente
        showAudioRecordingUI();
        startAudioTimer();
        attachAudioDragListeners();

        if (btnAudio) {
            btnAudio.classList.add("gravando");
            btnAudio.textContent = "🎙️";
        }
    } catch (e) {
        console.error("Erro ao iniciar gravação:", e);

        stopAudioTracks();
        mediaRecorder = null;
        audioChunks = [];
        activeAudioPointerId = null;
        isRecordingAudio = false;
        isAudioStarting = false;
        audioWasCanceled = false;
        isPointerOverCancel = false;
        detachAudioDragListeners();
        resetAudioUI();

        const errName = e?.name || "";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
            alert("Permissão do microfone negada. Libere o acesso ao microfone no navegador.");
            return;
        }

        if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            alert("Nenhum microfone foi encontrado no dispositivo.");
            return;
        }

        if (errName === "NotReadableError" || errName === "TrackStartError") {
            alert("O microfone está em uso por outro aplicativo ou não pôde ser acessado.");
            return;
        }

        alert("Erro ao acessar microfone.");
    } finally {
        isAudioStarting = false;
    }
}

async function pararGravacao(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    if (ev?.pointerId != null && activeAudioPointerId != null && ev.pointerId !== activeAudioPointerId) {
        return;
    }

    if (!mediaRecorder || !isRecordingAudio) return;

    const elapsed = Date.now() - audioPressStartedAt;
    const recorder = mediaRecorder;

    releaseAudioPointerCapture();

    isRecordingAudio = false;
    activeAudioPointerId = null;
    detachAudioDragListeners();
    stopAudioTimer();

    recorder.onstop = async () => {
        try {
            resetAudioUI();
            stopAudioTracks();

            if (audioWasCanceled) {
                audioChunks = [];
                mediaRecorder = null;
                return;
            }

            if (elapsed < MIN_AUDIO_MS) {
                audioChunks = [];
                mediaRecorder = null;
                return;
            }

            if (!audioChunks.length) {
                mediaRecorder = null;
                return;
            }

            const blobType = recorder.mimeType || "audio/webm";
            const blob = new Blob(audioChunks, { type: blobType });

            if (!blob.size) {
                mediaRecorder = null;
                audioChunks = [];
                return;
            }

            if (btnAudio) {
                btnAudio.disabled = true;
            }

            const ext = blobType.includes("mp4") ? "mp4" : "webm";
            const file = new File([blob], `audio.${ext}`, { type: blobType });

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            formData.append("folder", "desejoproibido/chat/audios");

            const responseUpload = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
                { method: "POST", body: formData }
            ).then(async (r) => {
                const json = await r.json();
                if (!r.ok) throw new Error(json?.error?.message || "Erro no upload do áudio");
                return json;
            });

            if (responseUpload.error) {
                throw new Error(responseUpload.error.message);
            }

            const mediaPath = `${responseUpload.public_id}.${responseUpload.format}`;

            await apiFetch("/mensagens/audio", {
                method: "POST",
                body: { conversaId: state.conversaId, mediaPath },
            });

            await carregarMensagens({ forceRender: true });
        } catch (e) {
            console.error("Erro ao enviar áudio:", e);
            alert("Erro ao enviar áudio: " + (e?.message || "erro"));
        } finally {
            mediaRecorder = null;
            audioChunks = [];
            audioWasCanceled = false;
            resetAudioUI();
        }
    };

    try {
        recorder.stop();
    } catch (e) {
        console.error("Erro ao parar gravação:", e);
        mediaRecorder = null;
        audioChunks = [];
        audioWasCanceled = false;
        stopAudioTracks();
        detachAudioDragListeners();
        resetAudioUI();
    }
}

function cancelarGravacao(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    if (ev?.pointerId != null && activeAudioPointerId != null && ev.pointerId !== activeAudioPointerId) {
        return;
    }
    releaseAudioPointerCapture();

    if (!mediaRecorder) {
        audioWasCanceled = false;
        detachAudioDragListeners();
        resetAudioUI();
        return;
    }

    audioWasCanceled = true;
    isRecordingAudio = false;
    activeAudioPointerId = null;
    detachAudioDragListeners();
    stopAudioTimer();

    try {
        mediaRecorder.onstop = null;

        if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
    } catch (e) {
        console.error("Erro ao cancelar gravação:", e);
    }

    mediaRecorder = null;
    audioChunks = [];
    isAudioStarting = false;
    audioPressStartedAt = 0;
    audioCurrentDeltaX = 0;

    stopAudioTracks();
    resetAudioUI();
}

function handleAudioPointerMove(ev) {
    if (!isRecordingAudio) return;
    if (ev?.pointerId != null && activeAudioPointerId != null && ev.pointerId !== activeAudioPointerId) {
        return;
    }

    ev?.preventDefault?.();

    updateCancelHover(ev);

    const currentX = getClientXFromEvent(ev);
    audioCurrentDeltaX = currentX - audioStartX;

    if (audioCurrentDeltaX < 0) {
        updateAudioSlideUI(audioCurrentDeltaX);
    } else {
        updateAudioSlideUI(0);
    }

    const cancelThreshold = getAudioCancelThreshold();

    if (audioCurrentDeltaX <= -cancelThreshold) {
        audioWasCanceled = true;
    } else {
        audioWasCanceled = false;
    }
}

function handleAudioPointerUp(ev) {
    if (!isRecordingAudio) return;
    if (ev?.pointerId != null && activeAudioPointerId != null && ev.pointerId !== activeAudioPointerId) {
        return;
    }

    const cancelThreshold = getAudioCancelThreshold();
    const canceledBySlide = audioCurrentDeltaX <= -cancelThreshold;
    const canceledByOldButton = isEventOverCancelButton(ev);

    if (canceledBySlide || canceledByOldButton) {
        cancelarGravacao(ev);
    } else {
        pararGravacao(ev);
    }
}
function handleAudioPointerCancel(ev) {
    if (!isRecordingAudio) return;
    if (ev?.pointerId != null && activeAudioPointerId != null && ev.pointerId !== activeAudioPointerId) {
        return;
    }

    cancelarGravacao(ev);
}

btnAudio?.addEventListener("contextmenu", (e) => e.preventDefault());
btnAudio?.addEventListener("dragstart", (e) => e.preventDefault());

btnAudio?.addEventListener("pointerdown", iniciarGravacao);

btnCancelarAudio?.addEventListener("click", cancelarGravacao);

// ==============================
// Init
// ==============================
await checarPremium();
await carregarConversas();
await carregarPresentes();

enableChatProtection();
hideScreenGuard();

document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
        await checarPremium();
        await atualizarStatusChat();
        await carregarMensagens({ silent: true });
    }
});

setInterval(async () => {
    await checarPremium();
}, 10000);

setInterval(() => {
    if (state.conversaId) carregarMensagens({ silent: true });
}, 4000);

async function apagarMensagem(mensagemId) {
    if (!mensagemId) return;

    const ok = confirm("Deseja realmente apagar esta mensagem?");
    if (!ok) return;

    try {
        await apiFetch(`/mensagens/${mensagemId}`, {
            method: "DELETE",
        });

        await carregarMensagens({ forceRender: true });
    } catch (e) {
        alert("Erro ao apagar mensagem: " + (e?.message || "erro"));
    }
}

window.apagarMensagem = apagarMensagem;