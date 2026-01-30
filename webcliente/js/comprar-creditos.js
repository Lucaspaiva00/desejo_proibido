// front/js/comprar-creditos.js
const API = (window.APP_API || "http://localhost:3333") + "/api";

function getToken() {
    return localStorage.getItem("token");
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

async function apiFetch(path, { method = "GET", body } = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
        data = await res.json();
    } catch { }

    if (!res.ok) {
        const err = new Error(data?.erro || data?.error || "Erro");
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

function centsToBRL(cents) {
    return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}

async function render() {
    const packsEl = document.querySelector("#packs");
    packsEl.innerHTML = "Carregando pacotes...";

    const packs = await apiFetch("/pagamentos/pacotes");

    packsEl.innerHTML = "";
    packs.forEach((p) => {
        const div = document.createElement("div");
        div.style.border = "1px solid #ddd";
        div.style.padding = "12px";
        div.style.marginBottom = "10px";

        div.innerHTML = `
      <h3>${p.nome}</h3>
      <p><b>${p.creditos}</b> créditos</p>
      <p>R$ ${centsToBRL(p.valorCentavos)}</p>
      <button data-pack="${p.id}">Comprar</button>
    `;

        div.querySelector("button").addEventListener("click", async () => {
            try {
                div.querySelector("button").disabled = true;
                div.querySelector("button").textContent = "Gerando checkout...";

                const resp = await apiFetch("/pagamentos/checkout", {
                    method: "POST",
                    body: { packId: p.id },
                });

                // abre checkout do MP
                window.location.href = resp.initPoint;
            } catch (e) {
                alert(e.data?.erro || e.message);
            } finally {
                div.querySelector("button").disabled = false;
                div.querySelector("button").textContent = "Comprar";
            }
        });

        packsEl.appendChild(div);
    });
}

(async function init() {
    // se quiser, dá pra buscar saldo via /conversas/:id/status ou criar endpoint /wallet/me
    // por enquanto, renderiza packs e segue.
    try {
        await render();
    } catch (e) {
        alert(e.data?.erro || e.message);
    }
})();
