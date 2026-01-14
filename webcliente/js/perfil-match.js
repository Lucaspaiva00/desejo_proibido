import { apiFetch, API_BASE, logout } from "./api.js";

const msg = document.getElementById("msg");
const btnSair = document.getElementById("btnSair");
if (btnSair) btnSair.onclick = logout;

const btnSairMobile = document.getElementById("btnSairMobile");
if (btnSairMobile) btnSairMobile.onclick = logout;

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

// ==============================
// ✅ pega id de qualquer param
// ==============================
function getUserId() {
    const params = new URL(location.href).searchParams;
    return params.get("userId") || params.get("usuarioId") || params.get("id");
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
    document.querySelectorAll(".gFoto").forEach((img) => {
        img.classList.toggle("sel", img.getAttribute("data-url") === url);
    });
}

function fullUrl(pathOrUrl) {
    if (!pathOrUrl) return "";
    // se já é URL absoluta, retorna direto
    if (String(pathOrUrl).startsWith("http")) return pathOrUrl;
    // garante 1 barra
    return `${API_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function carregar() {
    try {
        msg.textContent = "";

        const userId = getUserId();
        if (!userId) throw new Error("ID do usuário não informado na URL (use ?id=...)");

        // ✅ pega o usuário
        const u = await apiFetch(`/usuarios/${userId}`);

        elNome.textContent = u.perfil?.nome || "Sem nome";
        elLocal.textContent = `${u.perfil?.cidade || ""} ${u.perfil?.estado || ""}`.trim();
        elBio.textContent = u.perfil?.bio || "";

        // ✅ foto principal: tenta fotoPrincipal, senão acha no array fotos
        const fotos = Array.isArray(u.fotos) ? u.fotos : [];
        const fotoPrincipalObj = fotos.find((f) => f.principal) || fotos[0] || null;

        const principalUrl =
            u.fotoPrincipal ? fullUrl(u.fotoPrincipal) :
                (fotoPrincipalObj?.url ? fullUrl(fotoPrincipalObj.url) : "");

        setHero(principalUrl);

        // ✅ galeria
        if (!fotos.length) {
            galeria.innerHTML = `<div class="muted">Usuário ainda não tem fotos.</div>`;
        } else {
            galeria.innerHTML = fotos
                .map((f) => {
                    const url = fullUrl(f.url);
                    return `<img class="gFoto" src="${url}" data-url="${url}" alt="foto" />`;
                })
                .join("");

            document.querySelectorAll(".gFoto").forEach((img) => {
                img.onerror = () => (img.style.opacity = 0.25);
                img.onclick = () => {
                    const url = img.getAttribute("data-url");
                    setHero(url);
                    marcarSelecionada(url);
                };
            });

            if (principalUrl) marcarSelecionada(principalUrl);
        }

        // ==============================
        // ✅ Chat: usa o endpoint novo /conversas
        // ==============================
        btnChat.disabled = true;
        btnChat.textContent = "Carregando conversa...";

        const conversas = await apiFetch(`/conversas`);
        const conversa = (Array.isArray(conversas) ? conversas : []).find((c) => {
            // controller novo retorna: outroUsuarioId + outro
            return (c.outroUsuarioId === userId) || (c.outro?.id === userId);
        });

        if (conversa?.id) {
            btnChat.disabled = false;
            btnChat.textContent = "Abrir Chat";
            btnChat.onclick = () => {
                localStorage.setItem("conversaSelecionadaId", conversa.id);
                location.href = "conversas.html";
            };
        } else {
            btnChat.disabled = true;
            btnChat.textContent = "Sem conversa";
        }

        // Voltar
        const voltar = () => history.back();
        if (btnVoltar) btnVoltar.onclick = voltar;
        if (btnVoltarTop) btnVoltarTop.onclick = voltar;

        // Bloquear
        if (btnBloquear) {
            btnBloquear.onclick = async () => {
                if (!confirm("Bloquear este usuário? Isso remove match e conversa.")) return;
                await apiFetch(`/bloqueios/${userId}`, { method: "POST" });
                alert("Usuário bloqueado.");
                location.href = "matches.html";
            };
        }
    } catch (e) {
        msg.textContent = e.message || "Erro ao carregar perfil.";
        if (btnChat) {
            btnChat.disabled = true;
            btnChat.textContent = "Abrir Chat";
        }
    }
}

carregar();
