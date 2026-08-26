import { apiFetch, getToken, logout } from "./api.js";
const $ = (id) => document.getElementById(id);
const els = {
  msg: $("msg"), creatorStatus: $("creatorStatus"), creatorReason: $("creatorReason"), btnSolicitar: $("btnSolicitar"),
  saldoDisponivel: $("saldoDisponivel"), saldoBloqueado: $("saldoBloqueado"), ganhosLives: $("ganhosLives"), ganhosReais: $("ganhosReais"), taxaInfo: $("taxaInfo"),
  saqueValor: $("saqueValor"), pixTipo: $("pixTipo"), pixChave: $("pixChave"), btnSaque: $("btnSaque"), saqueRegra: $("saqueRegra"),
  topApoiadores: $("topApoiadores"), livesBody: $("livesBody"), saquesBody: $("saquesBody"),
};
let statusData = null;
let financeData = null;
function msg(t, cls=""){els.msg.textContent=t||"";els.msg.className=`creatorMsg ${cls}`}
function brl(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
function dt(v){return v?new Date(v).toLocaleString("pt-BR"):"-"}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function statusLabel(s){return ({NAO_SOLICITADO:"Não solicitado",PENDENTE:"Em análise",APROVADA:"Aprovada",BLOQUEADA:"Bloqueada",REPROVADA:"Reprovada"})[s]||s}
function renderStatus(){
  const s=String(statusData?.creatorStatus||"NAO_SOLICITADO").toUpperCase();
  els.creatorStatus.textContent=statusLabel(s); els.creatorStatus.className=`statusBadge ${s.toLowerCase()}`;
  els.creatorReason.textContent=statusData?.creatorMotivo||(!statusData?.maiorDe18?"Conta deve ser 18+.":"");
  els.btnSolicitar.hidden=!statusData?.elegivelParaSolicitar || ["PENDENTE","APROVADA"].includes(s);
  if(statusData?.perfilFeminino===false && statusData?.genero){els.creatorReason.textContent="A área de criadora está disponível para perfis femininos aprovados."}
}
function renderFinance(){
  const f=financeData||{}; const cfg=f.configuracao||statusData?.configuracaoFinanceira||{};
  els.saldoDisponivel.textContent=Number(f.carteira?.disponivel||statusData?.carteira?.disponivel||0).toLocaleString("pt-BR");
  els.saldoBloqueado.textContent=Number(f.carteira?.bloqueado||statusData?.carteira?.bloqueado||0).toLocaleString("pt-BR");
  els.ganhosLives.textContent=Number(f.ganhos?.creditos||0).toLocaleString("pt-BR");
  els.ganhosReais.textContent=brl(f.ganhos?.valorCentavosEstimado||0);
  els.taxaInfo.textContent=`Taxa da plataforma: ${Number(cfg.taxaPlataformaPercent||0)}%`;
  els.saqueValor.min=cfg.saqueMinimoCreditos||1; els.saqueRegra.textContent=`Mínimo: ${Number(cfg.saqueMinimoCreditos||0).toLocaleString("pt-BR")} créditos. Conversão atual: 1 crédito = ${brl(cfg.creditoValorCentavos||0)}.`;
  const top=f.topApoiadores||[]; els.topApoiadores.innerHTML=top.length?top.map((x,i)=>`<div class="supporter"><span>${i+1}. ${esc(x.nome)}</span><strong>${Number(x.creditos||0).toLocaleString("pt-BR")}</strong></div>`).join(""):`<div class="empty">Nenhum presente em live ainda.</div>`;
  const lives=f.lives||[]; els.livesBody.innerHTML=lives.length?lives.map(l=>`<tr><td>${dt(l.criadaEm)}</td><td>${esc(l.titulo||"Ao vivo")}</td><td>${esc(l.status)}</td><td>${Number(l.totalViewers||0)}</td><td>${l.metaCreditos?Number(l.metaCreditos).toLocaleString("pt-BR"):"-"}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Nenhuma live ainda.</td></tr>`;
  const saques=f.saques||[]; els.saquesBody.innerHTML=saques.length?saques.map(s=>`<tr><td>${dt(s.solicitadoEm)}</td><td>${Number(s.valorCreditos||0).toLocaleString("pt-BR")}</td><td>${brl(s.valorCentavos)}</td><td>${esc(s.tipoChavePix)} • ${esc(s.chavePix)}</td><td>${esc(s.status)}</td><td>${esc(s.observacao||"-")}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">Nenhum saque solicitado.</td></tr>`;
  els.btnSaque.disabled=!statusData?.podeTransmitir;
}
async function load(){
  statusData=await apiFetch("/criadora/status"); renderStatus();
  financeData=await apiFetch("/criadora/financeiro"); renderFinance();
}
els.btnSolicitar.addEventListener("click",async()=>{els.btnSolicitar.disabled=true;try{await apiFetch("/criadora/solicitar",{method:"POST"});msg("Solicitação enviada para análise.","success");await load()}catch(e){msg(e.message,"error")}finally{els.btnSolicitar.disabled=false}});
els.btnSaque.addEventListener("click",async()=>{const valor=Math.trunc(Number(els.saqueValor.value));if(!valor||!els.pixChave.value.trim()){msg("Preencha valor e chave PIX.","error");return}els.btnSaque.disabled=true;try{await apiFetch("/criadora/saques",{method:"POST",body:{valorCreditos:valor,tipoChavePix:els.pixTipo.value,chavePix:els.pixChave.value.trim()}});els.saqueValor.value="";els.pixChave.value="";msg("Saque solicitado. O valor ficou reservado para processamento.","success");await load()}catch(e){msg(e.message,"error")}finally{els.btnSaque.disabled=!statusData?.podeTransmitir}});
document.getElementById("btnSair")?.addEventListener("click",logout);
if(!getToken()) location.href="index.html"; else load().catch(e=>{if(e.status===401)logout();else msg(e.message||"Erro ao carregar área da criadora","error")});
