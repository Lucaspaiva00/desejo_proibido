import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

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

function setMsg(text) {
    if (!msg) return;
    msg.textContent = text || "";
}

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

async function carregarPerfil() {
    try {
        const perfil = await apiFetch("/perfil/me");
        preencherPerfil(perfil);
    } catch {
        // silencioso
    }
}

function setEstadoPremiumUI(isPremium) {
    if (!toggle || !txt) return;

    if (!isPremium) {
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
        msgInv.textContent = toggle.checked
            ? `✅ Invisível até: ${fmtDate(invisivelAte)}`
            : "";
    }
}

function syncBoostUI(boostAte) {
    if (msgBoost) {
        msgBoost.textContent = boostAte ? `✅ Boost até: ${fmtDate(boostAte)}` : "";
    }
}

async function carregarInvisivelEBoost() {
    if (!toggle || !txt) return;

    try {
        const u = await apiFetch("/usuarios/me");

        setEstadoPremiumUI(!!u.isPremium);

        if (!u.isPremium) return;

        syncInvisivelUI(!!u.isInvisivel, u.invisivelAte);
        syncBoostUI(u.boostAte);

        // TOGGLE INVISÍVEL (cobra ao ligar)
        toggle.onchange = async () => {
            if (!u.isPremium) return;

            msgInv.textContent = "";
            const novo = toggle.checked;

            // UX: confirma cobrança ao ativar
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
                    msgInv.textContent = e.message || "Erro ao alterar invisível";
                }
            }
        };

        // BOOST (cobra sempre que clicar)
        if (btnBoost) {
            btnBoost.onclick = async () => {
                msgBoost.textContent = "";
                btnBoost.disabled = true;
                const oldText = btnBoost.textContent;
                btnBoost.textContent = "Ativando...";

                try {
                    const r = await apiFetch("/usuarios/boost", {
                        method: "PUT",
                        body: {}, // 30min fixo no backend
                    });

                    syncBoostUI(r.boostAte);
                    msgBoost.textContent = `✅ Boost ativado (-${r.custo} créditos). Até: ${fmtDate(r.boostAte)}. Saldo: ${r.saldoCreditos}`;
                } catch (e) {
                    if (e?.status === 402) {
                        msgBoost.textContent = "❌ Saldo insuficiente para ativar boost (precisa de 150 créditos).";
                    } else {
                        msgBoost.textContent = e.message || "Erro ao ativar boost";
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

        if (!body.nome) throw new Error("Nome é obrigatório");
        if (!body.estado || body.estado.length !== 2) throw new Error("Estado deve ter 2 letras (ex: SP)");

        if (body.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(body.nascimento)) {
            throw new Error("Nascimento inválido (use a data do seletor).");
        }

        await apiFetch("/perfil", { method: "PUT", body });
        setMsg("✅ Perfil salvo!");
    } catch (e) {
        setMsg(e.message);
    }
};

async function init() {
    await carregarPerfil();
    await carregarInvisivelEBoost();
}

init();
