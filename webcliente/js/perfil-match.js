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

const fotoModal = document.getElementById("fotoModal");
const fotoModalImg = document.getElementById("fotoModalImg");
const fotoModalClose = document.getElementById("fotoModalClose");
const fotoModalBackdrop = document.getElementById("fotoModalBackdrop");

let heroAtualUrl = "";

// ==============================
// util
// ==============================
function getUserId() {
    const params = new URL(location.href).searchParams;
    return params.get("userId") || params.get("usuarioId") || params.get("id");
}

function fullUrl(pathOrUrl) {
    if (!pathOrUrl) return "";
    if (String(pathOrUrl).startsWith("http")) return pathOrUrl;
    return `${API_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function openFotoModal(src, alt = "Foto ampliada") {
    if (!fotoModal || !fotoModalImg || !src) return;

    fotoModalImg.src = src;
    fotoModalImg.alt = alt;
    fotoModal.classList.remove("hidden");
    fotoModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
}

function closeFotoModal() {
    if (!fotoModal || !fotoModalImg) return;

    fotoModal.classList.add("hidden");
    fotoModal.setAttribute("aria-hidden", "true");
    fotoModalImg.src = "";
    fotoModalImg.alt = "Foto ampliada";
    document.body.classList.remove("no-scroll");
}

fotoModalClose?.addEventListener("click", closeFotoModal);
fotoModalBackdrop?.addEventListener("click", closeFotoModal);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fotoModal && !fotoModal.classList.contains("hidden")) {
        closeFotoModal();
    }
});

function setHero(url) {
    heroAtualUrl = url || "";

    if (!url) {
        fotoPrincipal.style.display = "none";
        heroFallback.style.display = "flex";
        fotoPrincipal.removeAttribute("src");
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

async function carregar() {
    try {
        msg.textContent = "";

        const userId = getUserId();
        if (!userId) throw new Error("ID do usuário não informado na URL (use ?id=...)");

        const u = await apiFetch(`/usuarios/${userId}`);

        const nome = u.perfil?.nome || "Sem nome";
        const cidade = u.perfil?.cidade || "";
        const estado = u.perfil?.estado || "";
        const bio = u.perfil?.bio || "";

        elNome.textContent = nome;
        elLocal.textContent = `${cidade} ${estado}`.trim();
        elBio.textContent = bio;

        const fotos = Array.isArray(u.fotos) ? u.fotos : [];
        const fotoPrincipalObj = fotos.find((f) => f.principal) || fotos[0] || null;

        const principalUrl =
            u.fotoPrincipal
                ? fullUrl(u.fotoPrincipal)
                : (fotoPrincipalObj?.url ? fullUrl(fotoPrincipalObj.url) : "");

        setHero(principalUrl);

        // clique na hero abre ampliada
        fotoPrincipal.onclick = () => {
            if (!heroAtualUrl) return;
            openFotoModal(heroAtualUrl, `Foto de ${nome}`);
        };

        if (!fotos.length) {
            galeria.innerHTML = `<div class="muted">Usuário ainda não tem fotos.</div>`;
        } else {
            galeria.innerHTML = fotos
                .map((f, index) => {
                    const url = fullUrl(f.url);
                    return `<img class="gFoto" src="${url}" data-url="${url}" alt="Foto ${index + 1} de ${nome}" />`;
                })
                .join("");

            document.querySelectorAll(".gFoto").forEach((img) => {
                img.onerror = () => {
                    img.style.opacity = 0.25;
                };

                img.onclick = () => {
                    const url = img.getAttribute("data-url");
                    setHero(url);
                    marcarSelecionada(url);
                };
            });

            if (principalUrl) marcarSelecionada(principalUrl);
        }

        // conversa
        btnChat.disabled = true;
        btnChat.textContent = "Carregando conversa...";

        const conversas = await apiFetch(`/conversas`);
        const conversa = (Array.isArray(conversas) ? conversas : []).find((c) => {
            return String(c.outroUsuarioId) === String(userId) || String(c.outro?.id) === String(userId);
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

        const voltar = () => history.back();
        if (btnVoltar) btnVoltar.onclick = voltar;
        if (btnVoltarTop) btnVoltarTop.onclick = voltar;

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