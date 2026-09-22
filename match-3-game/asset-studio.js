const outputModes = {
  icon: { label: "棋子图标", width: 256, height: 256, usage: "消消棋子图标", aspect: 1 },
  card: { label: "皮肤卡片", width: 512, height: 768, usage: "皮肤卡册封面", aspect: 2 / 3 },
  slap: { label: "拍脸大图", width: 1024, height: 1024, usage: "拍脸弹窗大图", aspect: 1 },
};

const samplePalettes = [
  ["#f7c59f", "#e84d36", "#172026", "#0f8b8d"],
  ["#e6f4f1", "#0f8b8d", "#f2b705", "#244b5a"],
  ["#f5e6f7", "#8d5a97", "#78a83b", "#172026"],
  ["#f7f0d6", "#f07c41", "#2f7da1", "#172026"],
  ["#eaf3fb", "#2f7da1", "#e84d36", "#f2b705"],
  ["#f1f4e5", "#78a83b", "#244b5a", "#f07c41"],
];

const finishedNames = ["蜜桃爆弹", "蓝莓星星", "青柠护符", "烤鱼勇者", "奶油船长", "番茄骑士"];

const state = {
  mode: "icon",
  image: null,
  sourceName: "未选择图片",
  samples: [],
  gallery: "icons",
  batchFiles: [],
};

const previewCanvas = document.querySelector("#previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const fileInput = document.querySelector("#fileInput");
const sampleGrid = document.querySelector("#sampleGrid");
const sourceName = document.querySelector("#sourceName");
const outputModeLabel = document.querySelector("#outputModeLabel");
const sizeLabel = document.querySelector("#sizeLabel");
const usageLabel = document.querySelector("#usageLabel");
const assetNameInput = document.querySelector("#assetNameInput");
const rarityInput = document.querySelector("#rarityInput");
const scaleInput = document.querySelector("#scaleInput");
const offsetXInput = document.querySelector("#offsetXInput");
const offsetYInput = document.querySelector("#offsetYInput");
const radiusInput = document.querySelector("#radiusInput");
const borderInput = document.querySelector("#borderInput");
const backdropInput = document.querySelector("#backdropInput");
const downloadButton = document.querySelector("#downloadButton");
const copyButton = document.querySelector("#copyButton");
const batchCount = document.querySelector("#batchCount");
const batchStatus = document.querySelector("#batchStatus");
const batchCurrentButton = document.querySelector("#batchCurrentButton");
const batchAllButton = document.querySelector("#batchAllButton");
const regenerateSamples = document.querySelector("#regenerateSamples");
const buildGalleryButton = document.querySelector("#buildGalleryButton");
const assetGrid = document.querySelector("#assetGrid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxClose = document.querySelector("#lightboxClose");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFilename(name) {
  return String(name || "match3-asset")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "match3-asset";
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function makeSamplePhoto(index) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  const p = samplePalettes[index % samplePalettes.length];

  const sky = ctx.createLinearGradient(0, 0, 900, 1200);
  sky.addColorStop(0, p[0]);
  sky.addColorStop(0.55, "#ffffff");
  sky.addColorStop(1, p[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 900, 1200);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.arc(90 + ((i * 173) % 760), 80 + ((i * 241) % 980), 28 + (i % 4) * 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = p[3];
  ctx.beginPath();
  ctx.ellipse(450, 610, 235, 300, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffe0c7";
  ctx.beginPath();
  ctx.arc(450, 380, 155, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p[2];
  ctx.beginPath();
  ctx.arc(390, 365, 16, 0, Math.PI * 2);
  ctx.arc(510, 365, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = p[2];
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(392, 455);
  ctx.quadraticCurveTo(450, 500, 520, 455);
  ctx.stroke();

  ctx.fillStyle = p[1];
  ctx.beginPath();
  ctx.arc(450, 258, 150, Math.PI, Math.PI * 2);
  ctx.lineTo(590, 330);
  ctx.quadraticCurveTo(450, 230, 310, 330);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.fillRect(0, 860, 900, 340);
  ctx.fillStyle = p[2];
  ctx.font = "800 62px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Sample ${index + 1}`, 450, 1040);

  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function selectSource(src, name) {
  state.image = await loadImage(src);
  state.sourceName = name;
  sourceName.textContent = name;
  drawPreview();
}

function renderSamples() {
  state.samples = Array.from({ length: 6 }, (_, index) => makeSamplePhoto(index + Math.floor(Math.random() * 24)));
  sampleGrid.replaceChildren();
  state.samples.forEach((src, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sample-button${index === 0 ? " is-active" : ""}`;
    button.innerHTML = `<img alt="示例照片 ${index + 1}" src="${src}" />`;
    button.addEventListener("click", () => {
      document.querySelectorAll(".sample-button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      selectSource(src, `示例照片 ${index + 1}`);
    });
    sampleGrid.append(button);
  });
  selectSource(state.samples[0], "示例照片 1");
}

function drawBackdrop(ctx, width, height, mode) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (mode === "rare") {
    gradient.addColorStop(0, "#2f7da1");
    gradient.addColorStop(0.5, "#f2b705");
    gradient.addColorStop(1, "#e84d36");
  } else if (mode === "dark") {
    gradient.addColorStop(0, "#172026");
    gradient.addColorStop(1, "#244b5a");
  } else if (mode === "clean") {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#eef3f5");
  } else {
    gradient.addColorStop(0, "#fff4df");
    gradient.addColorStop(0.5, "#e6f4f1");
    gradient.addColorStop(1, "#fde2dc");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 10; i += 1) {
    ctx.beginPath();
    ctx.arc((i * 137) % width, (i * 211) % height, Math.max(width, height) * (0.04 + (i % 3) * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCroppedImage(ctx, img, x, y, width, height) {
  const scale = Number(scaleInput.value);
  const offsetX = Number(offsetXInput.value);
  const offsetY = Number(offsetYInput.value);
  const targetAspect = width / height;
  let sourceWidth = img.width;
  let sourceHeight = sourceWidth / targetAspect;
  if (sourceHeight > img.height) {
    sourceHeight = img.height;
    sourceWidth = sourceHeight * targetAspect;
  }

  sourceWidth /= scale;
  sourceHeight /= scale;

  const maxX = (img.width - sourceWidth) / 2;
  const maxY = (img.height - sourceHeight) / 2;
  const sx = clamp((img.width - sourceWidth) / 2 + offsetX * maxX, 0, img.width - sourceWidth);
  const sy = clamp((img.height - sourceHeight) / 2 + offsetY * maxY, 0, img.height - sourceHeight);

  ctx.drawImage(img, sx, sy, sourceWidth, sourceHeight, x, y, width, height);
}

function renderAssetToCanvas(canvas, modeKey) {
  const mode = outputModes[modeKey];
  const ctx = canvas.getContext("2d");
  const name = assetNameInput.value.trim() || "未命名素材";
  const rarity = rarityInput.value;
  const radius = Number(radiusInput.value);
  const border = Number(borderInput.value);
  const width = mode.width;
  const height = mode.height;
  canvas.width = width;
  canvas.height = height;

  drawBackdrop(ctx, width, height, backdropInput.value);

  if (modeKey === "card") {
    const pad = 34;
    roundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 30);
    ctx.save();
    ctx.clip();
    drawCroppedImage(ctx, state.image, pad, pad, width - pad * 2, height - pad * 2);
    ctx.restore();

    ctx.lineWidth = 14;
    ctx.strokeStyle = rarity === "SSR" ? "#f2b705" : rarity === "SR" ? "#8d5a97" : rarity === "R" ? "#0f8b8d" : "#ffffff";
    roundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 30);
    ctx.stroke();

    ctx.fillStyle = "rgba(23,32,38,0.82)";
    roundedRect(ctx, 54, height - 138, width - 108, 86, 18);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 34px Microsoft YaHei, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, width / 2, height - 86);
    ctx.fillStyle = "#f2b705";
    ctx.font = "900 26px Arial, sans-serif";
    ctx.fillText(rarity, width - 78, 82);
    return;
  }

  const inset = modeKey === "slap" ? 74 : border + 8;
  const imageWidth = width - inset * 2;
  const imageHeight = height - inset * 2;
  roundedRect(ctx, inset, inset, imageWidth, imageHeight, radius);
  ctx.save();
  ctx.clip();
  drawCroppedImage(ctx, state.image, inset, inset, imageWidth, imageHeight);
  ctx.restore();

  if (border > 0) {
    ctx.lineWidth = border;
    ctx.strokeStyle = modeKey === "slap" ? "#ffffff" : "#172026";
    roundedRect(ctx, inset, inset, imageWidth, imageHeight, radius);
    ctx.stroke();
  }

  if (modeKey === "icon") {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.arc(width - 44, 44, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e84d36";
    ctx.font = "900 22px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rarity, width - 44, 52);
  } else {
    ctx.fillStyle = "rgba(23,32,38,0.74)";
    roundedRect(ctx, 110, height - 190, width - 220, 96, 20);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "900 52px Microsoft YaHei, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, width / 2, height - 128);
  }
}

function drawPreview() {
  if (!state.image) return;
  const mode = outputModes[state.mode];
  outputModeLabel.textContent = mode.label;
  sizeLabel.textContent = `${mode.width} x ${mode.height}`;
  usageLabel.textContent = mode.usage;

  const temp = document.createElement("canvas");
  renderAssetToCanvas(temp, state.mode);

  previewCanvas.width = 768;
  previewCanvas.height = 768;
  previewCtx.clearRect(0, 0, 768, 768);
  previewCtx.fillStyle = "rgba(255,255,255,0)";
  previewCtx.fillRect(0, 0, 768, 768);
  const scale = Math.min(700 / temp.width, 700 / temp.height);
  const width = temp.width * scale;
  const height = temp.height * scale;
  previewCtx.drawImage(temp, (768 - width) / 2, (768 - height) / 2, width, height);
}

function downloadCurrent() {
  const canvas = document.createElement("canvas");
  renderAssetToCanvas(canvas, state.mode);
  const link = document.createElement("a");
  const safeName = sanitizeFilename(assetNameInput.value.trim() || "match3-asset");
  link.download = `${safeName}-${state.mode}-${outputModes[state.mode].width}x${outputModes[state.mode].height}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function renderBatchFile(file, mode) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const previousImage = state.image;
  const previousName = assetNameInput.value;
  state.image = img;
  assetNameInput.value = sanitizeFilename(file.name);

  const canvas = document.createElement("canvas");
  renderAssetToCanvas(canvas, mode);
  const blob = await canvasToBlob(canvas, "image/png");
  const spec = outputModes[mode];
  const name = `${sanitizeFilename(file.name)}-${mode}-${spec.width}x${spec.height}.png`;

  state.image = previousImage;
  assetNameInput.value = previousName;
  return { name, blob };
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function exportBatch(modes) {
  if (!state.batchFiles.length) {
    batchStatus.textContent = "请先多选几张照片。";
    return;
  }

  batchCurrentButton.disabled = true;
  batchAllButton.disabled = true;
  const previousImage = state.image;
  const previousName = assetNameInput.value;
  const total = state.batchFiles.length * modes.length;
  let done = 0;

  try {
    for (const file of state.batchFiles) {
      for (const mode of modes) {
        const result = await renderBatchFile(file, mode);
        downloadBlob(result.blob, result.name);
        done += 1;
        batchStatus.textContent = `已下载 ${done} / ${total}：${result.name}`;
        await new Promise((resolve) => window.setTimeout(resolve, 160));
      }
    }

    state.image = previousImage;
    assetNameInput.value = previousName;
    drawPreview();
    batchStatus.textContent = `已直接下载 ${done} 个 PNG 素材。`;
  } catch (error) {
    state.image = previousImage;
    assetNameInput.value = previousName;
    drawPreview();
    batchStatus.textContent = `批量处理失败：${error.message || error}`;
  } finally {
    batchCurrentButton.disabled = false;
    batchAllButton.disabled = false;
  }
}

async function copyPreview() {
  if (!navigator.clipboard || !window.ClipboardItem) {
    downloadCurrent();
    return;
  }
  const canvas = document.createElement("canvas");
  renderAssetToCanvas(canvas, state.mode);
  canvas.toBlob(async (blob) => {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copyButton.textContent = "已复制";
    window.setTimeout(() => {
      copyButton.textContent = "复制预览图";
    }, 1200);
  }, "image/png");
}

function makeFinishedSource(index) {
  return {
    src: makeSamplePhoto(index + 12),
    name: finishedNames[index % finishedNames.length],
    rarity: ["N", "R", "SR", "SSR", "R", "SR"][index % 6],
    backdrop: ["soft", "clean", "rare", "dark", "soft", "rare"][index % 6],
  };
}

async function buildGallery() {
  const modeMap = { icons: "icon", cards: "card", slaps: "slap" };
  const mode = modeMap[state.gallery];
  assetGrid.replaceChildren();

  for (let i = 0; i < 6; i += 1) {
    const source = makeFinishedSource(i);
    const img = await loadImage(source.src);
    const previous = {
      image: state.image,
      name: assetNameInput.value,
      rarity: rarityInput.value,
      backdrop: backdropInput.value,
      scale: scaleInput.value,
      x: offsetXInput.value,
      y: offsetYInput.value,
    };

    state.image = img;
    assetNameInput.value = source.name;
    rarityInput.value = source.rarity;
    backdropInput.value = source.backdrop;
    scaleInput.value = "1.15";
    offsetXInput.value = "0";
    offsetYInput.value = mode === "card" ? "-0.12" : "0";

    const canvas = document.createElement("canvas");
    renderAssetToCanvas(canvas, mode);
    const url = canvas.toDataURL("image/png");

    state.image = previous.image;
    assetNameInput.value = previous.name;
    rarityInput.value = previous.rarity;
    backdropInput.value = previous.backdrop;
    scaleInput.value = previous.scale;
    offsetXInput.value = previous.x;
    offsetYInput.value = previous.y;

    const card = document.createElement("article");
    card.className = `asset-card${mode === "card" ? " is-card" : ""}`;
    card.innerHTML = `
      <button type="button"><img src="${url}" alt="${source.name}" /></button>
      <div class="asset-caption"><strong>${source.name}</strong><span>${source.rarity}</span></div>
    `;
    card.querySelector("button").addEventListener("click", () => openLightbox(url, source.name));
    assetGrid.append(card);
  }
}

function openLightbox(src, alt) {
  lightboxImage.src = src;
  lightboxImage.alt = alt;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
}

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;
  const invalid = files.find((file) => !/^image\/(jpeg|png|webp)$/.test(file.type));
  if (invalid) {
    alert("只支持 JPG / PNG / WebP 图片");
    return;
  }
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  if (oversized) {
    alert("图片不能超过 10MB");
    return;
  }
  state.batchFiles = files;
  batchCount.textContent = `${files.length} 张`;
  batchStatus.textContent = files.length > 1 ? `已选择 ${files.length} 张，当前预览第 1 张。` : "已选择 1 张，可直接下载或批量导出。";
  readFileAsDataUrl(files[0]).then((src) => selectSource(src, files[0].name));
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.mode = button.dataset.mode;
    drawPreview();
  });
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.gallery = button.dataset.gallery;
    buildGallery();
  });
});

[scaleInput, offsetXInput, offsetYInput, radiusInput, borderInput, backdropInput, assetNameInput, rarityInput].forEach((input) => {
  input.addEventListener("input", drawPreview);
});

downloadButton.addEventListener("click", downloadCurrent);
copyButton.addEventListener("click", copyPreview);
batchCurrentButton.addEventListener("click", () => exportBatch([state.mode]));
batchAllButton.addEventListener("click", () => exportBatch(["icon", "card", "slap"]));
regenerateSamples.addEventListener("click", renderSamples);
buildGalleryButton.addEventListener("click", buildGallery);
lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

renderSamples();
buildGallery();
