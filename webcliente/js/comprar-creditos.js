// app/js/comprar-creditos.js
import { apiFetch, getToken } from "./api.js";

const API = {
    saldo: "/carteira",
    pacotes: "/pagamentos/pacotes",
    criarCheckout: "/pagamentos/checkout",
};

const elSaldo = document.getElementById("saldoCreditos");
const elPacks = document.getElementById("packs");
const elSkel = document.getElementById("packsSkeleton");
const btnRecarregar = document.getElementById("btnRecarregar");
const btnReloadPacks = document.getElementById("btnReloadPacks");
const toast = document.getElementById("toast");

function showToast(title, detail = "") {
    toast.innerHTML = `${title}${detail ? `<small>${detail}</small>` : ""}`;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function moneyBRL(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function requireAuthOrRedirect() {
    const token = getToken();
    if (!token) {
        const next = encodeURIComponent(location.href);
        location.href = `index.html?return=${next}`;
        return false;
    }
    return true;
}

// -------------------
// SALDO
// -------------------
async function carregarSaldo() {
    try {
        if (!requireAuthOrRedirect()) return;

        btnRecarregar.disabled = true;

        const data = await apiFetch(API.saldo); // GET /api/carteira
        elSaldo.textContent = String(data?.saldoCreditos ?? 0);
    } catch (err) {
        showToast("Não foi possível carregar o saldo.", err.message);
    } finally {
        btnRecarregar.disabled = false;
    }
}

// -------------------
// PACOTES
// -------------------
function renderPacotes(pacotes) {
    if (!Array.isArray(pacotes) || pacotes.length === 0) {
        elPacks.innerHTML = `
      <div class="pack-card">
        <h3 class="pack-name">Nenhum pacote encontrado</h3>
      </div>
    `;
        return;
    }

    elPacks.innerHTML = pacotes.map((p) => {
        const id = p.id;
        const nome = p.nome;
        const creditos = p.creditos;
        const preco = (p.valorCentavos / 100);

        return `
      <article class="pack-card">
        <div class="pack-top">
          <div>
            <h3 class="pack-name">${nome}</h3>
            <div class="pack-price">${moneyBRL(preco)}</div>
          </div>
          <div class="pack-badge">Premium</div>
        </div>

        <div class="pack-credits">${creditos}<span>créditos</span></div>

        <div class="pack-actions">
          <button class="btn btn-primary" type="button" data-pack="${id}">
            <span class="icon">🛒</span> Comprar
          </button>
          <button class="btn btn-ghost" type="button" data-detalhe="${id}">
            Detalhes
          </button>
        </div>
      </article>
    `;
    }).join("");

    elPacks.querySelectorAll("button[data-pack]").forEach((btn) => {
        btn.addEventListener("click", () => iniciarCheckout(btn.getAttribute("data-pack"), btn));
    });

    elPacks.querySelectorAll("button[data-detalhe]").forEach((btn) => {
        btn.addEventListener("click", () => showToast("Pacote", "Clique em comprar para abrir o checkout."));
    });
}

async function carregarPacotes() {
    try {
        btnReloadPacks.disabled = true;
        elPacks.innerHTML = "";
        elSkel.hidden = false;

        const data = await apiFetch(API.pacotes); // GET /api/pagamentos/pacotes
        renderPacotes(data);
    } catch (err) {
        elPacks.innerHTML = `
      <div class="pack-card">
        <h3 class="pack-name">Erro ao carregar pacotes</h3>
        <div class="pack-price">${err.message}</div>
      </div>
    `;
        showToast("Erro ao carregar pacotes.", err.message);
    } finally {
        elSkel.hidden = true;
        btnReloadPacks.disabled = false;
    }
}

// -------------------
// CHECKOUT MP
// -------------------
async function iniciarCheckout(packId, btn) {
    const originalText = btn.textContent;

    try {
        if (!requireAuthOrRedirect()) return;

        btn.disabled = true;
        btn.textContent = "Gerando checkout...";

        const data = await apiFetch(API.criarCheckout, {
            method: "POST",
            body: { packId },
        });

        const url = data?.initPoint || data?.sandboxInitPoint || data?.init_point || data?.sandbox_init_point;
        if (!url) throw new Error("Backend não retornou a URL do checkout.");

        showToast("Redirecionando...", "Abrindo Mercado Pago.");
        window.location.href = url;
    } catch (err) {
        showToast("Não foi possível iniciar a compra.", err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// -------------------
// INIT
// -------------------
btnRecarregar?.addEventListener("click", carregarSaldo);
btnReloadPacks?.addEventListener("click", carregarPacotes);

carregarPacotes();
carregarSaldo();
