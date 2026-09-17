const STORAGE_KEY = "eat-wheel-config-v1";
const USER_STORAGE_KEY = "eat-wheel-user-v1";
const API_BASE = window.EAT_API_BASE || "";
const DEFAULT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23fff4df'/%3E%3Ccircle cx='400' cy='295' r='188' fill='%23ffffff' stroke='%23172026' stroke-width='16'/%3E%3Cellipse cx='400' cy='306' rx='132' ry='96' fill='%23f2b705'/%3E%3Cpath d='M292 250c55-60 168-50 215 9-54 28-158 27-215-9z' fill='%23e84d36'/%3E%3Cpath d='M262 396h276' stroke='%23172026' stroke-width='18' stroke-linecap='round'/%3E%3Ccircle cx='315' cy='300' r='18' fill='%230f8b8d'/%3E%3Ccircle cx='441' cy='342' r='16' fill='%230f8b8d'/%3E%3Ccircle cx='486' cy='286' r='14' fill='%230f8b8d'/%3E%3Ctext x='400' y='112' text-anchor='middle' font-family='Arial,sans-serif' font-size='58' font-weight='800' fill='%23172026'%3E%E4%BB%8A%E5%A4%A9%E5%90%83%E5%95%A5%3F%3C/text%3E%3C/svg%3E";

const defaultItems = [
  { name: "烤鱼", weight: 3, image: DEFAULT_IMAGE },
  { name: "手抓饭", weight: 2, image: DEFAULT_IMAGE },
  { name: "锅盔", weight: 2, image: DEFAULT_IMAGE },
  { name: "牛肉饭", weight: 3, image: DEFAULT_IMAGE },
  { name: "牛杂饭", weight: 2, image: DEFAULT_IMAGE },
  { name: "牛肉拉面", weight: 3, image: DEFAULT_IMAGE },
];

const palette = ["#e84d36", "#0f8b8d", "#f2b705", "#244b5a", "#f07c41", "#78a83b", "#8d5a97", "#2f7da1"];
const canvas = document.querySelector("#wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = document.querySelector("#spinButton");
const previewResult = document.querySelector("#previewResult");
const itemsList = document.querySelector("#itemsList");
const template = document.querySelector("#itemTemplate");
const addItemButton = document.querySelector("#addItemButton");
const resetButton = document.querySelector("#resetButton");
const modal = document.querySelector("#resultModal");
const modalImage = document.querySelector("#modalImage");
const modalChoice = document.querySelector("#modalChoice");
const closeModalButton = document.querySelector("#closeModalButton");
const againButton = document.querySelector("#againButton");
const usernameInput = document.querySelector("#usernameInput");
const passwordInput = document.querySelector("#passwordInput");
const loginButton = document.querySelector("#loginButton");
const accountHint = document.querySelector("#accountHint");
const loginTitle = document.querySelector("#loginTitle");

let items = loadItems();
let currentUser = loadUser();
let rotation = 0;
let isSpinning = false;
let saveTimer = 0;

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) {
      return saved.map(normalizeItem).filter((item) => item.name);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return structuredClone(defaultItems);
}

function loadUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
    if (saved?.id && saved?.username) {
      return { id: saved.id, username: saved.username };
    }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
  return null;
}

function normalizeItem(item) {
  return {
    name: String(item.name || "").trim(),
    weight: Math.max(0, Number(item.weight) || 0),
    image: String(item.image || DEFAULT_IMAGE).trim() || DEFAULT_IMAGE,
  };
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  scheduleRemoteSave();
}

function getActiveItems() {
  const active = items.map(normalizeItem).filter((item) => item.name && item.weight > 0);
  return active.length ? active : [{ name: "先加个能吃的", weight: 1, image: DEFAULT_IMAGE }];
}

function renderItems() {
  itemsList.replaceChildren();
  items.forEach((item, index) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const nameInput = row.querySelector(".name-input");
    const weightInput = row.querySelector(".weight-input");
    const imageInput = row.querySelector(".image-input");
    const deleteButton = row.querySelector(".delete-button");

    nameInput.value = item.name;
    weightInput.value = item.weight;
    imageInput.value = item.image === DEFAULT_IMAGE ? "" : item.image;

    nameInput.addEventListener("input", () => updateItem(index, { name: nameInput.value }));
    weightInput.addEventListener("input", () => updateItem(index, { weight: weightInput.value }));
    imageInput.addEventListener("input", () => updateItem(index, { image: imageInput.value || DEFAULT_IMAGE }));
    deleteButton.addEventListener("click", () => {
      items.splice(index, 1);
      if (!items.length) {
        items.push({ name: "随便吃点", weight: 1, image: DEFAULT_IMAGE });
      }
      saveItems();
      renderItems();
      drawWheel();
    });

    itemsList.append(row);
  });
}

function updateItem(index, patch) {
  items[index] = normalizeItem({ ...items[index], ...patch });
  saveItems();
  drawWheel();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function setAccountState(message) {
  if (currentUser) {
    loginTitle.textContent = `已登录：${currentUser.username}`;
    usernameInput.value = currentUser.username;
  } else {
    loginTitle.textContent = "登录后保存权重";
  }
  accountHint.textContent = message;
}

async function login() {
  const username = usernameInput.value.trim();
  if (!username) {
    setAccountState("先输入用户名；密码会保存，但当前版本暂不校验。");
    usernameInput.focus();
    return;
  }

  loginButton.disabled = true;
  setAccountState("正在连接服务器...");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password: passwordInput.value }),
    });
    currentUser = data.user;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    items = data.items.map(normalizeItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderItems();
    drawWheel();
    setAccountState("权重已从服务器同步；修改后会自动保存到当前用户。");
  } catch (error) {
    setAccountState(`连接失败：${error.message}`);
  } finally {
    loginButton.disabled = false;
  }
}

function scheduleRemoteSave() {
  if (!currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveRemoteItems().catch((error) => setAccountState(`保存失败：${error.message}`));
  }, 450);
}

async function saveRemoteItems() {
  if (!currentUser) return;
  await api("/api/weights", {
    method: "PUT",
    body: JSON.stringify({ userId: currentUser.id, items: getActiveItems() }),
  });
  setAccountState("权重已保存到服务器。");
}

function drawWheel() {
  const active = getActiveItems();
  const total = active.reduce((sum, item) => sum + item.weight, 0);
  const size = canvas.width;
  const radius = size / 2 - 18;
  const center = size / 2;
  let start = rotation - Math.PI / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);

  active.forEach((item, index) => {
    const angle = (item.weight / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + angle / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 32px Microsoft YaHei, Arial, sans-serif";
    fitText(item.name, radius - 34, 220);
    ctx.restore();

    start += angle;
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#172026";
  ctx.stroke();

  ctx.restore();
}

function fitText(text, x, maxWidth) {
  let size = 32;
  ctx.font = `700 ${size}px Microsoft YaHei, Arial, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    ctx.font = `700 ${size}px Microsoft YaHei, Arial, sans-serif`;
  }
  ctx.fillText(text, x, 0);
}

function pickWeightedItem(active = getActiveItems()) {
  const total = active.reduce((sum, item) => sum + item.weight, 0);
  let ticket = Math.random() * total;
  for (const item of active) {
    ticket -= item.weight;
    if (ticket <= 0) return item;
  }
  return active.at(-1);
}

async function getServerWinner() {
  if (!currentUser) {
    return { winner: pickWeightedItem(), items: getActiveItems() };
  }
  clearTimeout(saveTimer);
  await saveRemoteItems();
  const data = await api("/api/spin", {
    method: "POST",
    body: JSON.stringify({ userId: currentUser.id }),
  });
  return {
    winner: normalizeItem(data.winner),
    items: data.items.map(normalizeItem),
  };
}

async function spin() {
  if (isSpinning) return;
  isSpinning = true;
  spinButton.disabled = true;
  previewResult.textContent = "转盘正在认真纠结";

  let active = getActiveItems();
  let winner = pickWeightedItem(active);
  try {
    const result = await getServerWinner();
    active = result.items.length ? result.items : active;
    winner = result.winner;
  } catch (error) {
    setAccountState(`服务器开奖失败，已使用本地随机：${error.message}`);
  }

  const total = active.reduce((sum, item) => sum + item.weight, 0);
  const winnerIndex = Math.max(
    0,
    active.findIndex((item) => item.name === winner.name)
  );
  const beforeWinner = active.slice(0, winnerIndex).reduce((sum, item) => sum + item.weight, 0);
  const winnerCenter = ((beforeWinner + winner.weight / 2) / total) * Math.PI * 2;
  const targetRotation = normalizeAngle(-winnerCenter);
  const rotationDelta = normalizeAngle(targetRotation - normalizeAngle(rotation));
  const extraTurns = (5 + Math.floor(Math.random() * 3)) * Math.PI * 2;
  const startRotation = rotation;
  const endRotation = startRotation + extraTurns + rotationDelta;
  const duration = 3200;
  const startTime = performance.now();

  function animate(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = startRotation + (endRotation - startRotation) * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = normalizeAngle(targetRotation);
    drawWheel();
    previewResult.textContent = winner.name;
    isSpinning = false;
    spinButton.disabled = false;
    showResult(winner);
  }

  requestAnimationFrame(animate);
}

function normalizeAngle(angle) {
  const circle = Math.PI * 2;
  return ((angle % circle) + circle) % circle;
}

function showResult(item) {
  modalChoice.textContent = item.name;
  modalImage.src = item.image || DEFAULT_IMAGE;
  modalImage.alt = item.name;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

addItemButton.addEventListener("click", () => {
  items.push({ name: "新菜品", weight: 1, image: DEFAULT_IMAGE });
  saveItems();
  renderItems();
  drawWheel();
});

resetButton.addEventListener("click", () => {
  items = structuredClone(defaultItems);
  saveItems();
  renderItems();
  drawWheel();
  previewResult.textContent = "把选择权交给转盘";
});

spinButton.addEventListener("click", spin);
againButton.addEventListener("click", () => {
  closeModal();
  spin();
});
closeModalButton.addEventListener("click", closeModal);
loginButton.addEventListener("click", login);
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

if (currentUser) {
  setAccountState("已读取上次登录用户；点登录可重新同步服务器权重。");
} else {
  setAccountState("服务器会保存用户名、密码和每个用户的权重配置。");
}
renderItems();
drawWheel();
