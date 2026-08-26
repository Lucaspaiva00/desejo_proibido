import { API_BASE, apiFetch, getToken, logout } from "./api.js";

const $ = (id) => document.getElementById(id);

const els = {
  msg: $("msg"), q: $("q"), btnReload: $("btnReload"), liveList: $("liveList"), listSub: $("listSub"),
  saldoPill: $("saldoPill"), minutosPill: $("minutosPill"), btnComprarTopo: $("btnComprarTopo"),
  roomTitle: $("roomTitle"), roomSub: $("roomSub"), roomStatus: $("roomStatus"), viewersPill: $("viewersPill"),
  hostAvatar: $("hostAvatar"), hostFallback: $("hostFallback"),
  btnJoin: $("btnJoin"), btnLeave: $("btnLeave"), btnEndLive: $("btnEndLive"),
  player: $("player"), liveVideo: $("liveVideo"), videoPlaceholder: $("videoPlaceholder"),
  playerTitle: $("playerTitle"), playerText: $("playerText"), giftBurstLayer: $("giftBurstLayer"),
  roomHint: $("roomHint"), btnChat: $("btnChat"), btnPresentes: $("btnPresentes"),
  startBox: $("startBox"), liveTitulo: $("liveTitulo"), btnStart: $("btnStart"), startHint: $("startHint"),
  hostSummary: $("hostSummary"), hostViewers: $("hostViewers"), hostTotalViewers: $("hostTotalViewers"), hostGanhos: $("hostGanhos"),
  chatDrawer: $("chatDrawer"), btnChatClose: $("btnChatClose"), chatInfo: $("chatInfo"), msgs: $("msgs"), texto: $("texto"), btnEnviar: $("btnEnviar"),
  giftDrawer: $("giftDrawer"), btnGiftClose: $("btnGiftClose"), giftGrid: $("giftGrid"), tipValor: $("tipValor"), tipMensagem: $("tipMensagem"), btnEnviarGorjeta: $("btnEnviarGorjeta"),
  drawerOverlay: $("drawerOverlay"),
};

const state = {
  status: null,
  genero: "",
  isHost: false,
  lives: [],
  selected: null,
  liveId: null,
  joined: false,
  broadcasting: false,
  socket: null,
  socketConnectedBefore: false,
  localStream: null,
  remoteStream: null,
  hostPeers: new Map(), // viewerSocketId -> { pc, pendingIce }
  viewerPeer: null,
  viewerPendingIce: [],
  hostSocketId: null,
  tickTimer: null,
  summaryTimer: null,
  listReloadTimer: null,
  presentes: [],
  giftsLoaded: false,
};

const ICE_SERVERS = window.DP_ICE_SERVERS || [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function setMsg(text, type = "muted") {
  els.msg.textContent = text || "";
  els.msg.className = `msgline ${type}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  const words = String(name || "DP").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join("") || "DP").toUpperCase();
}

function assetUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${location.origin}${url}`;
  return url;
}

function socketOrigin() {
  try { return new URL(API_BASE, location.href).origin; }
  catch { return location.origin; }
}

function setVideo(stream, { muted = false } = {}) {
  els.liveVideo.srcObject = stream || null;
  els.liveVideo.muted = !!muted;
  if (stream) {
    els.liveVideo.classList.add("visible");
    els.videoPlaceholder.hidden = true;
    els.liveVideo.play().catch(() => {});
  } else {
    els.liveVideo.classList.remove("visible");
    els.videoPlaceholder.hidden = false;
  }
}

function setAvatar(host) {
  const nome = host?.nome || "Desejo Proibido";
  const foto = host?.foto;
  els.hostFallback.textContent = initials(nome);
  if (foto) {
    els.hostAvatar.src = assetUrl(foto);
    els.hostAvatar.style.display = "block";
    els.hostFallback.style.display = "none";
    els.hostAvatar.onerror = () => {
      els.hostAvatar.style.display = "none";
      els.hostFallback.style.display = "grid";
    };
  } else {
    els.hostAvatar.removeAttribute("src");
    els.hostAvatar.style.display = "none";
    els.hostFallback.style.display = "grid";
  }
}

function updateWalletUi({ saldoCreditos, minutosDisponiveis } = {}) {
  if (saldoCreditos != null) {
    if (state.status) state.status.saldoCreditos = Number(saldoCreditos || 0);
    els.saldoPill.textContent = `💳 Créditos: ${Number(saldoCreditos || 0)}`;
  }
  if (minutosDisponiveis != null) {
    if (state.status) state.status.minutosDisponiveis = Number(minutosDisponiveis || 0);
    els.minutosPill.textContent = `⏱ Minutos: ${Number(minutosDisponiveis || 0)}`;
  }
}

function showSelectedLive(live) {
  state.selected = live || null;
  if (!live) {
    els.roomTitle.textContent = state.isHost ? "Sua transmissão" : "Selecione uma live";
    els.roomSub.textContent = state.isHost ? "Ative câmera e microfone para entrar ao vivo." : "Escolha uma transmissão para assistir.";
    els.roomStatus.textContent = "● Aguardando";
    els.viewersPill.textContent = "👁 0";
    setAvatar(null);
    if (!state.broadcasting && !state.joined) setVideo(null);
    els.btnJoin.disabled = true;
    return;
  }

  const host = live.host || {};
  els.roomTitle.textContent = `${host.nome || "Host"}${live.titulo ? ` — ${live.titulo}` : ""}`;
  els.roomSub.textContent = [host.cidade, host.estado].filter(Boolean).join(" / ") || "Ao vivo agora";
  els.roomStatus.textContent = "● AO VIVO";
  els.viewersPill.textContent = `👁 ${Number(live.viewersOnline || 0)}`;
  setAvatar(host);

  if (!state.isHost && !state.joined) {
    els.btnJoin.disabled = false;
    els.roomHint.textContent = "Entre para assistir, conversar e enviar presentes.";
  }
  renderLives();
}

function renderLives() {
  const term = String(els.q.value || "").trim().toLowerCase();
  const items = state.lives.filter((live) => {
    if (!term) return true;
    return `${live.host?.nome || ""} ${live.titulo || ""} ${live.host?.cidade || ""}`.toLowerCase().includes(term);
  });

  if (!items.length) {
    els.liveList.innerHTML = `<div class="empty">${term ? "Nenhuma live encontrada." : "Nenhuma live ao vivo neste momento."}</div>`;
    return;
  }

  els.liveList.innerHTML = items.map((live) => {
    const active = state.selected?.id === live.id ? " active" : "";
    const foto = live.host?.foto;
    return `
      <button class="liveCard${active}" type="button" data-live-id="${escapeHtml(live.id)}">
        <div class="liveThumb">
          ${foto ? `<img src="${escapeHtml(assetUrl(foto))}" alt="" />` : `<div class="liveThumbFallback">${escapeHtml(initials(live.host?.nome))}</div>`}
        </div>
        <div>
          <div class="liveCardName"><span class="liveDot"></span>${escapeHtml(live.host?.nome || "Host")}</div>
          <div class="liveCardTitle">${escapeHtml(live.titulo || "Ao vivo")}</div>
          <div class="liveCardMeta">${escapeHtml([live.host?.cidade, live.host?.estado].filter(Boolean).join(" / ") || "Desejo Proibido")}</div>
        </div>
        <div class="liveCardMeta">👁 ${Number(live.viewersOnline || 0)}</div>
      </button>`;
  }).join("");

  els.liveList.querySelectorAll("[data-live-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const live = state.lives.find((x) => x.id === btn.dataset.liveId);
      if (!live) return;
      if (state.isHost && state.broadcasting && state.liveId !== live.id) {
        setMsg("Sua live está ativa. Encerre a transmissão antes de navegar para outra sala.", "error");
        return;
      }
      if (state.joined && state.liveId !== live.id) {
        setMsg("Saia da live atual antes de entrar em outra.", "error");
        return;
      }
      showSelectedLive(live);
    });
  });
}

async function loadLives({ silent = false } = {}) {
  try {
    if (!silent) els.listSub.textContent = "Atualizando transmissões...";
    const data = await apiFetch("/lives");
    state.lives = Array.isArray(data?.items) ? data.items : [];
    els.listSub.textContent = state.isHost
      ? "Sua live aparece aqui assim que for iniciada."
      : `${state.lives.length} transmissão(ões) disponível(is)`;

    if (state.selected) {
      const updated = state.lives.find((x) => x.id === state.selected.id);
      if (updated) {
        state.selected = updated;
        els.viewersPill.textContent = `👁 ${Number(updated.viewersOnline || 0)}`;
      } else if (!state.broadcasting && !state.joined) {
        showSelectedLive(null);
      }
    }
    renderLives();
  } catch (e) {
    els.listSub.textContent = "Não foi possível atualizar as lives.";
    if (!silent) setMsg(e.message || "Erro ao carregar lives", "error");
  }
}

async function loadStatus() {
  const data = await apiFetch("/lives/status");
  state.status = data;
  state.genero = String(data?.genero || "").toUpperCase();
  state.isHost = state.genero === "F";
  updateWalletUi(data);

  els.startBox.hidden = !state.isHost;
  els.hostSummary.hidden = !state.isHost;
  els.btnEndLive.hidden = true;

  if (state.isHost) {
    els.btnJoin.hidden = true;
    els.btnLeave.hidden = true;
    els.btnPresentes.disabled = true;
    els.startHint.textContent = "Você pode abrir uma live e receber presentes ou gorjetas em créditos diretamente na carteira.";

    if (data.liveAtiva) {
      state.liveId = data.liveAtiva.id;
      showSelectedLive(data.liveAtiva);
      els.btnStart.textContent = "Retomar câmera";
      els.liveTitulo.value = data.liveAtiva.titulo || "";
      els.roomHint.textContent = "Sua live já está ativa. Retome a câmera ou encerre a transmissão.";
      els.btnEndLive.hidden = false;
    } else {
      state.liveId = null;
      state.selected = null;
      showSelectedLive(null);
      els.btnStart.textContent = "Iniciar live";
      els.roomHint.textContent = "Defina um título e inicie sua transmissão.";
    }
  } else if (state.genero === "M") {
    els.startBox.hidden = true;
    els.hostSummary.hidden = true;
    els.btnJoin.hidden = false;
    els.btnLeave.hidden = true;
    els.btnEndLive.hidden = true;
    els.btnPresentes.disabled = true;
  } else {
    els.startBox.hidden = true;
    els.btnJoin.hidden = false;
    els.btnJoin.disabled = true;
    setMsg("Complete o perfil e informe o gênero antes de usar as lives.", "error");
  }
}

async function ensureSocketClient() {
  if (window.io) return;
  const src = `${socketOrigin()}/api/socket.io/socket.io.js`;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dp-socket="1"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dpSocket = "1";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Não foi possível carregar o Socket.IO"));
    document.head.appendChild(script);
  });
}

function socketEmitAck(event, payload, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    if (!state.socket?.connected) return reject(new Error("Conexão em tempo real indisponível"));
    const timer = setTimeout(() => reject(new Error("Tempo esgotado na conexão da live")), timeoutMs);
    state.socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      if (response?.ok === false) return reject(new Error(response.error || "Falha na live"));
      resolve(response || { ok: true });
    });
  });
}

async function connectSocket() {
  if (state.socket?.connected) return state.socket;
  await ensureSocketClient();

  if (!state.socket) {
    state.socket = window.io(socketOrigin(), {
      path: "/api/socket.io",
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      timeout: 10000,
    });
    bindSocketEvents();
  }

  if (state.socket.connected) return state.socket;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Não foi possível conectar o tempo real")), 11000);
    state.socket.once("connect", () => { clearTimeout(timer); resolve(); });
    state.socket.once("connect_error", (e) => { clearTimeout(timer); reject(e); });
  });
  return state.socket;
}

function scheduleLivesReload() {
  clearTimeout(state.listReloadTimer);
  state.listReloadTimer = setTimeout(() => loadLives({ silent: true }), 450);
}

function bindSocketEvents() {
  const socket = state.socket;

  socket.on("connect", async () => {
    els.roomStatus.textContent = state.liveId ? "● Conectado" : els.roomStatus.textContent;
    if (state.socketConnectedBefore && state.liveId) {
      try {
        if (state.broadcasting) {
          await socketEmitAck("live:host:join", { liveId: state.liveId });
        } else if (state.joined) {
          const reentered = await apiFetch(`/lives/${state.liveId}/entrar`, { method: "POST" });
          updateWalletUi({ minutosDisponiveis: reentered?.saldoMinutos });
          await socketEmitAck("live:viewer:join", { liveId: state.liveId });
        }
      } catch (e) {
        setMsg(`Reconexão da live: ${e.message}`, "error");
      }
    }
    state.socketConnectedBefore = true;
  });

  socket.on("disconnect", () => {
    if (state.broadcasting || state.joined) {
      els.roomStatus.textContent = "● Reconectando...";
    }
  });

  socket.on("live:list:update", scheduleLivesReload);

  socket.on("live:viewers:update", ({ liveId, viewersOnline }) => {
    const live = state.lives.find((x) => x.id === liveId);
    if (live) live.viewersOnline = Number(viewersOnline || 0);
    if (state.liveId === liveId || state.selected?.id === liveId) {
      els.viewersPill.textContent = `👁 ${Number(viewersOnline || 0)}`;
      els.hostViewers.textContent = Number(viewersOnline || 0);
    }
    renderLives();
  });

  socket.on("live:viewer:joined", async ({ liveId, viewerSocketId }) => {
    if (!state.broadcasting || state.liveId !== liveId || !viewerSocketId) return;
    try { await createHostPeer(viewerSocketId); }
    catch (e) { console.error("host peer:", e); }
  });

  socket.on("live:viewer:left", ({ liveId, viewerSocketId }) => {
    if (state.liveId !== liveId) return;
    closeHostPeer(viewerSocketId);
  });

  socket.on("live:offer", async ({ liveId, hostSocketId, sdp }) => {
    if (!state.joined || state.liveId !== liveId || !sdp) return;
    try { await handleViewerOffer(hostSocketId, sdp); }
    catch (e) {
      console.error("viewer offer:", e);
      setMsg("Falha ao receber vídeo. Tentando reconectar...", "error");
    }
  });

  socket.on("live:answer", async ({ liveId, viewerSocketId, sdp }) => {
    if (!state.broadcasting || state.liveId !== liveId) return;
    const entry = state.hostPeers.get(viewerSocketId);
    if (!entry || !sdp) return;
    try {
      await entry.pc.setRemoteDescription(sdp);
      await flushIce(entry.pc, entry.pendingIce);
    } catch (e) { console.error("live answer:", e); }
  });

  socket.on("live:ice", async ({ liveId, fromSocketId, candidate }) => {
    if (state.liveId !== liveId || !candidate) return;
    try {
      if (state.broadcasting) {
        const entry = state.hostPeers.get(fromSocketId);
        if (!entry) return;
        if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(candidate);
        else entry.pendingIce.push(candidate);
      } else if (state.joined && state.viewerPeer) {
        if (state.viewerPeer.remoteDescription) await state.viewerPeer.addIceCandidate(candidate);
        else state.viewerPendingIce.push(candidate);
      }
    } catch (e) { console.error("live ice:", e); }
  });

  socket.on("live:chat", (message) => appendChat(message));

  socket.on("live:gift", (evento) => {
    if (evento?.liveId !== state.liveId) return;
    showGiftBurst(evento);
    if (state.isHost) {
      if (evento?.hostSaldoCreditos != null) updateWalletUi({ saldoCreditos: evento.hostSaldoCreditos });
      loadSummary({ silent: true });
    }
  });

  socket.on("live:earning", (evento) => {
    if (!state.isHost || evento?.liveId !== state.liveId) return;
    if (evento.hostSaldoCreditos != null) updateWalletUi({ saldoCreditos: evento.hostSaldoCreditos });
    loadSummary({ silent: true });
  });

  socket.on("wallet:update", ({ saldoCreditos }) => updateWalletUi({ saldoCreditos }));

  socket.on("live:ended", async ({ liveId }) => {
    if (liveId !== state.liveId) return;
    if (!state.isHost) {
      await cleanupViewer({ callApi: false });
      setMsg("A host encerrou a live.", "muted");
      els.roomStatus.textContent = "● Encerrada";
      els.roomHint.textContent = "Escolha outra live para continuar.";
      scheduleLivesReload();
    }
  });

  socket.on("live:host:offline", ({ liveId }) => {
    if (state.joined && state.liveId === liveId) {
      els.roomStatus.textContent = "● Host reconectando...";
      els.roomHint.textContent = "A conexão da host caiu. Aguardando reconexão...";
    }
  });
}

async function getLocalMedia() {
  if (state.localStream?.active) return state.localStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Seu navegador não oferece acesso à câmera/microfone.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  state.localStream = stream;
  return stream;
}

function stopLocalMedia() {
  state.localStream?.getTracks()?.forEach((track) => track.stop());
  state.localStream = null;
}

function newPeerConnection() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

async function createHostPeer(viewerSocketId) {
  if (!state.localStream || !state.socket?.connected) return;
  closeHostPeer(viewerSocketId);

  const pc = newPeerConnection();
  const entry = { pc, pendingIce: [] };
  state.hostPeers.set(viewerSocketId, entry);

  state.localStream.getTracks().forEach((track) => pc.addTrack(track, state.localStream));
  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    state.socket.emit("live:ice", { liveId: state.liveId, targetSocketId: viewerSocketId, candidate });
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(pc.connectionState)) closeHostPeer(viewerSocketId);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  state.socket.emit("live:offer", { liveId: state.liveId, viewerSocketId, sdp: pc.localDescription });
}

function closeHostPeer(viewerSocketId) {
  const entry = state.hostPeers.get(viewerSocketId);
  if (entry) {
    try { entry.pc.close(); } catch {}
    state.hostPeers.delete(viewerSocketId);
  }
}

function closeAllHostPeers() {
  [...state.hostPeers.keys()].forEach(closeHostPeer);
}

async function flushIce(pc, queue) {
  while (queue.length) {
    const candidate = queue.shift();
    try { await pc.addIceCandidate(candidate); } catch (e) { console.warn("ICE descartado", e); }
  }
}

async function handleViewerOffer(hostSocketId, sdp) {
  if (state.viewerPeer) {
    try { state.viewerPeer.close(); } catch {}
  }
  state.viewerPendingIce = [];
  state.hostSocketId = hostSocketId;

  const pc = newPeerConnection();
  state.viewerPeer = pc;

  pc.ontrack = (event) => {
    const stream = event.streams?.[0] || state.remoteStream || new MediaStream();
    if (!event.streams?.[0]) stream.addTrack(event.track);
    state.remoteStream = stream;
    setVideo(stream, { muted: false });
    els.roomStatus.textContent = "● AO VIVO";
    els.roomHint.textContent = "Você está assistindo ao vivo.";
  };

  pc.onicecandidate = ({ candidate }) => {
    if (!candidate || !state.hostSocketId) return;
    state.socket.emit("live:ice", {
      liveId: state.liveId,
      targetSocketId: state.hostSocketId,
      candidate,
    });
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      els.roomStatus.textContent = "● AO VIVO";
    } else if (["failed", "disconnected"].includes(pc.connectionState)) {
      els.roomStatus.textContent = "● Reconectando vídeo...";
    }
  };

  await pc.setRemoteDescription(sdp);
  await flushIce(pc, state.viewerPendingIce);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  state.socket.emit("live:answer", {
    liveId: state.liveId,
    hostSocketId,
    sdp: pc.localDescription,
  });
}

function closeViewerPeer() {
  if (state.viewerPeer) {
    try { state.viewerPeer.close(); } catch {}
  }
  state.viewerPeer = null;
  state.viewerPendingIce = [];
  state.hostSocketId = null;
  state.remoteStream = null;
  if (!state.broadcasting) setVideo(null);
}

async function startHostBroadcast() {
  if (!state.isHost) return;
  els.btnStart.disabled = true;
  setMsg("Preparando câmera e microfone...");

  let createdNow = false;
  try {
    const stream = await getLocalMedia();
    setVideo(stream, { muted: true });

    let liveId = state.status?.liveAtiva?.id || state.liveId;
    let liveData = state.status?.liveAtiva || null;

    if (!liveId) {
      const started = await apiFetch("/lives/iniciar", {
        method: "POST",
        body: { titulo: els.liveTitulo.value.trim() || null },
      });
      liveId = started.liveId;
      createdNow = true;
      await loadStatus();
      liveData = state.status?.liveAtiva || {
        id: liveId,
        titulo: els.liveTitulo.value.trim() || null,
        host: { id: state.status?.userId, nome: state.status?.nome || "Você" },
        viewersOnline: 0,
      };
    }

    state.liveId = liveId;
    state.broadcasting = true;
    state.joined = false;
    if (liveData) showSelectedLive(liveData);

    await connectSocket();
    await socketEmitAck("live:host:join", { liveId });

    els.startBox.hidden = true;
    els.btnStart.hidden = true;
    els.btnEndLive.hidden = false;
    els.btnChat.disabled = false;
    els.btnPresentes.disabled = true;
    els.texto.disabled = false;
    els.btnEnviar.disabled = false;
    els.chatInfo.textContent = "Chat da sua transmissão";
    els.roomStatus.textContent = "● AO VIVO";
    els.roomHint.textContent = "Você está ao vivo. Mantenha esta página aberta durante a transmissão.";
    els.playerTitle.textContent = "Sua câmera";
    els.playerText.textContent = "Prévia da sua transmissão.";
    setMsg(createdNow ? "Live iniciada com sucesso." : "Transmissão retomada com sucesso.", "success");

    startSummaryPolling();
    await loadSummary({ silent: true });
    await loadLives({ silent: true });
  } catch (e) {
    state.broadcasting = false;
    els.btnStart.hidden = false;
    els.btnStart.disabled = false;
    if (!state.status?.liveAtiva) {
      stopLocalMedia();
      setVideo(null);
    }
    setMsg(e.message || "Não foi possível iniciar a live.", "error");
  }
}

async function endHostLive() {
  if (!state.isHost || !state.liveId) return;
  if (!confirm("Encerrar esta live agora?")) return;

  els.btnEndLive.disabled = true;
  try {
    const liveId = state.liveId;
    const result = await apiFetch(`/lives/${liveId}/encerrar`, { method: "POST" });
    if (state.socket?.connected) {
      state.socket.emit("live:leave", { liveId }, () => {});
    }
    stopSummaryPolling();
    closeAllHostPeers();
    stopLocalMedia();
    state.broadcasting = false;
    state.liveId = null;
    state.selected = null;
    setVideo(null);

    els.btnStart.hidden = false;
    els.btnStart.disabled = false;
    els.btnStart.textContent = "Iniciar live";
    els.btnEndLive.hidden = true;
    els.btnChat.disabled = true;
    els.texto.disabled = true;
    els.btnEnviar.disabled = true;
    els.roomStatus.textContent = "● Encerrada";
    els.roomHint.textContent = `Live encerrada. Ganhos: ${Number(result?.ganhosCreditos || 0)} créditos.`;
    setMsg("Live encerrada com sucesso.", "success");

    await loadStatus();
    await loadLives({ silent: true });
  } catch (e) {
    setMsg(e.message || "Erro ao encerrar live", "error");
  } finally {
    els.btnEndLive.disabled = false;
  }
}

async function joinSelectedLive() {
  if (state.isHost || state.joined || !state.selected?.id) return;
  const live = state.selected;
  els.btnJoin.disabled = true;
  setMsg("Entrando na live...");

  try {
    const joined = await apiFetch(`/lives/${live.id}/entrar`, { method: "POST" });
    state.liveId = live.id;
    state.joined = true;
    updateWalletUi({ minutosDisponiveis: joined?.saldoMinutos });

    await connectSocket();
    const ack = await socketEmitAck("live:viewer:join", { liveId: live.id });

    els.btnJoin.hidden = true;
    els.btnLeave.hidden = false;
    els.btnLeave.disabled = false;
    els.btnChat.disabled = false;
    els.btnPresentes.disabled = false;
    els.texto.disabled = false;
    els.btnEnviar.disabled = false;
    els.chatInfo.textContent = `Chat com ${live.host?.nome || "a host"}`;
    els.roomStatus.textContent = ack?.hostOnline ? "● Conectando vídeo..." : "● Aguardando host...";
    els.roomHint.textContent = "Conectando à transmissão...";
    els.playerTitle.textContent = "Conectando ao vídeo";
    els.playerText.textContent = "A transmissão aparecerá assim que a conexão WebRTC for estabelecida.";
    setMsg("Você entrou na live.", "success");

    startTicking();
    await loadGifts();
  } catch (e) {
    state.joined = false;
    state.liveId = null;
    els.btnJoin.disabled = false;
    if (e?.status === 402 || /minuto/i.test(e.message || "")) {
      setMsg("Você está sem minutos disponíveis para assistir.", "error");
    } else {
      setMsg(e.message || "Não foi possível entrar na live.", "error");
    }
  }
}

async function leaveViewerLive() {
  if (!state.joined || !state.liveId) return;
  await cleanupViewer({ callApi: true });
  setMsg("Você saiu da live.");
  await loadLives({ silent: true });
}

async function cleanupViewer({ callApi }) {
  const liveId = state.liveId;
  stopTicking();
  closeViewerPeer();

  if (liveId && callApi) {
    try { await apiFetch(`/lives/${liveId}/sair`, { method: "POST" }); } catch {}
  }
  if (liveId && state.socket?.connected) {
    try { await socketEmitAck("live:leave", { liveId }, 2500); } catch {}
  }

  state.joined = false;
  state.liveId = null;
  els.btnJoin.hidden = false;
  els.btnJoin.disabled = !state.selected;
  els.btnLeave.hidden = true;
  els.btnPresentes.disabled = true;
  els.btnChat.disabled = true;
  els.texto.disabled = true;
  els.btnEnviar.disabled = true;
  els.roomHint.textContent = "Entre na live para assistir e interagir.";
  closeDrawers();
}

function startTicking() {
  stopTicking();
  state.tickTimer = setInterval(tickLive, 60000);
}

function stopTicking() {
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = null;
}

async function tickLive() {
  if (!state.joined || !state.liveId) return;
  try {
    const data = await apiFetch(`/lives/${state.liveId}/tick`, { method: "POST" });
    updateWalletUi({ minutosDisponiveis: data?.saldoMinutos });
  } catch (e) {
    if (e?.status === 402) {
      updateWalletUi({ minutosDisponiveis: 0 });
      setMsg("Seus minutos acabaram. A live foi encerrada para você.", "error");
      await cleanupViewer({ callApi: false });
    }
  }
}

async function loadSummary({ silent = false } = {}) {
  if (!state.isHost || !state.liveId) return;
  try {
    const data = await apiFetch(`/lives/${state.liveId}/resumo`);
    els.hostViewers.textContent = Number(data?.viewersOnline || 0);
    els.hostTotalViewers.textContent = Number(data?.totalViewers || 0);
    els.hostGanhos.textContent = `${Number(data?.ganhosCreditos || 0)} créditos`;
    els.viewersPill.textContent = `👁 ${Number(data?.viewersOnline || 0)}`;
  } catch (e) {
    if (!silent) setMsg(e.message || "Erro ao carregar resumo", "error");
  }
}

function startSummaryPolling() {
  stopSummaryPolling();
  state.summaryTimer = setInterval(() => loadSummary({ silent: true }), 10000);
}

function stopSummaryPolling() {
  if (state.summaryTimer) clearInterval(state.summaryTimer);
  state.summaryTimer = null;
}

async function loadGifts() {
  if (state.giftsLoaded) return;
  try {
    const data = await apiFetch("/presentes");
    state.presentes = Array.isArray(data) ? data : [];
    state.giftsLoaded = true;
    renderGifts();
  } catch (e) {
    els.giftGrid.innerHTML = `<div class="empty">${escapeHtml(e.message || "Erro ao carregar presentes")}</div>`;
  }
}

function renderGifts() {
  if (!state.presentes.length) {
    els.giftGrid.innerHTML = `<div class="empty">Nenhum presente disponível.</div>`;
    return;
  }
  els.giftGrid.innerHTML = state.presentes.map((gift) => `
    <button type="button" class="giftCard" data-gift-id="${escapeHtml(gift.id)}" ${state.joined ? "" : "disabled"}>
      ${gift.imagemUrl ? `<img src="${escapeHtml(assetUrl(gift.imagemUrl))}" alt="${escapeHtml(gift.nome)}" />` : `<div class="giftBurstIcon">🎁</div>`}
      <span class="giftName">${escapeHtml(gift.nome)}</span>
      <span class="giftCost">${Number(gift.custoCreditos || 0)} créditos</span>
    </button>`).join("");

  els.giftGrid.querySelectorAll("[data-gift-id]").forEach((btn) => {
    btn.addEventListener("click", () => sendGift(btn.dataset.giftId, btn));
  });
}

async function sendGift(presenteId, button) {
  if (!state.joined || !state.liveId) return;
  button.disabled = true;
  try {
    const data = await apiFetch(`/lives/${state.liveId}/presentear`, {
      method: "POST",
      body: { presenteId, mensagem: els.tipMensagem.value.trim() || null },
    });
    updateWalletUi({ saldoCreditos: data?.saldoCreditos });
    setMsg("Presente enviado!", "success");
  } catch (e) {
    if (e?.status === 402) setMsg("Saldo insuficiente. Compre créditos para continuar.", "error");
    else setMsg(e.message || "Erro ao enviar presente", "error");
  } finally {
    button.disabled = false;
  }
}

async function sendTip() {
  if (!state.joined || !state.liveId) return;
  const valor = Number(els.tipValor.value);
  if (!Number.isInteger(valor) || valor <= 0) {
    setMsg("Informe um valor inteiro de créditos para a gorjeta.", "error");
    return;
  }

  els.btnEnviarGorjeta.disabled = true;
  try {
    const data = await apiFetch(`/lives/${state.liveId}/presentear`, {
      method: "POST",
      body: { valorCreditos: valor, mensagem: els.tipMensagem.value.trim() || null },
    });
    updateWalletUi({ saldoCreditos: data?.saldoCreditos });
    els.tipValor.value = "";
    els.tipMensagem.value = "";
    setMsg(`Gorjeta de ${valor} créditos enviada!`, "success");
  } catch (e) {
    if (e?.status === 402) setMsg("Saldo insuficiente. Compre créditos para enviar a gorjeta.", "error");
    else setMsg(e.message || "Erro ao enviar gorjeta", "error");
  } finally {
    els.btnEnviarGorjeta.disabled = false;
  }
}

function showGiftBurst(evento) {
  const card = document.createElement("div");
  card.className = "giftBurst";
  const present = evento?.presente;
  card.innerHTML = `
    ${present?.imagemUrl ? `<img src="${escapeHtml(assetUrl(present.imagemUrl))}" alt="" />` : `<div class="giftBurstIcon">💸</div>`}
    <div>
      <strong>${escapeHtml(evento?.de?.nome || "Alguém")} enviou ${escapeHtml(present?.nome || `${Number(evento?.valorCreditos || 0)} créditos`)}</strong>
      <small>${escapeHtml(evento?.mensagem || (present ? `${Number(evento?.valorCreditos || 0)} créditos para a host` : "Gorjeta para a host"))}</small>
    </div>`;
  els.giftBurstLayer.appendChild(card);
  setTimeout(() => card.remove(), 3500);
}

function appendChat(message) {
  const empty = els.msgs.querySelector(".empty");
  if (empty) empty.remove();
  const mine = message?.userId && message.userId === state.status?.userId;
  const row = document.createElement("div");
  row.className = `msgRow${mine ? " mine" : ""}`;
  const when = message?.criadoEm ? new Date(message.criadoEm) : new Date();
  row.innerHTML = `
    <div class="bubble">
      <div class="bubbleName">${escapeHtml(message?.nome || "Usuário")}</div>
      <div>${escapeHtml(message?.texto || "")}</div>
      <div class="bubbleMeta">${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    </div>`;
  els.msgs.appendChild(row);
  els.msgs.scrollTop = els.msgs.scrollHeight;
}

async function sendChat() {
  const text = String(els.texto.value || "").trim();
  if (!text || !state.liveId || !state.socket?.connected) return;
  const allowed = state.broadcasting || state.joined;
  if (!allowed) return;
  els.btnEnviar.disabled = true;
  try {
    await socketEmitAck("live:chat", { liveId: state.liveId, texto: text });
    els.texto.value = "";
  } catch (e) {
    setMsg(e.message || "Erro ao enviar mensagem", "error");
  } finally {
    els.btnEnviar.disabled = false;
    els.texto.focus();
  }
}

function openDrawer(drawer) {
  closeDrawers();
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  els.drawerOverlay.classList.add("show");
  els.drawerOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeDrawers() {
  [els.chatDrawer, els.giftDrawer].forEach((d) => {
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
  });
  els.drawerOverlay.classList.remove("show");
  els.drawerOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

els.btnSair = $("btnSair");
els.btnSairMobile = $("btnSairMobile");
els.btnSair?.addEventListener("click", logout);
els.btnSairMobile?.addEventListener("click", logout);
els.btnComprarTopo?.addEventListener("click", () => { location.href = "comprar-creditos.html"; });
els.btnReload?.addEventListener("click", () => loadLives());
els.q?.addEventListener("input", renderLives);
els.btnStart?.addEventListener("click", startHostBroadcast);
els.btnEndLive?.addEventListener("click", endHostLive);
els.btnJoin?.addEventListener("click", joinSelectedLive);
els.btnLeave?.addEventListener("click", leaveViewerLive);
els.btnChat?.addEventListener("click", () => openDrawer(els.chatDrawer));
els.btnPresentes?.addEventListener("click", async () => { await loadGifts(); renderGifts(); openDrawer(els.giftDrawer); });
els.btnChatClose?.addEventListener("click", closeDrawers);
els.btnGiftClose?.addEventListener("click", closeDrawers);
els.drawerOverlay?.addEventListener("click", closeDrawers);
els.btnEnviar?.addEventListener("click", sendChat);
els.btnEnviarGorjeta?.addEventListener("click", sendTip);
els.texto?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawers(); });

window.addEventListener("beforeunload", () => {
  stopTicking();
  stopSummaryPolling();
  if (state.joined && state.liveId && state.socket?.connected) {
    state.socket.emit("live:leave", { liveId: state.liveId });
  }
  closeViewerPeer();
  closeAllHostPeers();
  stopLocalMedia();
});

async function init() {
  if (!getToken()) {
    location.href = "index.html";
    return;
  }

  try {
    await loadStatus();
    await loadLives({ silent: true });
    await connectSocket();

    // Se a host recarregou a página durante uma live ativa, tenta retomar a câmera automaticamente.
    if (state.isHost && state.status?.liveAtiva?.id) {
      try { await startHostBroadcast(); }
      catch { /* o botão Retomar câmera permanece disponível */ }
    }
  } catch (e) {
    if (e?.status === 401) {
      logout();
      return;
    }
    setMsg(e.message || "Erro ao iniciar a página de lives", "error");
  }
}

init();
