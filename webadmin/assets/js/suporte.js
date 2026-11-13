import { apiFetch } from "./api.js";
import { requireAdmin } from "./auth-guard.js";
import { mountLayout, setTitle } from "./layout.js";

mountLayout("suporte");
setTitle("Suporte");
await requireAdmin();

const root = document.getElementById("pageContent");
const status = document.createElement("p");
status.setAttribute("role", "status");
const lista = document.createElement("div");
const navegacao = document.createElement("div");
root.append(status, lista, navegacao);

function adicionarTexto(container, tag, texto) {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;
  container.append(elemento);
  return elemento;
}

function botao(container, texto, acao) {
  const elemento = adicionarTexto(container, "button", texto);
  elemento.type = "button";
  elemento.className = "btn-admin me-2 mb-2";
  elemento.onclick = acao;
  return elemento;
}

function exibirChamado(chamado, pagina) {
  const card = document.createElement("article");
  card.className = "panel mb-3";
  lista.append(card);
  adicionarTexto(card, "h2", chamado.assunto).className = "h5";
  adicionarTexto(card, "p", `${chamado.usuario.email} · ${new Date(chamado.criadoEm).toLocaleString("pt-BR")}`);
  adicionarTexto(card, "p", chamado.mensagem).style.whiteSpace = "pre-wrap";
  if (chamado.resposta) {
    adicionarTexto(card, "p", `Resposta: ${chamado.resposta}`).style.whiteSpace = "pre-wrap";
    return;
  }

  const campo = document.createElement("textarea");
  campo.className = "form-control mb-2";
  campo.maxLength = 2000;
  campo.setAttribute("aria-label", "Resposta ao chamado");
  card.append(campo);

  const enviar = botao(card, "Enviar resposta", async () => {
    const resposta = campo.value.trim();
    if (!resposta) return campo.focus();
    enviar.disabled = true;
    campo.disabled = true;
    try {
      await apiFetch(`/admin/suporte/${encodeURIComponent(chamado.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ resposta }),
      });
      await carregar(pagina);
    } catch (error) {
      status.textContent = error.message;
      enviar.disabled = false;
      campo.disabled = false;
    }
  });
}

async function carregar(pagina) {
  lista.replaceChildren();
  navegacao.replaceChildren();
  status.textContent = "Carregando chamados…";
  try {
    const { chamados, proximaPagina } = await apiFetch(`/admin/suporte?pagina=${pagina}`);
    status.textContent = chamados.length ? "" : "Nenhum chamado nesta página.";
    for (const chamado of chamados) exibirChamado(chamado, pagina);
    if (pagina > 1) botao(navegacao, "Anterior", () => carregar(pagina - 1));
    if (proximaPagina) botao(navegacao, "Próxima", () => carregar(pagina + 1));
  } catch (error) {
    status.textContent = error.message;
    botao(navegacao, "Tentar novamente", () => carregar(pagina));
  }
}

await carregar(1);
