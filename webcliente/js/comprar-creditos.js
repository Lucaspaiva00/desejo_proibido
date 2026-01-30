// front/js/comprar-creditos.js
import { apiFetch } from "./api.js";

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function centsToBRL(cents) {
    return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}

function safeReturnUrl() {
    const ret = getQueryParam("return");
    if (!ret) return null;

    // segurança: evita open redirect maluco
    try {
        const decoded = decodeURIComponent(ret);
        // só permite voltar para o mesmo domínio
        const u = new URL(decoded, window.location.origin);
        if (u.origin !== window.location.origin) return null;
        return u.href;
    } catch {
        return null;
    }
}

async function render() {
    const packsEl = document.querySelector("#packs");
    if (!packsEl) return;

    packsEl.innerHTML = "Carregando pacotes...";

    // ✅ usa o mesmo padrão do sistema (api.js)
    const packs = await apiFetch("/pagamentos/pacotes");

    packsEl.innerHTML = "";

    if (!Array.isArray(packs) || packs.length === 0) {
        packsEl.innerHTML = `<div style="padding:12px;color:#666">Nenhum pacote disponível.</div>`;
        return;
    }

    const returnUrl = safeReturnUrl();

    packs.forEach((p) => {
        const div = document.createElement("div");
        div.style.border = "1px solid #222";
        div.style.borderRadius = "12px";
        div.style.padding = "14px";
        div.style.marginBottom = "12px";
        div.style.background = "rgba(255,255,255,0.03)";

        div.innerHTML = `
      <h3 style="margin:0 0 6px 0">${p.nome || "Pacote"}</h3>
      <p style="margin:0 0 6px 0"><b>${p.creditos ?? "-"}</b> créditos</p>
      <p style="margin:0 0 12px 0">R$ ${centsToBRL(p.valorCentavos)}</p>
      <button class="btnComprar" data-pack="${p.id}" style="padding:10px 14px;border-radius:10px;border:0;cursor:pointer">
        Comprar
      </button>
    `;

        const btn = div.querySelector(".btnComprar");

        btn.addEventListener("click", async () => {
            try {
                btn.disabled = true;
                btn.textContent = "Gerando checkout...";

                // ✅ manda packId e opcionalmente returnUrl (se o teu backend usar)
                const payload = { packId: p.id };
                if (returnUrl) payload.returnUrl = returnUrl;

                const resp = await apiFetch("/pagamentos/checkout", {
                    method: "POST",
                    body: payload,
                });

                // backend deve retornar { initPoint } ou { url }
                const link = resp?.initPoint || resp?.url;
                if (!link) throw new Error("Checkout não retornou URL.");

                window.location.href = link;
            } catch (e) {
                alert(e?.data?.erro || e?.message || "Erro ao gerar checkout");
            } finally {
                btn.disabled = false;
                btn.textContent = "Comprar";
            }
        });

        packsEl.appendChild(div);
    });
}

(async function init() {
    try {
        await render();
    } catch (e) {
        alert(e?.data?.erro || e?.message || "Erro ao carregar pacotes");
    }
})();
