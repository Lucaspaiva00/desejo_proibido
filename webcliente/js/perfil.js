import { apiFetch, logout } from "./api.js";

const msg = document.getElementById("msg");

document.getElementById("btnSair").onclick = logout;
const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

const elNome = document.getElementById("nome");
const elCidade = document.getElementById("cidade");
const elEstado = document.getElementById("estado");
const elBio = document.getElementById("bio");

// ✅ novos
const elNascimento = document.getElementById("nascimento");
const elGenero = document.getElementById("genero");

const toggle = document.getElementById("toggleInvisivel");
const txt = document.getElementById("txtInvisivel");
const msgInv = document.getElementById("msgInvisivel");

// ✅ BOOST
const btnBoost = document.getElementById("btnBoost");
const msgBoost = document.getElementById("msgBoost");

function setMsg(text) {
    if (!msg) return;
    msg.textContent = text || "";
}

function toDateInputValue(dt) {
    // dt pode vir como string ISO do Prisma
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

async function carregarInvisivelEBoost() {
    if (!toggle || !txt || !msgInv) return;

    try {
        const u = await apiFetch("/usuarios/me");

        if (!u.isPremium) {
            toggle.disabled = true;
            toggle.checked = false;
            txt.textContent = "Disponível no Premium";
            msgInv.textContent = "";

            if (btnBoost && msgBoost) {
                btnBoost.disabled = true;
                btnBoost.textContent = "Disponível no Premium";
                msgBoost.textContent = "";
            }
            return;
        }

        toggle.disabled = false;
        toggle.checked = !!u.isInvisivel;
        txt.textContent = toggle.checked ? "Ativado" : "Desativado";

        toggle.onchange = async () => {
            msgInv.textContent = "";
            try {
                const r = await apiFetch("/usuarios/invisivel", {
                    method: "PUT",
                    body: { ativo: toggle.checked },
                });

                txt.textContent = r.isInvisivel ? "Ativado" : "Desativado";
                msgInv.textContent = r.isInvisivel
                    ? "✅ Você ficou invisível no feed."
                    : "✅ Você voltou a aparecer no feed.";
            } catch (e) {
                toggle.checked = !toggle.checked;
                msgInv.textContent = e.message;
            }
        };

        if (btnBoost && msgBoost) {
            btnBoost.disabled = false;
            btnBoost.textContent = "🚀 Dar Boost";

            btnBoost.onclick = async () => {
                msgBoost.textContent = "";
                btnBoost.disabled = true;
                btnBoost.textContent = "Ativando...";

                try {
                    const r = await apiFetch("/usuarios/boost", {
                        method: "PUT",
                        body: { horas: 6 },
                    });

                    msgBoost.textContent = `✅ Boost ativado até: ${new Date(
                        r.boostAte
                    ).toLocaleString()}`;
                } catch (e) {
                    msgBoost.textContent = e.message || "Erro ao ativar boost";
                } finally {
                    btnBoost.disabled = false;
                    btnBoost.textContent = "🚀 Dar Boost";
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

            // ✅ novos
            genero: elGenero ? elGenero.value : "",
            nascimento: elNascimento ? elNascimento.value : "", // "YYYY-MM-DD"
        };

        if (!body.nome) throw new Error("Nome é obrigatório");
        if (!body.estado || body.estado.length !== 2)
            throw new Error("Estado deve ter 2 letras (ex: SP)");

        // nascimento é opcional, mas se preencher, deve ser YYYY-MM-DD
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
