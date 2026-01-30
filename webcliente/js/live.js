import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");
const q = document.getElementById("q");
const btnReload = document.getElementById("btnReload");
const liveList = document.getElementById("liveList");

const saldoPill = document.getElementById("saldoPill");
const premiumBadge = document.getElementById("premiumBadge");
const btnAssinarTopo = document.getElementById("btnAssinarTopo");

const roomTitle = document.getElementById("roomTitle");
const roomSub = document.getElementById("roomSub");
const roomStatus = document.getElementById("roomStatus");

const hostAvatar = document.getElementById("hostAvatar");
const hostFallback = document.getElementById("hostFallback");

const btnJoin = document.getElementById("btnJoin");   // aqui vira "Chamar"
const btnLeave = document.getElementById("btnLeave"); // aqui vira "Finalizar"

const paywall = document.getElementById("paywall");
const btnAssinar = document.getElementById("btnAssinar");
const btnComprarCreditos = document.getElementById("btnComprarCreditos");

const msgs = document.getElementById("msgs");
const chatInfo = document.getElementById("chatInfo");
const texto = document.getElementById("texto");
const btnEnviar = document.getElementById("btnEnviar");

const startBox = document.getElementById("startBox"); // não vamos usar pra mulher iniciar live aqui
if (startBox) startBox.style.display = "none";

const roomHint = document.getElementById("roomHint");

// Drawer chat
const btnChat = document.getElementById("btnChat");
const chatDrawer = document.getElementById("chatDrawer");
const chatOverlay = document.getElementById("chatOverlay");
const btnChatClose = document.getElementById("btnChatClose");

// logout
document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

// ==============================
// Estado / Auth
// ==============================
function safeJsonParse(v) { try { return JSON.parse(v); } catch { return null; } }
function getAuth() {
    const keysUser = ["usuarioLogado", "usuario", "user", "authUser"];
    let usuario = null;
    for (const k of keysUser) {
        const v = localStorage.getItem(k);
        if (v) { const obj = safeJsonParse(v); if (obj) { usuario = obj; break; } }
    }
    const token = localStorage.getItem("token") || usuario?.token || "";
    return { usuario, token };
}
const auth = getAuth();
if (auth.token && !localStorage.getItem("token")) localStorage.setItem("token", auth.token);

if (!auth.usuario && !localStorage.getItem("token")) {
    alert("Sessão expirada. Faça login.");
    location.href = "login.html";
}

const state = {
    usuario: auth.usuario,
    premiumAtivo: !!(auth.usuario?.premiumAtivo || auth.usuario?.isPremium || auth.usuario?.premium),
    saldo: null,

    mulheres: [],
    alvoId: null,
    alvoAtual: null,

    sessaoId: null,
    pollingPendentesTimer: null,
    pollingStatusTimer: null,
};

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

function isBlockedOrPay(e) {
    const st = e?.status;
    if (st === 402 || st === 403) return true;
    const m = (e?.message || "").toLowerCase();
    return m.includes("minut") || m.includes("crédito") || m.includes("credito") || m.includes("premium");
}

function showPaywall(text) {
    paywall.hidden = false;
    setMsg(text || "Acesso restrito: Premium e/ou créditos.", "error");
}

function hidePaywall() {
    paywall.hidden = true;
    setMsg("");
}

function openCheckout() {
    alert("Abrir checkout Premium (implementar link real).");
}
function openComprarCreditos() {
    alert("Abrir compra de créditos/minutos (implementar link real).");
}

btnAssinar?.addEventListener("click", openCheckout);
btnAssinarTopo?.addEventListener("click", openCheckout);
btnComprarCreditos?.addEventListener("click", openComprarCreditos);

function setUIAccess() {
    premiumBadge.textContent = state.premiumAtivo ? "✅ Premium" : "🔒 Premium";
    btnAssinarTopo.style.display = state.premiumAtivo ? "none" : "inline-flex";
}

// ==============================
// Drawer Chat (aqui vira "Log da chamada", não chat real)
// ==============================
function openChat() {
    chatDrawer?.classList.add("open");
    chatOverlay?.classList.add("show");
    chatDrawer?.setAttribute("aria-hidden", "false");
    chatOverlay?.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
}
function closeChat() {
    chatDrawer?.classList.remove("open");
    chatOverlay?.classList.remove("show");
    chatDrawer?.setAttribute("aria-hidden", "true");
    chatOverlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
}
btnChat?.addEventListener("click", openChat);
btnChatClose?.addEventListener("click", closeChat);
chatOverlay?.addEventListener("click", closeChat);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChat();
});

function appendSystem(text) {
    msgs.innerHTML += `
    <div class="msgRow other">
      <div class="bubble">
        <div><b>${escapeHtml(text)}</b></div>
        <div class="meta muted">${new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  `;
    msgs.scrollTop = msgs.scrollHeight;
}

// desativa envio (porque aqui não tem WS/chat real ainda)
if (texto) texto.disabled = true;
if (btnEnviar) btnEnviar.disabled = true;
if (chatInfo) chatInfo.textContent = "Aqui você verá eventos da chamada";

// ==============================
// Carteira / saldo (opcional)
// ==============================
// Se você ainda não tem rota /carteira no backend, isso vai dar 404.
// Deixei seguro: se falhar, só mostra "-"
async function carregarSaldo() {
    try {
        const r = await apiFetch("/carteira");
        state.saldo = r?.saldoCreditos ?? r?.saldo ?? null;
    } catch {
        state.saldo = null;
    }
    if (saldoPill) saldoPill.textContent = `💳 Créditos: ${state.saldo ?? "-"}`;
}

// ==============================
// Lista mulheres (GET /ligacoes/video/mulheres)
// ==============================
async function carregarMulheres() {
    try {
        setMsg("Carregando perfis...");
        const data = await apiFetch("/ligacoes/video/mulheres");
        state.mulheres = data?.items || [];
        renderMulheres();
        setMsg("");
    } catch (e) {
        setMsg("Erro ao carregar perfis: " + (e.message || "falha"), "error");
    }
}

function renderMulheres() {
    const filtro = (q?.value || "").toLowerCase().trim();

    const items = state.mulheres.filter((u) => {
        const n = (u.nome || "").toLowerCase();
        return !filtro || n.includes(filtro);
    });

    if (!items.length) {
        liveList.innerHTML = `<div class="empty">Nenhum perfil disponível.</div>`;
        return;
    }

    liveList.innerHTML = items.map((u) => {
        const active = state.alvoId === u.id ? "active" : "";
        const nome = u.nome || "Sem nome";
        const cidade = [u.cidade, u.estado].filter(Boolean).join(" - ");
        const idade = (u.idade != null) ? ` • ${u.idade} anos` : "";
        const verif = u.verificada ? " ✅" : "";
        const boost = u.boost ? " 🚀" : "";

        return `
      <button class="item ${active}" data-id="${u.id}">
        <div class="row1">
          <div class="title">${escapeHtml(nome)}${verif}${boost}</div>
          <div class="time muted">${escapeHtml(cidade)}${escapeHtml(idade)}</div>
        </div>
        <div class="row2 muted">Toque para selecionar</div>
      </button>
    `;
    }).join("");

    [...liveList.querySelectorAll("button[data-id]")].forEach((btn) => {
        btn.addEventListener("click", () => selecionarAlvo(btn.getAttribute("data-id")));
    });
}

q?.addEventListener("input", renderMulheres);
btnReload?.addEventListener("click", carregarMulheres);

// ==============================
// Selecionar alvo (mulher)
// ==============================
function selecionarAlvo(alvoId) {
    state.alvoId = alvoId;
    state.alvoAtual = state.mulheres.find((x) => x.id === alvoId) || null;

    renderMulheres();

    if (!state.alvoAtual) return;

    const nome = state.alvoAtual.nome || "Perfil";
    const cidade = [state.alvoAtual.cidade, state.alvoAtual.estado].filter(Boolean).join(" - ");

    roomTitle.textContent = nome;
    roomSub.textContent = cidade ? `Local: ${cidade}` : "Selecione para iniciar a chamada";
    roomStatus.textContent = "✅ Perfil selecionado";
    if (roomHint) roomHint.textContent = "Clique em CHAMAR para iniciar a videochamada.";

    // avatar
    if (state.alvoAtual.foto) {
        hostAvatar.src = state.alvoAtual.foto;
        hostAvatar.style.display = "block";
        hostFallback.style.display = "none";
    } else {
        hostAvatar.removeAttribute("src");
        hostAvatar.style.display = "none";
        hostFallback.style.display = "grid";
        hostFallback.textContent = (nome || "DP").slice(0, 2).toUpperCase();
    }

    // botões
    btnJoin.disabled = false;
    btnLeave.disabled = true;
    btnJoin.textContent = "Chamar";
    btnLeave.textContent = "Finalizar";

    msgs.innerHTML = `<div class="empty">Aqui aparecerá o status da chamada.</div>`;
    closeChat();

    if (!state.premiumAtivo) showPaywall("Para chamar, você precisa de Premium e minutos/créditos.");
    else hidePaywall();
}

// ==============================
// Chamar / Finalizar
// ==============================
btnJoin?.addEventListener("click", chamar);
btnLeave?.addEventListener("click", finalizar);

async function chamar() {
    if (!state.alvoId) return;

    if (!state.premiumAtivo) {
        showPaywall("Para chamar, você precisa de Premium e minutos/créditos.");
        return;
    }

    try {
        roomStatus.textContent = "Chamando...";
        hidePaywall();

        const r = await apiFetch("/ligacoes/video/iniciar", {
            method: "POST",
            body: { alvoId: state.alvoId },
        });

        state.sessaoId = r?.sessaoId || null;

        appendSystem(`📞 Chamada iniciada (sessão: ${state.sessaoId || "?"})`);
        appendSystem(`🔗 Room: ${r?.roomId || "-"}`);
        appendSystem("⏳ Aguardando a usuária aceitar...");

        roomStatus.textContent = "📞 Tocando...";
        if (roomHint) roomHint.textContent = "Aguardando aceitar...";

        btnJoin.disabled = true;
        btnLeave.disabled = false;

        // começa a monitorar se a chamada virou ATIVA / RECUSADA / FINALIZADA
        startPollingSessao();
        await carregarSaldo();
    } catch (e) {
        if (isBlockedOrPay(e)) showPaywall(e?.message || "Sem minutos/créditos.");
        else setMsg("Erro ao iniciar: " + (e.message || "falha"), "error");
        roomStatus.textContent = "⚠️ Erro";
        btnJoin.disabled = false;
        btnLeave.disabled = true;
    }
}

async function finalizar() {
    try {
        stopPollingSessao();

        if (state.sessaoId) {
            const r = await apiFetch(`/ligacoes/video/${state.sessaoId}/finalizar`, { method: "POST" });
            appendSystem(`✅ Finalizada. ${r?.minutosCobrados ? `Minutos cobrados: ${r.minutosCobrados}` : ""}`);
            roomStatus.textContent = "✅ Finalizada";
            if (roomHint) roomHint.textContent = "Chamada encerrada.";
        } else {
            roomStatus.textContent = "⏳ Encerrada";
        }

        state.sessaoId = null;

        btnJoin.disabled = false;
        btnLeave.disabled = true;

        await carregarSaldo();
    } catch (e) {
        setMsg("Erro ao finalizar: " + (e.message || "falha"), "error");
    }
}

// ==============================
// Polling de status (MVP seguro)
// Como seu controller não tem endpoint GET /sessao/:id,
// a forma mais simples é consultar pendentes (para mulher) não serve pro caller.
// Então aqui vamos só manter UX e permitir finalizar.
// Se você quiser status real (ATIVA/RECUSADA), crie:
// GET /ligacoes/video/:id -> retorna status/roomId
// ==============================
function startPollingSessao() {
    stopPollingSessao();

    // Se você criar GET /ligacoes/video/:id, habilita aqui.
    // Por enquanto, só mantém um “ping” visual.
    state.pollingStatusTimer = setInterval(() => {
        if (!state.sessaoId) return;
        // placeholder
    }, 5000);
}

function stopPollingSessao() {
    if (state.pollingStatusTimer) {
        clearInterval(state.pollingStatusTimer);
        state.pollingStatusTimer = null;
    }
}

// ==============================
// Init
// ==============================
setUIAccess();
await carregarSaldo();
await carregarMulheres();
