const state = {
  socket: null,
  version: 1,
  clientKind: matchMedia("(pointer: coarse), (max-width: 720px)").matches ? "mobile-web" : "web",
  connected: false,
  loggedIn: false,
  player: {
    name: "guest",
    level: "-",
    exp: 0,
    game: "-",
  },
};

const $ = (id) => document.getElementById(id);

const els = {
  status: $("status"),
  shard: $("shard"),
  loginName: $("loginName"),
  connectBtn: $("connectBtn"),
  loginBtn: $("loginBtn"),
  quitBtn: $("quitBtn"),
  expBtn: $("expBtn"),
  playersBtn: $("playersBtn"),
  friendsBtn: $("friendsBtn"),
  addFriendBtn: $("addFriendBtn"),
  friendName: $("friendName"),
  players: $("players"),
  friends: $("friends"),
  log: $("log"),
  targetName: $("targetName"),
  message: $("message"),
  sendBtn: $("sendBtn"),
  playerName: $("playerName"),
  playerLevel: $("playerLevel"),
  playerExp: $("playerExp"),
  serverName: $("serverName"),
};

function setStatus(text, online = false) {
  els.status.textContent = text;
  els.status.classList.toggle("online", online);
}

function appendLog(message, kind = "") {
  const entry = document.createElement("p");
  entry.className = `entry ${kind}`.trim();
  entry.innerHTML = message;
  els.log.appendChild(entry);
  els.log.scrollTop = els.log.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPlayer() {
  els.playerName.textContent = state.player.name;
  els.playerLevel.textContent = `Lv ${state.player.level}`;
  els.playerExp.textContent = state.player.exp;
  els.serverName.textContent = state.player.game;
}

function updateButtons() {
  els.connectBtn.disabled = state.connected;
  els.loginBtn.disabled = !state.connected;
  els.quitBtn.disabled = !state.connected;
  els.expBtn.disabled = !state.loggedIn;
  els.playersBtn.disabled = !state.connected;
  els.friendsBtn.disabled = !state.loggedIn;
  els.addFriendBtn.disabled = !state.loggedIn;
  els.sendBtn.disabled = !state.loggedIn;
}

function send(command) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    appendLog("Not connected.", "error");
    return;
  }
  state.socket.send(JSON.stringify({
    version: state.version,
    client: state.clientKind,
    transport: "websocket",
    ...command,
  }));
}

function connect() {
  const shard = els.shard.value;
  setStatus("connecting");
  appendLog(`Connecting to <strong>${escapeHtml(shard)}</strong>...`);
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/ws?shard=${encodeURIComponent(shard)}`);
  state.socket = socket;

  socket.addEventListener("open", () => {
    state.connected = true;
    setStatus("gateway connected", true);
    updateButtons();
  });

  socket.addEventListener("message", (event) => {
    handleLine(event.data);
  });

  socket.addEventListener("close", () => {
    state.connected = false;
    state.loggedIn = false;
    setStatus("disconnected");
    updateButtons();
    appendLog("Connection closed.");
  });

  socket.addEventListener("error", () => {
    appendLog("WebSocket error. Check whether the gateway and game server are running.", "error");
  });
}

function login() {
  const name = els.loginName.value.trim();
  if (!name) {
    appendLog("Enter a player name first.", "error");
    return;
  }
  send({ cmd: "login", name });
}

function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    appendLog(escapeHtml(line));
    return;
  }

  if (message.type === "gateway") {
    if (message.version) {
      state.version = message.version;
    }
    const detail = message.port ? ` ${message.shard}:${message.port}` : "";
    setStatus(message.status === "connected" ? `online${detail}` : message.status, message.status === "connected");
    appendLog(`Gateway: <strong>${escapeHtml(message.status)}</strong>${escapeHtml(detail)}`);
    return;
  }

  if (message.type === "error") {
    appendLog(escapeHtml(message.message || "server error"), "error");
    return;
  }

  if (message.type === "login") {
    state.loggedIn = true;
    state.player = {
      name: message.name,
      level: message.level,
      exp: message.exp,
      game: message.game,
    };
    renderPlayer();
    updateButtons();
    appendLog(`Logged in as <strong>${escapeHtml(message.name)}</strong> on ${escapeHtml(message.game)}.`);
    send({ cmd: "list_players", offset: 0, limit: 12 });
    send({ cmd: "friend_list" });
    return;
  }

  if (message.type === "sendmessage") {
    appendLog(escapeHtml(message.message || ""), "chat");
    return;
  }

  if (message.type === "player") {
    state.player.level = message.level ?? state.player.level;
    state.player.exp = message.exp ?? state.player.exp;
    renderPlayer();
    appendLog(`Updated <strong>${escapeHtml(state.player.name)}</strong>: Lv ${escapeHtml(state.player.level)}, EXP ${escapeHtml(state.player.exp)}.`);
    return;
  }

  if (message.type === "player_list") {
    renderPlayers(message.players || []);
    return;
  }

  if (message.type === "friend_list") {
    renderFriends(message.friends || []);
    return;
  }

  if (["chat", "team", "guild", "message"].includes(message.type)) {
    appendLog(`<strong>${escapeHtml(message.from || "server")}</strong>: ${escapeHtml(message.message || "")}`, "chat");
    return;
  }

  if (message.type === "route" || message.type === "friend_add") {
    appendLog(escapeHtml(message.message || JSON.stringify(message)));
    return;
  }

  if (message.type === "bye") {
    appendLog("Server said bye.");
    state.socket?.close();
    return;
  }

  appendLog(escapeHtml(JSON.stringify(message)));
}

function renderPlayers(players) {
  els.players.innerHTML = "";
  if (!players.length) {
    els.players.innerHTML = '<p class="entry">No players returned.</p>';
    return;
  }
  for (const player of players) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span>${escapeHtml(player.name)} <strong>Lv ${escapeHtml(player.level)}</strong></span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Target";
    button.addEventListener("click", () => {
      els.targetName.value = player.name;
      els.friendName.value = player.name;
    });
    row.appendChild(button);
    els.players.appendChild(row);
  }
}

function renderFriends(friends) {
  els.friends.innerHTML = "";
  if (!friends.length) {
    els.friends.innerHTML = '<p class="entry">No friends yet.</p>';
    return;
  }
  for (const friend of friends) {
    const row = document.createElement("div");
    row.className = "friend-row";
    row.innerHTML = `<span>${escapeHtml(friend)}</span><strong>friend</strong>`;
    row.addEventListener("click", () => {
      els.targetName.value = friend;
    });
    els.friends.appendChild(row);
  }
}

els.connectBtn.addEventListener("click", connect);
els.loginBtn.addEventListener("click", login);
els.quitBtn.addEventListener("click", () => send({ cmd: "quit" }));
els.expBtn.addEventListener("click", () => send({ cmd: "exp", amount: 10 }));
els.playersBtn.addEventListener("click", () => send({ cmd: "list_players", offset: 0, limit: 12 }));
els.friendsBtn.addEventListener("click", () => send({ cmd: "friend_list" }));
els.addFriendBtn.addEventListener("click", () => {
  const target = els.friendName.value.trim();
  if (target) {
    send({ cmd: "friend_add", target });
  }
});
els.sendBtn.addEventListener("click", () => {
  const target = els.targetName.value.trim();
  const message = els.message.value.trim();
  if (!target || !message) {
    appendLog("Choose a target and write a message.", "error");
    return;
  }
  send({ cmd: "say", target, message });
  els.message.value = "";
});

els.message.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    els.sendBtn.click();
  }
});

els.loginName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (!state.connected) {
      connect();
      setTimeout(login, 250);
    } else {
      login();
    }
  }
});

renderPlayer();
updateButtons();
appendLog("Start the gateway, connect to a shard, then login.");
