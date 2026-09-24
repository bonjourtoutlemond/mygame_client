const SIZE = 8;

const fallbackIconRows = [
  ["heart", "甜心", "甜心头像-icon-256x256.png"],
  ["mint", "薄荷", "甜心头像-icon-256x256 (1).png"],
  ["berry", "莓果", "甜心头像-icon-256x256 (2).png"],
  ["sun", "暖阳", "甜心头像-icon-256x256 (3).png"],
  ["star", "星星", "甜心头像-icon-256x256 (4).png"],
];

const extraFallbackIconFiles = [
  "0a6a1185-1caa-4f7f-8140-c2b09e34dfbb-icon-256x256.png",
  "61f01070-443c-49bc-9e81-bad088dbfe72-icon-256x256.png",
  "725598b5-121d-4bfa-af28-a3a91be2b851-icon-256x256.png",
  "7a724569-1553-450a-851e-c32fa251fedd-icon-256x256.png",
  "82dbc857-7228-4059-b4f9-d042fe0f39c0-icon-256x256.png",
  "8319b506-017d-4b39-8f06-305fc3ca54ff-icon-256x256.png",
  "9167906c-1235-4c0f-a7d4-f1b4647abb24-icon-256x256.png",
  "a73aa02e-2fc3-4dfb-92f3-6aa72de7e4b3-icon-256x256.png",
  "af022bce-7a19-4a84-b3a4-6c4830b918fc-icon-256x256.png",
  "e41ad0c9-eb67-4e38-b0f6-de3a068eb058-icon-256x256.png",
  "e7f046b6-dff8-4d71-9c76-5730ccb5d1fc-icon-256x256.png",
  "ea05a4c1-d6a5-48f3-a4e3-fdc363a4951c-icon-256x256.png",
  "f233d03e-8143-4565-9ead-d85cf50b320a-icon-256x256.png",
  "f572844a-487e-4e20-aa74-4b18e6d0d66e-icon-256x256.png",
];

function iconUrl(fileName) {
  return `../resources/icon/${encodeURIComponent(fileName)}`;
}

function tileIdFromIconFile(fileName, index) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/-icon-256x256$/i, "");
  const id = base.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return id || `icon_${index + 1}`;
}

const fallbackTiles = [
  ...fallbackIconRows.map(([id, name, file]) => ({ id, name, image: iconUrl(file) })),
  ...extraFallbackIconFiles.map((file, index) => ({
    id: tileIdFromIconFile(file, index + fallbackIconRows.length),
    name: `糖果伙伴 ${index + 1}`,
    image: iconUrl(file),
  })),
];

const fallbackSkinRows = [
  ["zodiac_aries", "白羊座", "constellation/150aee206f7ed5fabfa8724ac2419d70-card-512x768.png", "150aee206f7ed5fabfa8724ac2419d70-slap-1024x1024.png"],
  ["zodiac_taurus", "金牛座", "constellation/1991d1344c0b603bb1e6226cbdc4df8d-card-512x768.png", "1991d1344c0b603bb1e6226cbdc4df8d-slap-1024x1024.png"],
  ["zodiac_gemini", "双子座", "constellation/248a39a740a27b1058858d241be9dca2-card-512x768.png", "248a39a740a27b1058858d241be9dca2-slap-1024x1024.png"],
  ["zodiac_cancer", "巨蟹座", "constellation/4f496a0279f670ca8c2e1d457696032c-card-512x768.png", "4f496a0279f670ca8c2e1d457696032c-slap-1024x1024.png"],
  ["zodiac_leo", "狮子座", "constellation/5599d2ae3644c835b08689e77367084d-card-512x768.png", "5599d2ae3644c835b08689e77367084d-slap-1024x1024.png"],
  ["zodiac_virgo", "处女座", "constellation/92a8403e9e660ff3dcc2e54c4c8b542f-card-512x768.png", "92a8403e9e660ff3dcc2e54c4c8b542f-slap-1024x1024.png"],
  ["zodiac_libra", "天秤座", "constellation/b20d4c22422f5e7b389925dab66f0736-card-512x768.png", "b20d4c22422f5e7b389925dab66f0736-slap-1024x1024.png"],
  ["zodiac_scorpio", "天蝎座", "constellation/b67dba4d16d2e50d52eb6d82bf1dbed4-card-512x768.png", "b67dba4d16d2e50d52eb6d82bf1dbed4-slap-1024x1024.png"],
  ["zodiac_sagittarius", "射手座", "constellation/c02dfbcce611d97b314651bba53a34e6-card-512x768.png", "c02dfbcce611d97b314651bba53a34e6-slap-1024x1024.png"],
  ["zodiac_capricorn", "摩羯座", "constellation/f32276163f85ecdee8d2ac77fcbd4679-card-512x768.png", "f32276163f85ecdee8d2ac77fcbd4679-slap-1024x1024.png"],
  ["zodiac_aquarius", "水瓶座", "constellation_zhizhen/09a6bcdefd06cfdd8dd6e58473c326d8-card-512x768.png", "09a6bcdefd06cfdd8dd6e58473c326d8-slap-1024x1024.png"],
  ["zodiac_pisces", "双鱼座", "constellation_zhizhen/ca2f8146228428a8074af677c671072d-card-512x768.png", "ca2f8146228428a8074af677c671072d-slap-1024x1024.png"],
];

const state = {
  local: false,
  user: null,
  profile: null,
  config: null,
  levels: [],
  skins: [],
  albums: [],
  selectedLevelId: 1,
  session: null,
  board: [],
  selectedTile: null,
  score: 0,
  timeLeft: 0,
  movesLeft: 0,
  combo: 0,
  maxCombo: 0,
  boosters: { time: 1, steps: 1, sweep: 1 },
  timer: null,
  busy: false,
};

const $ = (selector) => document.querySelector(selector);
const boardEl = $("#board");
const loginPanel = $("#loginPanel");
const loginForm = $("#loginForm");
const loginMascot = $("#loginMascot");
const usernameInput = $("#usernameInput");
const passwordInput = $("#passwordInput");
const passwordToggle = $("#passwordToggle");
const playerName = $("#playerName");
const playerStats = $("#playerStats");
const activeSkin = $("#activeSkin");
const levelNumber = $("#levelNumber");
const expText = $("#expText");
const expBar = $("#expBar");
const energyText = $("#energyText");
const energyBar = $("#energyBar");
const levelList = $("#levelList");
const skinGrid = $("#skinGrid");
const albumList = $("#albumList");
const cardCount = $("#cardCount");
const unlockText = $("#unlockText");
const currentLevelName = $("#currentLevelName");
const targetScore = $("#targetScore");
const scoreText = $("#scoreText");
const timerText = $("#timerText");
const comboText = $("#comboText");
const objectiveText = $("#objectiveText");
const startButton = $("#startButton");
const shuffleButton = $("#shuffleButton");
const hintButton = $("#hintButton");
const familySkillButtons = [...document.querySelectorAll(".family-skills button")];
const modal = $("#modal");
const modalImage = $("#modalImage");
const modalKicker = $("#modalKicker");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalAction = $("#modalAction");

function localLevels() {
  return Array.from({ length: 12 }, (_, index) => {
    const level = index + 1;
    const tileCount = Math.min(fallbackTiles.length, 4 + Math.floor(index / 3));
    const tileOffset = fallbackTiles.length ? (index * 2) % fallbackTiles.length : 0;
    return {
      id: level,
      name: `星糖试炼 ${level}`,
      tileCount,
      tileIds: Array.from({ length: tileCount }, (_, tileIndex) => fallbackTiles[(tileOffset + tileIndex) % fallbackTiles.length].id),
      timeLimitSec: Math.max(55, 110 - index * 4),
      moveLimit: Math.max(18, 30 - Math.floor(index / 2)),
      targetScore: 900 + index * 420,
      firstChallengeEnergyCost: 8 + Math.floor(index / 4),
      retryEnergyCost: 4 + Math.floor(index / 5),
      firstClearExp: 80 + index * 22,
      retryClearExp: 26 + index * 8,
      failExp: 5 + Math.floor(index / 3),
      rewardEnergy: level % 3 === 0 ? 12 : 5,
      rewardSkinId: fallbackSkinRows[(level - 1) % fallbackSkinRows.length][0],
    };
  });
}

function localSkins() {
  return fallbackSkinRows.map(([id, name, cardImage, slapImage], index) => ({
    id,
    name,
    rarity: index % 4 === 0 ? "SR" : "R",
    cardImage: `../resources/card/${cardImage}`,
    slapImage: `../resources/slap/${slapImage}`,
    owned: index === 0,
    active: index === 0,
    copies: index === 0 ? 1 : 0,
    fragments: 0,
  }));
}

function buildLocalState(username) {
  const saved = JSON.parse(localStorage.getItem("match3-local-state") || "null");
  const skins = saved?.skins || localSkins();
  const levels = saved?.levels || localLevels().map((level) => ({
    ...level,
    unlocked: level.id === 1,
    firstChallenged: false,
    cleared: false,
    clearCount: 0,
    bestScore: 0,
    bestStars: 0,
    bestTimeLeft: 0,
  }));
  state.local = true;
  state.user = { id: 1, username };
  state.config = {
    tiles: fallbackTiles,
    levels: localLevels(),
    skins,
    albums: [
      {
        id: "album_zodiac",
        name: "星座收集册",
        description: "集齐十二星座卡片后激活，领取大量升级经验。",
        skinIds: skins.slice(0, 12).map((skin) => skin.id),
        rewardExp: 1200,
        rewardEnergy: 30,
      },
    ],
  };
  state.profile = saved?.profile || {
    userId: 1,
    level: 1,
    exp: 0,
    totalExp: 0,
    nextLevelExp: 150,
    energy: 100,
    energyDailyCap: 100,
    highestUnlockedLevel: 1,
    activeSkinId: skins[0].id,
  };
  state.levels = levels;
  state.skins = skins;
  state.albums = deriveLocalAlbums(saved?.albums);
}

function deriveLocalAlbums(saved = []) {
  return state.config.albums.map((album) => {
    const previous = saved.find((item) => item.id === album.id) || {};
    const owned = album.skinIds.filter((id) => state.skins.some((skin) => skin.id === id && skin.owned)).length;
    return {
      ...album,
      progress: owned,
      total: album.skinIds.length,
      complete: owned === album.skinIds.length,
      activated: Boolean(previous.activated),
      rewardClaimed: Boolean(previous.rewardClaimed),
    };
  });
}

function saveLocal() {
  state.albums = deriveLocalAlbums(state.albums);
  localStorage.setItem("match3-local-state", JSON.stringify({
    profile: state.profile,
    levels: state.levels,
    skins: state.skins,
    albums: state.albums,
  }));
}

async function api(path, payload) {
  const options = payload
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
    : {};
  const response = await fetch(path, options);
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || response.statusText);
  return json;
}

function applyPayload(payload) {
  state.local = false;
  state.user = payload.user;
  state.profile = payload.profile;
  state.config = payload.config;
  state.levels = payload.levels;
  state.skins = payload.skins;
  state.albums = payload.albums;
}

function expToNext(level) {
  return 100 + level * 50;
}

function currentLevel() {
  return state.levels.find((level) => level.id === state.selectedLevelId) || state.levels[0];
}

function activeSkinData() {
  return state.skins.find((skin) => skin.id === state.profile?.activeSkinId) || state.skins.find((skin) => skin.owned) || state.skins[0];
}

function renderState() {
  if (!state.profile) return;
  const skin = activeSkinData();
  playerName.textContent = state.user.username;
  playerStats.textContent = `Lv.${state.profile.level} · 精力 ${state.profile.energy}/${state.profile.energyDailyCap}`;
  activeSkin.src = skin?.slapImage || skin?.cardImage || "";
  levelNumber.textContent = state.profile.level;
  expText.textContent = `${state.profile.exp} / ${state.profile.nextLevelExp} EXP`;
  expBar.style.width = `${Math.min(100, (state.profile.exp / state.profile.nextLevelExp) * 100)}%`;
  energyText.textContent = `精力 ${state.profile.energy} / ${state.profile.energyDailyCap}`;
  energyBar.style.width = `${Math.min(100, (state.profile.energy / state.profile.energyDailyCap) * 100)}%`;
  unlockText.textContent = `解锁至 ${state.profile.highestUnlockedLevel}`;
  renderLevels();
  renderSkins();
  renderAlbums();
  renderLevelInfo();
}

function renderLevels() {
  levelList.replaceChildren();
  state.levels.forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${level.id === state.selectedLevelId ? " is-selected" : ""}${level.unlocked ? "" : " is-locked"}`;
    button.disabled = !level.unlocked || Boolean(state.session);
    button.innerHTML = `<strong>${level.id}</strong><span>${level.name}</span><span class="stars">${"★".repeat(level.bestStars || 0)}</span>`;
    button.addEventListener("click", () => {
      state.selectedLevelId = level.id;
      renderState();
    });
    levelList.append(button);
  });
}

function renderSkins() {
  const owned = state.skins.filter((skin) => skin.owned).length;
  cardCount.textContent = `${owned} / ${state.skins.length}`;
  skinGrid.replaceChildren();
  state.skins.forEach((skin) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skin-card${skin.owned ? " is-owned" : ""}${skin.active ? " is-active" : ""}`;
    button.innerHTML = `<img src="${skin.cardImage}" alt="${skin.name}" /><span>${skin.owned ? skin.name : "未获得"}</span>`;
    button.addEventListener("click", () => {
      if (!skin.owned) {
        openModal("Locked", "还没获得这张皮肤卡", "继续挑战关卡可以解锁新卡片。", skin.cardImage);
        return;
      }
      activateSkin(skin.id);
    });
    skinGrid.append(button);
  });
}

function renderAlbums() {
  albumList.replaceChildren();
  state.albums.forEach((album) => {
    const card = document.createElement("article");
    card.className = "album-card";
    const action = album.rewardClaimed ? "已领取" : album.activated ? "领取奖励" : album.complete ? "激活收集册" : "继续收集";
    card.innerHTML = `
      <h3>${album.name}</h3>
      <p>${album.description}<br />进度 ${album.progress}/${album.total} · 奖励 EXP +${album.rewardExp} / 精力 +${album.rewardEnergy}</p>
      <button type="button" ${album.rewardClaimed || !album.complete ? "disabled" : ""}>${action}</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      if (!album.activated) activateAlbum(album.id);
      else claimAlbum(album.id);
    });
    albumList.append(card);
  });
}

function renderLevelInfo() {
  const level = currentLevel();
  if (!level) return;
  currentLevelName.textContent = `${level.id}. ${level.name}`;
  targetScore.textContent = level.targetScore;
  scoreText.textContent = state.score;
  timerText.textContent = state.session ? `${state.timeLeft}s` : "--";
  comboText.textContent = `x${comboMultiplier().toFixed(1)}`;
  const cost = level.firstChallenged ? level.retryEnergyCost : level.firstChallengeEnergyCost;
  const movesText = state.session ? `剩余 ${state.movesLeft} 步` : `${level.moveLimit} 步`;
  objectiveText.textContent = `目标 ${level.targetScore} 分 · ${level.timeLimitSec}s · ${movesText} · 4连造横/竖糖，5连造小爆糖 · 连锁越多分越高`;
  startButton.disabled = !level.unlocked || Boolean(state.session);
  startButton.textContent = level.unlocked ? "开始挑战" : "关卡未解锁";
  familySkillButtons.forEach((button) => {
    const skill = button.dataset.skill;
    button.disabled = !state.session || state.busy || state.boosters[skill] <= 0;
    button.querySelector("span").textContent = `${skillLabel(skill)} x${state.boosters[skill]}`;
  });
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function tileAt(row, col) {
  return state.board[row]?.[col];
}

function setTile(row, col, tile) {
  state.board[row][col] = tile;
}

function cloneTile(tile, power = null) {
  return tile ? { ...tile, power } : null;
}

function comboMultiplier() {
  return 1 + Math.max(0, state.combo - 1) * 0.25;
}

function skillLabel(skill) {
  if (skill === "time") return "+10秒";
  if (skill === "steps") return "+3步";
  return "清5格";
}

function tilesForLevel(level) {
  const allTiles = state.config?.tiles?.length ? state.config.tiles : fallbackTiles;
  if (Array.isArray(level?.tileIds) && level.tileIds.length) {
    const byId = new Map(allTiles.map((tile) => [tile.id, tile]));
    const selected = level.tileIds.map((id) => byId.get(id)).filter(Boolean);
    if (selected.length >= 3) return selected;
  }
  return allTiles.slice(0, level?.tileCount || 5);
}

function createBoard(seed) {
  const level = currentLevel();
  const tiles = tilesForLevel(level);
  const random = seededRandom(seed || Date.now());
  state.board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let tile;
      do {
        tile = cloneTile(tiles[Math.floor(random() * tiles.length)]);
      } while (
        (col >= 2 && state.board[row][col - 1]?.id === tile.id && state.board[row][col - 2]?.id === tile.id) ||
        (row >= 2 && state.board[row - 1][col]?.id === tile.id && state.board[row - 2][col]?.id === tile.id)
      );
      setTile(row, col, tile);
    }
  }
}

function renderBoard() {
  boardEl.replaceChildren();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const tile = tileAt(row, col);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tile";
      if (tile?.power) button.classList.add(`is-power-${tile.power}`);
      if (state.selectedTile?.row === row && state.selectedTile?.col === col) button.classList.add("is-selected");
      button.dataset.row = row;
      button.dataset.col = col;
      const powerLabel = tile?.power === "row" ? "横" : tile?.power === "col" ? "竖" : tile?.power === "bomb" ? "爆" : "";
      button.innerHTML = tile ? `<img src="${tile.image}" alt="${tile.name}" />${powerLabel ? `<span class="power-mark">${powerLabel}</span>` : ""}` : "";
      button.addEventListener("click", () => selectTile(row, col));
      boardEl.append(button);
    }
  }
}

function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swap(a, b) {
  const temp = tileAt(a.row, a.col);
  setTile(a.row, a.col, tileAt(b.row, b.col));
  setTile(b.row, b.col, temp);
}

function findMatchGroups() {
  const groups = [];
  for (let row = 0; row < SIZE; row += 1) {
    let run = 1;
    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && tileAt(row, col)?.id === tileAt(row, col - 1)?.id) run += 1;
      else {
        if (run >= 3) {
          groups.push({
            direction: "row",
            tile: tileAt(row, col - 1),
            cells: Array.from({ length: run }, (_, i) => ({ row, col: col - 1 - i })),
          });
        }
        run = 1;
      }
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    let run = 1;
    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && tileAt(row, col)?.id === tileAt(row - 1, col)?.id) run += 1;
      else {
        if (run >= 3) {
          groups.push({
            direction: "col",
            tile: tileAt(row - 1, col),
            cells: Array.from({ length: run }, (_, i) => ({ row: row - 1 - i, col })),
          });
        }
        run = 1;
      }
    }
  }
  return groups;
}

function findMatches() {
  const hits = new Set();
  findMatchGroups().forEach((group) => group.cells.forEach(({ row, col }) => hits.add(`${row},${col}`)));
  return [...hits].map((key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

function addHit(map, row, col) {
  if (row >= 0 && row < SIZE && col >= 0 && col < SIZE && tileAt(row, col)) {
    map.set(`${row},${col}`, { row, col });
  }
}

function expandedHits(cells) {
  const hits = new Map();
  cells.forEach(({ row, col }) => addHit(hits, row, col));
  let changed = true;
  while (changed) {
    changed = false;
    [...hits.values()].forEach(({ row, col }) => {
      const tile = tileAt(row, col);
      const before = hits.size;
      if (tile?.power === "row") {
        for (let c = 0; c < SIZE; c += 1) addHit(hits, row, c);
      } else if (tile?.power === "col") {
        for (let r = 0; r < SIZE; r += 1) addHit(hits, r, col);
      } else if (tile?.power === "bomb") {
        for (let r = row - 1; r <= row + 1; r += 1) {
          for (let c = col - 1; c <= col + 1; c += 1) addHit(hits, r, c);
        }
      }
      if (hits.size > before) changed = true;
    });
  }
  return hits;
}

function choosePower(group, origin) {
  const longGroups = group
    .filter((item) => item.cells.length >= 4)
    .sort((a, b) => b.cells.length - a.cells.length);
  if (!longGroups.length) return null;
  const best = longGroups[0];
  const originCell = origin && best.cells.find((cell) => cell.row === origin.row && cell.col === origin.col);
  const cell = originCell || best.cells[Math.floor(best.cells.length / 2)];
  return {
    ...cell,
    tile: cloneTile(best.tile, best.cells.length >= 5 ? "bomb" : best.direction),
  };
}

function dropTiles() {
  const level = currentLevel();
  const tiles = tilesForLevel(level);
  for (let col = 0; col < SIZE; col += 1) {
    const stack = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (tileAt(row, col)) stack.push(tileAt(row, col));
    }
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      setTile(row, col, stack.shift() || cloneTile(tiles[Math.floor(Math.random() * tiles.length)]));
    }
  }
}

async function clearCells(cells, scoreReason = "match") {
  const hits = expandedHits(cells);
  hits.forEach(({ row, col }) => {
    const el = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (el) el.classList.add(scoreReason === "skill" ? "is-helped" : "is-clearing");
    setTile(row, col, null);
  });
  state.score += Math.round((hits.size * 40 + Math.max(0, hits.size - 3) * 20) * comboMultiplier());
  renderLevelInfo();
  await new Promise((resolve) => setTimeout(resolve, scoreReason === "skill" ? 210 : 170));
  dropTiles();
  renderBoard();
  await new Promise((resolve) => setTimeout(resolve, 90));
  return hits.size;
}

async function resolveMatches(origin = null) {
  let totalCleared = 0;
  while (true) {
    const groups = findMatchGroups();
    if (!groups.length) break;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const power = choosePower(groups, origin);
    const hits = expandedHits(groups.flatMap((group) => group.cells));
    if (power) hits.delete(`${power.row},${power.col}`);
    totalCleared += await clearCells([...hits.values()]);
    if (power) {
      setTile(power.row, power.col, power.tile);
      renderBoard();
    }
    origin = null;
  }
  if (totalCleared && state.score >= currentLevel().targetScore) await finishGame(true);
}

async function activatePowerCells(cells) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  await clearCells(cells);
  await resolveMatches();
}

async function selectTile(row, col) {
  if (!state.session || state.busy) return;
  const current = { row, col };
  if (!state.selectedTile) {
    state.selectedTile = current;
    renderBoard();
    return;
  }
  const previous = state.selectedTile;
  if (previous.row === row && previous.col === col) {
    state.selectedTile = null;
    renderBoard();
    return;
  }
  if (!adjacent(previous, current)) {
    state.selectedTile = current;
    renderBoard();
    return;
  }
  state.busy = true;
  state.selectedTile = null;
  swap(previous, current);
  renderBoard();
  const powerCells = [previous, current].filter(({ row, col }) => tileAt(row, col)?.power);
  if (!findMatches().length && !powerCells.length) {
    await new Promise((resolve) => setTimeout(resolve, 160));
    swap(previous, current);
    renderBoard();
    state.busy = false;
    return;
  }
  state.movesLeft -= 1;
  state.combo = 0;
  state.maxCombo = 0;
  if (powerCells.length) await activatePowerCells(powerCells);
  else await resolveMatches(current);
  renderBoard();
  if (state.session && state.movesLeft <= 0 && state.score < currentLevel().targetScore) finishGame(false);
  state.busy = false;
}

function shuffleBoard() {
  if (!state.session) return;
  createBoard(Date.now());
  renderBoard();
}

function showHint() {
  const hint = findBestHint();
  const tiles = hint.length
    ? hint.map(({ row, col }) => boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`)).filter(Boolean)
    : [...boardEl.querySelectorAll(".tile")].slice(0, 2);
  tiles.forEach((tile) => tile.classList.add("is-hint"));
  setTimeout(() => tiles.forEach((tile) => tile.classList.remove("is-hint")), 700);
}

function findBestHint() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (next.row >= SIZE || next.col >= SIZE) continue;
        const a = { row, col };
        swap(a, next);
        const works = findMatches().length > 0 || tileAt(a.row, a.col)?.power || tileAt(next.row, next.col)?.power;
        swap(a, next);
        if (works) return [a, next];
      }
    }
  }
  return [];
}

async function useFamilySkill(skill) {
  if (!state.session || state.busy || state.boosters[skill] <= 0) return;
  state.boosters[skill] -= 1;
  if (skill === "time") {
    state.timeLeft += 10;
    openModal("Family Skill", "暖心加时", "家人帮你多争取了 10 秒。", activeSkinData()?.slapImage);
  } else if (skill === "steps") {
    state.movesLeft += 3;
    openModal("Family Skill", "一起想想", "大家一起观察棋盘，额外获得 3 步。", activeSkinData()?.slapImage);
  } else {
    state.busy = true;
    const cells = [];
    const center = { row: Math.floor(SIZE / 2), col: Math.floor(SIZE / 2) };
    for (let row = center.row - 1; row <= center.row + 1; row += 1) {
      for (let col = center.col - 1; col <= center.col + 1; col += 1) {
        if (Math.abs(row - center.row) + Math.abs(col - center.col) <= 1) cells.push({ row, col });
      }
    }
    state.combo = Math.max(1, state.combo);
    await clearCells(cells, "skill");
    await resolveMatches();
    state.busy = false;
  }
  renderLevelInfo();
}

async function startGame() {
  if (!state.user) return;
  try {
    let payload;
    if (state.local) {
      const level = currentLevel();
      const cost = level.firstChallenged ? level.retryEnergyCost : level.firstChallengeEnergyCost;
      if (state.profile.energy < cost) throw new Error("精力不足");
      state.profile.energy -= cost;
      level.firstChallenged = true;
      payload = { session: { sessionId: Date.now(), seed: Date.now(), level } };
      saveLocal();
    } else {
      payload = await api("/api/match3/session/start", { userId: state.user.id, levelId: state.selectedLevelId });
      applyPayload(payload);
    }
    state.session = payload.session;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.boosters = { time: 1, steps: 1, sweep: 1 };
    state.timeLeft = currentLevel().timeLimitSec;
    state.movesLeft = currentLevel().moveLimit;
    createBoard(payload.session.seed);
    renderState();
    renderBoard();
    startButton.style.display = "none";
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      state.timeLeft -= 1;
      renderLevelInfo();
      if (state.timeLeft <= 0) finishGame(false);
    }, 1000);
  } catch (error) {
    openModal("Energy", "无法开始挑战", error.message || "请稍后重试。", activeSkinData()?.slapImage);
  }
}

function starsFor(score, level) {
  if (score >= level.targetScore * 1.6) return 3;
  if (score >= level.targetScore * 1.25) return 2;
  return score >= level.targetScore ? 1 : 0;
}

async function finishGame(success) {
  if (!state.session) return;
  clearInterval(state.timer);
  const level = currentLevel();
  const stars = success ? starsFor(state.score, level) : 0;
  const sessionId = state.session.sessionId;
  state.session = null;
  startButton.style.display = "inline-grid";

  if (state.local) {
    const progress = state.levels.find((item) => item.id === level.id);
    const firstClear = success && !progress.cleared;
    const exp = success ? (firstClear ? level.firstClearExp : level.retryClearExp) : level.failExp;
    progress.cleared = Boolean(progress.cleared || success);
    progress.clearCount += success ? 1 : 0;
    progress.bestScore = Math.max(progress.bestScore, state.score);
    progress.bestStars = Math.max(progress.bestStars, stars);
    progress.bestTimeLeft = Math.max(progress.bestTimeLeft || 0, state.timeLeft);
    if (firstClear) {
      state.profile.highestUnlockedLevel = Math.min(state.levels.length, Math.max(state.profile.highestUnlockedLevel, level.id + 1));
      state.profile.energy = Math.min(state.profile.energyDailyCap, state.profile.energy + level.rewardEnergy);
      const skin = state.skins.find((item) => item.id === level.rewardSkinId);
      if (skin) skin.owned = true;
      state.levels.forEach((item) => {
        item.unlocked = item.id <= state.profile.highestUnlockedLevel;
      });
    }
    const fromLevel = state.profile.level;
    state.profile.exp += exp;
    state.profile.totalExp += exp;
    while (state.profile.exp >= expToNext(state.profile.level)) {
      state.profile.exp -= expToNext(state.profile.level);
      state.profile.level += 1;
    }
    state.profile.nextLevelExp = expToNext(state.profile.level);
    saveLocal();
    renderState();
    openResultModal(success, exp, state.profile.level > fromLevel, firstClear ? [{ type: "energy", amount: level.rewardEnergy }] : []);
    return;
  }

  try {
    const payload = await api("/api/match3/session/finish", {
      userId: state.user.id,
      sessionId,
      success,
      score: state.score,
      stars,
      timeLeft: state.timeLeft,
    });
    applyPayload(payload);
    renderState();
    openResultModal(payload.result.success, payload.result.expGained, payload.result.levelUp.leveledUp, payload.result.rewards);
  } catch (error) {
    openModal("Result", "结算失败", error.message || "请刷新后查看进度。", activeSkinData()?.slapImage);
  }
}

function openResultModal(success, exp, leveledUp, rewards) {
  const rewardText = (rewards || []).map((reward) => {
    if (reward.type === "energy") return `精力 +${reward.amount}`;
    if (reward.type === "skin") return `新卡片：${reward.skin.name}`;
    if (reward.type === "fragments") return `碎片 +${reward.amount}`;
    return "";
  }).filter(Boolean).join("，");
  openModal(
    leveledUp ? "Level Up" : success ? "Clear" : "Failed",
    leveledUp ? `恭喜升级到 Lv.${state.profile.level}` : success ? "通关成功" : "挑战失败",
    `获得 EXP +${exp}${rewardText ? `，${rewardText}` : ""}`,
    activeSkinData()?.slapImage
  );
}

async function activateSkin(skinId) {
  if (state.local) {
    state.skins.forEach((skin) => {
      skin.active = skin.id === skinId;
    });
    state.profile.activeSkinId = skinId;
    saveLocal();
    renderState();
    openModal("Skin", "皮肤已激活", "这张卡片会用于主界面和拍脸弹窗。", activeSkinData()?.slapImage);
    return;
  }
  const payload = await api("/api/match3/skins/activate", { userId: state.user.id, skinId });
  applyPayload(payload);
  renderState();
  openModal("Skin", "皮肤已激活", "这张卡片会用于主界面和拍脸弹窗。", activeSkinData()?.slapImage);
}

async function activateAlbum(albumId) {
  if (state.local) {
    const album = state.albums.find((item) => item.id === albumId);
    if (album?.complete) album.activated = true;
    saveLocal();
    renderState();
    return;
  }
  const payload = await api("/api/match3/albums/activate", { userId: state.user.id, albumId });
  applyPayload(payload);
  renderState();
}

async function claimAlbum(albumId) {
  if (state.local) {
    const album = state.albums.find((item) => item.id === albumId);
    if (!album || !album.activated || album.rewardClaimed) return;
    album.rewardClaimed = true;
    state.profile.energy = Math.min(state.profile.energyDailyCap, state.profile.energy + album.rewardEnergy);
    state.profile.exp += album.rewardExp;
    while (state.profile.exp >= expToNext(state.profile.level)) {
      state.profile.exp -= expToNext(state.profile.level);
      state.profile.level += 1;
    }
    state.profile.nextLevelExp = expToNext(state.profile.level);
    saveLocal();
    renderState();
    openModal("Album", "收集册奖励已领取", "大量经验已经到账，继续收集下一套。", activeSkinData()?.slapImage);
    return;
  }
  const payload = await api("/api/match3/albums/claim", { userId: state.user.id, albumId });
  applyPayload(payload);
  renderState();
  openModal("Album", "收集册奖励已领取", "大量经验已经到账，继续收集下一套。", activeSkinData()?.slapImage);
}

function openModal(kicker, title, body, image) {
  modalKicker.textContent = kicker;
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalImage.src = image || "";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

async function login() {
  const username = usernameInput.value.trim() || "guest";
  try {
    const payload = await api("/api/match3/login", { username, password: passwordInput.value });
    applyPayload(payload);
  } catch {
    buildLocalState(username);
    openModal("Offline", "已进入本地试玩", "当前没有连上服务器，进度会临时存在这个浏览器。", activeSkinData()?.slapImage);
  }
  loginPanel.classList.add("is-hidden");
  state.selectedLevelId = state.profile.highestUnlockedLevel;
  renderState();
  createBoard(Date.now());
  renderBoard();
}

function trackMascotEyes(event) {
  if (!loginMascot || loginPanel.classList.contains("is-hidden")) return;
  const rect = loginMascot.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = Math.max(-1, Math.min(1, (event.clientX - centerX) / 220));
  const dy = Math.max(-1, Math.min(1, (event.clientY - centerY) / 180));
  loginMascot.style.setProperty("--look-x", `${dx * 7}px`);
  loginMascot.style.setProperty("--look-y", `${dy * 5}px`);
}

function setMascotMood(mood, enabled) {
  if (!loginMascot) return;
  loginMascot.classList.toggle(mood, enabled);
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});
document.addEventListener("pointermove", trackMascotEyes);
usernameInput.addEventListener("focus", () => setMascotMood("is-curious", true));
usernameInput.addEventListener("blur", () => setMascotMood("is-curious", false));
passwordInput.addEventListener("focus", () => setMascotMood("is-shy", true));
passwordInput.addEventListener("blur", () => setMascotMood("is-shy", false));
passwordToggle.addEventListener("click", () => {
  const visible = passwordInput.type === "text";
  passwordInput.type = visible ? "password" : "text";
  passwordToggle.textContent = visible ? "看" : "藏";
  setMascotMood("is-peeking", !visible);
  passwordInput.focus();
});
startButton.addEventListener("click", startGame);
shuffleButton.addEventListener("click", shuffleBoard);
hintButton.addEventListener("click", showHint);
familySkillButtons.forEach((button) => button.addEventListener("click", () => useFamilySkill(button.dataset.skill)));
modalAction.addEventListener("click", closeModal);
$("#modalClose").addEventListener("click", closeModal);
document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    button.classList.add("is-active");
    $(`#${button.dataset.view}View`).classList.add("is-active");
  });
});

buildLocalState("guest");
renderState();
createBoard(Date.now());
renderBoard();
