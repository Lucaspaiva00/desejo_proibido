import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
document.getElementById("btnSair").onclick = logout;

const fotoPrincipal = document.getElementById("fotoPrincipal");
const heroFallback = document.getElementById("heroFallback");

const elNome = document.getElementById("nome");
const elLocal = document.getElementById("local");
const elBio = document.getElementById("bio");
const galeria = document.getElementById("galeria");

const btnChat = document.getElementById("btnChat");
const btnVoltar = document.getElementById("btnVoltar");
const btnVoltarTop = document.getElementById("btnVoltarTop");
const btnBloquear = document.getElementById("btnBloquear");

function getUserId() {
    return new URL(location.href).searchParams.get("userId");
}

function setHero(url) {
    if (!url) {
        fotoPrincipal.style.display = "none";
        heroFallback.style.display = "flex";
        return;
    }

    heroFallback.style.display = "none";
    fotoPrincipal.style.display = "block";
    fotoPrincipal.src = url;

    fotoPrincipal.onerror = () => {
        fotoPrincipal.style.display = "none";
        heroFallback.style.display = "flex";
    };
}

function marcarSelecionada(url) {
    document.querySelectorAll(".gFoto").forEach(img => {
        img.classList.toggle("sel", img.getAttribute("data-url") === url);
    });
}

async function carregar() {
    try {
        msg.textContent = "";

        const userId = getUserId();
        if (!userId) throw new Error("userId não informado");

        const u = await apiFetch(`/usuarios/${userId}`);

        elNome.textContent = u.perfil?.nome || "Sem nome";
        elLocal.textContent = `${u.perfil?.cidade || ""} ${u.perfil?.estado || ""}`.trim();
        elBio.textContent = u.perfil?.bio || "";

        const principalUrl = u.fotoPrincipal ? `${API_BASE}${u.fotoPrincipal}` : "";
        setHero(principalUrl);

        const fotos = u.fotos || [];
        if (!fotos.length) {
            galeria.innerHTML = `<div class="muted">Usuário ainda não tem fotos.</div>`;
        } else {
            galeria.innerHTML = fotos.map(f => {
                const url = `${API_BASE}${f.url}`;
                return `<img class="gFoto" src="${url}" data-url="${url}" alt="foto" />`;
            }).join("");

            document.querySelectorAll(".gFoto").forEach(img => {
                img.onerror = () => (img.style.opacity = 0.25);
                img.onclick = () => {
                    const url = img.getAttribute("data-url");
                    setHero(url);
                    marcarSelecionada(url);
                };
            });

            // marca a principal se existir
            if (principalUrl) marcarSelecionada(principalUrl);
        }

        // Chat: pega conversa com esse user
        const conversas = await apiFetch(`/conversas/minhas`);
        const conversa = (conversas || []).find(c => c.outroUsuario?.id === userId);

        if (conversa?.conversaId) {
            btnChat.disabled = false;
            btnChat.textContent = "Abrir Chat";
            btnChat.onclick = () => {
                localStorage.setItem("conversaSelecionadaId", conversa.conversaId);
                location.href = "conversas.html";
            };
        } else {
            btnChat.disabled = true;
            btnChat.textContent = "Sem conversa";
        }

        const voltar = () => history.back();
        btnVoltar.onclick = voltar;
        btnVoltarTop.onclick = voltar;

        btnBloquear.onclick = async () => {
            if (!confirm("Bloquear este usuário? Isso remove match e conversa.")) return;
            await apiFetch(`/bloqueios/${userId}`, { method: "POST" });
            alert("Usuário bloqueado.");
            location.href = "matches.html";
        };

    } catch (e) {
        msg.textContent = e.message;
    }
}

carregar();
