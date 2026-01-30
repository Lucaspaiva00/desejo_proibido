// ===============================
// AJUSTE AQUI CONFORME SEU BACKEND
// ===============================
const API = {
    // saldo da carteira
    saldo: "/api/carteira", // ou "/api/wallet" ou "/api/creditos/saldo"

    // pacotes disponíveis
    pacotes: "/api/creditos/pacotes", // deve retornar lista de pacotes

    // criar pagamento no Mercado Pago (backend retorna checkoutUrl/init_point)
    criarCheckout: "/api/pagamentos/mercadopago/checkout"
    // exemplo esperado: POST { packId } -> { checkoutUrl: "https://..." }
};

const elSaldo = document.getElementById("saldoCreditos");
const elPacks = document.getElementById("packs");
const elSkel = document.getElementById("packsSkeleton");
const btnRecarregar = document.getElementById("btnRecarregar");
const btnReloadPacks = document.getElementById("btnReloadPacks");
const toast = document.getElementById("toast");

function showToast(title, detail = "", type = "info") {
    toast.innerHTML = `${title}${detail ? `<small>${detail}</small>` : ""}`;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function moneyBRL(value) {
    // aceita "19.90" ou 19.9
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function apiFetch(url, opts = {}) {
    // Se seu sistema usa auth via token, você pode adicionar aqui
    // const token = localStorage.getItem("token");
    // opts.headers = { ...(opts.headers||{}), Authorization: `Bearer ${token}` };

    const res = await fetch(url, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            ...(opts.headers || {}),
        },
    });

    let data = null;
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (isJson) data = await res.json().catch(() => null);

    if (!res.ok) {
        const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `Erro HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

// -------------------
// SALDO
// -------------------
async function carregarSaldo() {
    try {
        btnRecarregar.disabled = true;
        const data = await apiFetch(API.saldo);

        // Aceita diferentes formatos:
        // { saldoCreditos: 10 } OU { saldo: 10 } OU { credits: 10 }
        const saldo =
            data?.saldoCreditos ?? data?.saldo ?? data?.credits ?? data?.creditos ?? 0;

        elSaldo.textContent = String(saldo);
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
        <div class="pack-price">Verifique o endpoint de pacotes no backend.</div>
        <div class="pack-hint">Se quiser, me manda a resposta JSON que o backend devolve que eu adapto 100%.</div>
      </div>
    `;
        return;
    }

    elPacks.innerHTML = pacotes.map((p, idx) => {
        const id = p.id ?? p.packId ?? p.codigo ?? idx;
        const nome = p.nome ?? p.name ?? `Pacote ${idx + 1}`;
        const creditos = p.creditos ?? p.credits ?? p.qtdCreditos ?? 0;
        const preco = p.preco ?? p.price ?? p.valor ?? null;
        const destaque = p.destaque ?? p.featured ?? false;

        return `
      <article class="pack-card">
        <div class="pack-top">
          <div>
            <h3 class="pack-name">${nome}</h3>
            <div class="pack-price">${preco !== null ? moneyBRL(preco) : "Preço a definir"}</div>
          </div>
          <div class="pack-badge">${destaque ? "Mais vendido" : "Premium"}</div>
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

        <div class="pack-hint">
          Após o pagamento, o saldo será atualizado assim que a confirmação chegar.
        </div>
      </article>
    `;
    }).join("");

    // listeners
    elPacks.querySelectorAll("button[data-pack]").forEach(btn => {
        btn.addEventListener("click", () => iniciarCheckout(btn.getAttribute("data-pack"), btn));
    });

    elPacks.querySelectorAll("button[data-detalhe]").forEach(btn => {
        btn.addEventListener("click", () => {
            showToast("Pacote selecionado", "Finalize a compra para liberar os créditos.");
        });
    });
}

async function carregarPacotes() {
    try {
        btnReloadPacks.disabled = true;
        elPacks.innerHTML = "";
        elSkel.hidden = false;

        const data = await apiFetch(API.pacotes);

        // Aceita: [ ... ] OU { packs: [...] } OU { data: [...] }
        const pacotes = Array.isArray(data) ? data : (data?.packs || data?.data || data?.pacotes || []);
        renderPacotes(pacotes);
    } catch (err) {
        elPacks.innerHTML = `
      <div class="pack-card">
        <h3 class="pack-name">Erro ao carregar pacotes</h3>
        <div class="pack-price">${err.message}</div>
        <div class="pack-hint">Confira se o endpoint <b>${API.pacotes}</b> está retornando JSON corretamente.</div>
      </div>
    `;
        showToast("Erro ao carregar pacotes.", err.message);
    } finally {
        elSkel.hidden = true;
        btnReloadPacks.disabled = false;
    }
}

// -------------------
// MERCADO PAGO CHECKOUT
// -------------------
async function iniciarCheckout(packId, btn) {
    const originalText = btn.textContent;
    try {
        btn.disabled = true;
        btn.textContent = "Gerando checkout...";

        // Backend deve criar a preferência/pagamento e devolver URL de checkout.
        const data = await apiFetch(API.criarCheckout, {
            method: "POST",
            body: JSON.stringify({ packId })
        });

        // Aceita nomes diferentes vindos do backend:
        const url =
            data?.checkoutUrl ||
            data?.init_point ||
            data?.sandbox_init_point ||
            data?.url ||
            data?.link;

        if (!url) {
            throw new Error("Backend não retornou a URL do Mercado Pago (checkoutUrl/init_point).");
        }

        showToast("Redirecionando para o Mercado Pago…", "Se não abrir, verifique bloqueio de pop-up.");
        // Melhor prática: redirecionar na mesma aba
        window.location.href = url;

        // ou se quiser nova aba:
        // window.open(url, "_blank", "noopener,noreferrer");

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

carregarSaldo();
carregarPacotes();
