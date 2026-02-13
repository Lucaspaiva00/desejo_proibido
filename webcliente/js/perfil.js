// app/js/perfil.js
import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

// UI
const elNome = document.getElementById("nome");
const elCidade = document.getElementById("cidade");
const elEstado = document.getElementById("estado");
const elBio = document.getElementById("bio");

const elNascimento = document.getElementById("nascimento");
const elGenero = document.getElementById("genero");

const toggle = document.getElementById("toggleInvisivel");
const txt = document.getElementById("txtInvisivel");
const msgInv = document.getElementById("msgInvisivel");

const btnBoost = document.getElementById("btnBoost");
const msgBoost = document.getElementById("msgBoost");

const pill = document.getElementById("premiumPill");

// botão Fotos
const btnIrFotos = document.getElementById("btnIrFotos");
if (btnIrFotos) btnIrFotos.onclick = () => (location.href = "fotos.html");

// ==============================
// Auth robusto (mesmo padrão do conversas.js)
// ==============================
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
if (auth.token && !localStorage.getItem("token")) {
    localStorage.setItem("token", auth.token);
}

// se não achou nada, manda pro login
if (!auth.usuario && !localStorage.getItem("token")) {
    alert("Sessão expirada. Faça login.");
    location.href = "login.html";
}

// Estado
const state = {
    premiumAtivo: false,
    saldoCreditos: 0,
};

// ==============================
// Helpers
// ==============================
function setMsg(text) {
    if (!msg) return;
    msg.textContent = text || "";
}

// ✅ NOVO: aviso quando vem do cadastro / bloqueio do feed
(function showAfterRegisterHint() {
    const flag = localStorage.getItem("dp_after_register");
    if (flag === "complete_perfil") {
        localStorage.removeItem("dp_after_register");
        setMsg("✅ Complete seu perfil para aparecer no feed.");
    }
})();

function fmtDate(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

function toDateInputValue(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function preencherPerfil(p) {
    elNome.value = p?.nome ?? "";
    elCidade.value = p?.cidade ?? "";
    elEstado.value = (p?.estado ?? "").toUpperCase();
    elBio.value = p?.bio ?? "";

    if (elNascimento) elNascimento.value = toDateInputValue(p?.nascimento);
    if (elGenero) elGenero.value = p?.genero ?? "";
}

// ✅ NOVO: valida perfil mínimo (mesma regra do register/login gate)
function isPerfilCompletoMinimo(p) {
    const nome = (p?.nome || "").trim();
    const estado = (p?.estado || "").trim();
    const genero = (p?.genero || "").trim();
    const nascimento = p?.nascimento;

    const nascOk = !!nascimento && !Number.isNaN(new Date(nascimento).getTime());

    return (
        nome.length >= 2 &&
        estado.length === 2 &&
        genero.length >= 2 &&
        nascOk
    );
}

// ✅ NOVO: aplica bloqueio visual + mensagem forte
function aplicarGatePerfil(p) {
    if (isPerfilCompletoMinimo(p)) return;

    const faltas = [];
    if (!((p?.nome || "").trim())) faltas.push("Nome");
    if (!((p?.estado || "").trim()) || (p?.estado || "").trim().length !== 2) faltas.push("UF");
    if (!((p?.genero || "").trim())) faltas.push("Gênero");
    if (!(p?.nascimento)) faltas.push("Nascimento");

    setMsg(`⚠️ Para aparecer no feed, preencha: ${faltas.join(", ")}.`);
}

function setEstadoPremiumUI(isPremiumAtivo) {
    // pill
    if (pill) pill.style.display = isPremiumAtivo ? "inline-flex" : "none";

    if (!toggle || !txt) return;

    if (!isPremiumAtivo) {
        toggle.disabled = true;
        toggle.checked = false;
        txt.textContent = "Disponível no Premium";
        if (msgInv) msgInv.textContent = "";

        if (btnBoost) {
            btnBoost.disabled = true;
            btnBoost.textContent = "Disponível no Premium";
        }
        if (msgBoost) msgBoost.textContent = "";
        return;
    }

    toggle.disabled = false;
    if (btnBoost) {
        btnBoost.disabled = false;
        btnBoost.textContent = "🚀 Dar Boost (150 créditos / 30min)";
    }
}

function syncInvisivelUI(isOn, invisivelAte) {
    if (!toggle || !txt) return;
    toggle.checked = !!isOn;
    txt.textContent = toggle.checked ? "Ativado" : "Desativado";

    if (msgInv) {
        msgInv.textContent = toggle.checked ? `✅ Invisível até: ${fmtDate(invisivelAte)}` : "";
    }
}

function syncBoostUI(boostAte) {
    if (msgBoost) {
        msgBoost.textContent = boostAte ? `✅ Boost até: ${fmtDate(boostAte)}` : "";
    }
}

// ==============================
// Premium (IGUAL conversas.js)
// ==============================
async function checarPremium() {
    try {
        const r = await apiFetch("/premium/me");
        const ativo = !!r?.isPremium;
        const saldo = Number(r?.saldoCreditos ?? 0);

        state.premiumAtivo = ativo;
        state.saldoCreditos = saldo;

        // mantém consistência no localStorage (igual chat faz)
        try {
            const raw = localStorage.getItem("usuario");
            const u = raw ? JSON.parse(raw) : (auth.usuario || {});
            if (u) {
                u.isPremium = ativo;
                u.premiumAtivo = ativo;
                u.premium = ativo;
                u.saldoCreditos = saldo;
                localStorage.setItem("usuario", JSON.stringify(u));
            }
        } catch { }

        setEstadoPremiumUI(ativo);
        return ativo;
    } catch {
        state.premiumAtivo = false;
        setEstadoPremiumUI(false);
        return false;
    }
}

// ==============================
// Perfil e Recursos Premium
// ==============================
async function carregarPerfil() {
    try {
        const perfil = await apiFetch("/perfil/me");
        preencherPerfil(perfil);

        // ✅ NOVO: avisa claramente o usuário do que falta
        aplicarGatePerfil(perfil);

        return perfil;
    } catch {
        return null;
    }
}

async function carregarInvisivelEBoost() {
    if (!toggle || !txt) return;

    try {
        // checa premium primeiro (igual chat)
        await checarPremium();

        // se não é premium, já bloqueia UI e sai
        if (!state.premiumAtivo) return;

        // agora busca dados do usuário (invisível/boost)
        const u = await apiFetch("/usuarios/me");

        syncInvisivelUI(!!u.isInvisivel, u.invisivelAte);
        syncBoostUI(u.boostAte);

        // TOGGLE INVISÍVEL
        toggle.onchange = async () => {
            if (!state.premiumAtivo) return;

            msgInv.textContent = "";
            const novo = toggle.checked;

            if (novo) {
                const ok = confirm("Ativar Modo Invisível por 30 minutos? (Custo: 150 créditos)");
                if (!ok) {
                    toggle.checked = false;
                    txt.textContent = "Desativado";
                    return;
                }
            }

            try {
                const r = await apiFetch("/usuarios/invisivel", {
                    method: "PUT",
                    body: { ativo: novo },
                });

                syncInvisivelUI(!!r.isInvisivel, r.invisivelAte);

                if (r.custo > 0) {
                    msgInv.textContent = `✅ Invisível ativado (-${r.custo} créditos). Até: ${fmtDate(r.invisivelAte)}. Saldo: ${r.saldoCreditos}`;
                } else if (!r.isInvisivel) {
                    msgInv.textContent = "✅ Você voltou a aparecer no feed.";
                }
            } catch (e) {
                toggle.checked = !novo;
                txt.textContent = toggle.checked ? "Ativado" : "Desativado";

                if (e?.status === 402) {
                    msgInv.textContent = "❌ Saldo insuficiente para ativar (precisa de 150 créditos).";
                } else {
                    msgInv.textContent = e?.message || "Erro ao alterar invisível";
                }
            }
        };

        // BOOST
        if (btnBoost) {
            btnBoost.onclick = async () => {
                if (!state.premiumAtivo) return;

                msgBoost.textContent = "";
                btnBoost.disabled = true;
                const oldText = btnBoost.textContent;
                btnBoost.textContent = "Ativando...";

                try {
                    const r = await apiFetch("/usuarios/boost", {
                        method: "PUT",
                        body: {},
                    });

                    syncBoostUI(r.boostAte);
                    msgBoost.textContent = `✅ Boost ativado (-${r.custo} créditos). Até: ${fmtDate(r.boostAte)}. Saldo: ${r.saldoCreditos}`;
                } catch (e) {
                    if (e?.status === 402) {
                        msgBoost.textContent = "❌ Saldo insuficiente para ativar boost (precisa de 150 créditos).";
                    } else {
                        msgBoost.textContent = e?.message || "Erro ao ativar boost";
                    }
                } finally {
                    btnBoost.disabled = false;
                    btnBoost.textContent = oldText || "🚀 Dar Boost (150 créditos / 30min)";
                }
            };
        }
    } catch {
        // silencioso
    }
}

// salvar perfil
document.getElementById("btnSalvar").onclick = async () => {
    try {
        setMsg("");

        const body = {
            nome: elNome.value.trim(),
            bio: elBio.value.trim(),
            cidade: elCidade.value.trim(),
            estado: elEstado.value.trim().toUpperCase(),
            genero: elGenero ? elGenero.value : "",
            nascimento: elNascimento ? elNascimento.value : "",
        };

        // ✅ agora obriga o mínimo pra aparecer no feed
        if (!body.nome) throw new Error("Nome é obrigatório");
        if (!body.estado || body.estado.length !== 2) throw new Error("Estado deve ter 2 letras (ex: SP)");
        if (!body.genero) throw new Error("Gênero é obrigatório");
        if (!body.nascimento) throw new Error("Nascimento é obrigatório");

        if (body.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(body.nascimento)) {
            throw new Error("Nascimento inválido (use a data do seletor).");
        }

        await apiFetch("/perfil", { method: "PUT", body });

        // ✅ mensagem + opcional: mandar pro feed após salvar
        setMsg("✅ Perfil salvo! Agora você já aparece no feed.");

        // Recarrega e aplica gate novamente (caso faltou algo)
        const perfil = await apiFetch("/perfil/me");
        preencherPerfil(perfil);
        aplicarGatePerfil(perfil);

        // ✅ se estiver completo, manda pro feed automaticamente (melhora UX)
        if (isPerfilCompletoMinimo(perfil)) {
            setTimeout(() => (location.href = "home.html"), 500);
        }
    } catch (e) {
        setMsg(e.message);
    }
};

async function init() {
    await carregarPerfil();
    await carregarInvisivelEBoost();
}

init();
