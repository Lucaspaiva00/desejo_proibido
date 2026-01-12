import { apiFetch, logout } from "./api.js";

const status = document.getElementById("status");
const msg = document.getElementById("msg");

document.getElementById("btnSair").onclick = logout;
document.getElementById("btnIrPerfil").onclick = () => location.href = "perfil.html";
document.getElementById("btnIrFotos").onclick = () => location.href = "fotos.html";

async function carregarStatus() {
    msg.textContent = "";

    let perfil = null;
    let fotos = [];

    try { perfil = await apiFetch("/perfil/me"); } catch (e) { }
    try { fotos = await apiFetch("/fotos/minhas"); } catch (e) { }

    const temPerfil = !!perfil;
    const temFotoPrincipal = (fotos || []).some(f => f.principal);

    status.innerHTML = `
    <h3>Status do seu usuário</h3>
    <p>Perfil: ${temPerfil ? "✅ OK" : "❌ Faltando (crie em Perfil)"}</p>
    <p>Foto principal: ${temFotoPrincipal ? "✅ OK" : "❌ Faltando (suba e torne principal em Fotos)"}</p>
    <p class="muted">Se um usuário não tiver isso, ele não aparece no feed.</p>
  `;
}

document.getElementById("btnTestarFeed").onclick = async () => {
    try {
        msg.textContent = "";
        const r = await apiFetch("/feed?page=1&limit=50");
        msg.textContent = `Feed retornou total=${r.total} | data.length=${r.data?.length || 0}`;
    } catch (e) {
        msg.textContent = e.message;
    }
};

carregarStatus();
