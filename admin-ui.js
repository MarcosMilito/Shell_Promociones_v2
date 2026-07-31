/*
  Mejora visual del panel.
  No modifica Supabase ni la lógica principal de admin.js.
*/

const selectorPantalla = document.getElementById("selectorPantalla");
const tvCards = document.getElementById("tvCards");
const emptyScreensState = document.getElementById("emptyScreensState");
const createTvPanel = document.getElementById("createTvPanel");
const btnCreateFirstTv = document.getElementById("btnCreateFirstTv");
const btnAbrirPantalla = document.getElementById("btnAbrirPantalla");

const archivoPromo = document.getElementById("archivoPromo");
const archivoMeta = document.getElementById("archivoMeta");
const archivoWarning = document.getElementById("archivoWarning");
const aplicarATodas = document.getElementById("aplicarATodas");

const summaryTvs = document.getElementById("summaryTvs");
const summaryPromos = document.getElementById("summaryPromos");
const summarySelected = document.getElementById("summarySelected");
const listaPromos = document.getElementById("listaPromos");
const datosPantalla = document.getElementById("datosPantalla");
const toastContainer = document.getElementById("toastContainer");

const statusElements = [
  document.getElementById("loginStatus"),
  document.getElementById("pantallaStatus"),
  document.getElementById("uploadStatus")
].filter(Boolean);

function getValidOptions() {
  if (!selectorPantalla) return [];

  return Array.from(selectorPantalla.options).filter(function (option) {
    return option.value && !option.textContent.toLowerCase().includes("no hay");
  });
}

function parseOption(option) {
  const text = String(option.textContent || "").trim();
  const lower = text.toLowerCase();
  const orientation = lower.includes("vertical") ? "vertical" : "horizontal";

  return {
    id: option.value,
    name: text.replace(/\s+-\s+(horizontal|vertical)\s*$/i, "").trim() || text,
    orientation
  };
}

function renderTvCards() {
  if (!tvCards || !selectorPantalla) return;

  const options = getValidOptions();
  const selectedId = selectorPantalla.value;

  tvCards.innerHTML = "";

  if (options.length === 0) {
    emptyScreensState?.classList.remove("hidden");
    createTvPanel?.setAttribute("open", "");
    updateSummary();
    updateGuide();
    return;
  }

  emptyScreensState?.classList.add("hidden");

  options.forEach(function (option) {
    const tv = parseOption(option);
    const card = document.createElement("button");

    card.type = "button";
    card.className = "tv-card";
    card.dataset.tvId = tv.id;

    if (tv.id === selectedId) {
      card.classList.add("is-selected");
    }

    if (selectorPantalla.disabled) {
      card.classList.add("is-disabled");
    }

    const shapeClass = tv.orientation === "vertical"
      ? "tv-shape tv-shape-vertical"
      : "tv-shape tv-shape-horizontal";

    card.innerHTML = `
      <span class="${shapeClass}" aria-hidden="true"></span>
      <span class="tv-card-copy">
        <strong>${escapeHtml(tv.name)}</strong>
        <small>${tv.orientation === "vertical" ? "Vertical · 1080 × 1920" : "Horizontal · 1920 × 1080"}</small>
      </span>
      <span class="tv-card-action">Administrar</span>
    `;

    card.addEventListener("click", function () {
      if (selectorPantalla.disabled) {
        showToast("Desmarcá ‘todas las televisiones’ para cambiar de TV.", "info");
        return;
      }

      selectorPantalla.value = tv.id;
      selectorPantalla.dispatchEvent(new Event("change", { bubbles: true }));

      requestAnimationFrame(function () {
        renderTvCards();
        document.querySelector(".selected-tv-card")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });

    tvCards.appendChild(card);
  });

  updateSummary();
  updateGuide();
  updateOpenButton();
}

function updateSummary() {
  const tvCount = getValidOptions().length;
  const promoCount = listaPromos
    ? listaPromos.querySelectorAll(".promo-item:not(.inactive)").length
    : 0;

  const selectedOption = selectorPantalla?.selectedOptions?.[0];
  const selected = selectedOption && selectedOption.value
    ? parseOption(selectedOption).name
    : "Ninguna";

  if (summaryTvs) summaryTvs.textContent = String(tvCount);
  if (summaryPromos) summaryPromos.textContent = String(promoCount);
  if (summarySelected) summarySelected.textContent = selected;
}

function updateGuide() {
  const tvCount = getValidOptions().length;
  const hasSelectedTv = Boolean(selectorPantalla?.value);
  const hasFile = Boolean(archivoPromo?.files?.[0]);
  const promoCount = listaPromos
    ? listaPromos.querySelectorAll(".promo-item").length
    : 0;

  setStepState(1, tvCount > 0, !hasSelectedTv && tvCount > 0);
  setStepState(2, hasSelectedTv, hasSelectedTv && !hasFile);
  setStepState(3, hasFile, hasFile);
  setStepState(4, promoCount > 0, false);
}

function setStepState(number, complete, active) {
  const step = document.querySelector(`[data-guide-step="${number}"]`);
  if (!step) return;

  step.classList.toggle("is-complete", complete);
  step.classList.toggle("is-active", active && !complete);
}

function updateOpenButton() {
  if (!btnAbrirPantalla) return;

  const url = getScreenUrl();
  btnAbrirPantalla.disabled = !url;
}

function getScreenUrl() {
  const urlElement = datosPantalla?.querySelector(".screen-url");
  const url = String(urlElement?.textContent || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function openSelectedScreen() {
  const url = getScreenUrl();

  if (!url) {
    showToast("Primero seleccioná una televisión.", "error");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function showFileMetadata() {
  const file = archivoPromo?.files?.[0];

  if (!file) {
    archivoMeta.textContent = "Seleccioná un archivo para ver sus datos.";
    archivoWarning.classList.add("hidden");
    archivoWarning.textContent = "";
    updateGuide();
    return;
  }

  const size = formatBytes(file.size);
  const typeLabel = file.type === "video/mp4" ? "Video MP4" : "Imagen";

  archivoMeta.innerHTML = `
    <dl class="file-meta-list">
      <div><dt>Archivo</dt><dd>${escapeHtml(file.name)}</dd></div>
      <div><dt>Formato</dt><dd>${escapeHtml(typeLabel)}</dd></div>
      <div><dt>Peso</dt><dd>${escapeHtml(size)}</dd></div>
    </dl>
  `;

  archivoWarning.classList.add("hidden");
  archivoWarning.textContent = "";

  if (file.type.startsWith("image/")) {
    inspectImage(file);
  } else {
    archivoWarning.classList.remove("hidden");
    archivoWarning.className = "file-warning is-ok";
    archivoWarning.textContent = "El video se reproducirá completo antes de pasar al siguiente contenido.";
  }

  updateGuide();
}

function inspectImage(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = function () {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const actualOrientation = height > width ? "vertical" : "horizontal";
    const expectedOrientation = getSelectedOrientation();
    const ratio = width / height;
    const expectedRatio = expectedOrientation === "vertical" ? 9 / 16 : 16 / 9;
    const ratioDifference = Math.abs(ratio - expectedRatio) / expectedRatio;

    archivoMeta.innerHTML += `
      <dl class="file-meta-list file-meta-list-secondary">
        <div><dt>Resolución</dt><dd>${width} × ${height} px</dd></div>
        <div><dt>Orientación</dt><dd>${capitalize(actualOrientation)}</dd></div>
      </dl>
    `;

    archivoWarning.classList.remove("hidden", "is-ok", "is-warning");

    if (expectedOrientation && actualOrientation !== expectedOrientation) {
      archivoWarning.classList.add("is-warning");
      archivoWarning.textContent = `Esta imagen es ${actualOrientation}, pero la TV seleccionada es ${expectedOrientation}. Puede recortarse o deformarse.`;
    } else if (ratioDifference > 0.12) {
      archivoWarning.classList.add("is-warning");
      archivoWarning.textContent = "La proporción no coincide exactamente con la pantalla. Revisá la vista previa antes de publicar.";
    } else {
      archivoWarning.classList.add("is-ok");
      archivoWarning.textContent = "El formato es compatible con la televisión seleccionada.";
    }

    URL.revokeObjectURL(objectUrl);
  };

  image.onerror = function () {
    archivoWarning.classList.remove("hidden");
    archivoWarning.className = "file-warning is-warning";
    archivoWarning.textContent = "No pudimos analizar la resolución de esta imagen.";
    URL.revokeObjectURL(objectUrl);
  };

  image.src = objectUrl;
}

function getSelectedOrientation() {
  const option = selectorPantalla?.selectedOptions?.[0];
  if (!option || !option.value) return null;
  return parseOption(option).orientation;
}

function syncGlobalMode() {
  const disabled = Boolean(aplicarATodas?.checked);

  tvCards?.classList.toggle("tv-card-grid-disabled", disabled);

  tvCards?.querySelectorAll(".tv-card").forEach(function (card) {
    card.classList.toggle("is-disabled", disabled);
  });

  updateGuide();
}

function showToast(message, type) {
  if (!toastContainer || !message) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type || "info"}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add("is-visible");
  });

  window.setTimeout(function () {
    toast.classList.remove("is-visible");
    window.setTimeout(function () {
      toast.remove();
    }, 220);
  }, 3600);
}

function observeStatus(element) {
  let lastKey = "";

  const notify = function () {
    const message = String(element.textContent || "").trim();
    if (!message) return;

    const type = element.classList.contains("status-error")
      ? "error"
      : element.classList.contains("status-success")
        ? "success"
        : "info";

    const key = `${type}:${message}`;
    if (key === lastKey) return;
    lastKey = key;

    showToast(message, type);

    if (type === "success" && /televisi[oó]n creada/i.test(message)) {
      createTvPanel?.removeAttribute("open");
    }
  };

  const observer = new MutationObserver(function () {
    window.setTimeout(notify, 20);
  });

  observer.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

btnCreateFirstTv?.addEventListener("click", function () {
  createTvPanel?.setAttribute("open", "");
  createTvPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("nombrePantalla")?.focus();
});

btnAbrirPantalla?.addEventListener("click", openSelectedScreen);
selectorPantalla?.addEventListener("change", function () {
  renderTvCards();
  showFileMetadata();
});
archivoPromo?.addEventListener("change", showFileMetadata);
aplicarATodas?.addEventListener("change", syncGlobalMode);

statusElements.forEach(observeStatus);

if (selectorPantalla) {
  new MutationObserver(renderTvCards).observe(selectorPantalla, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

if (listaPromos) {
  new MutationObserver(function () {
    updateSummary();
    updateGuide();
  }).observe(listaPromos, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

if (datosPantalla) {
  new MutationObserver(updateOpenButton).observe(datosPantalla, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });
}

renderTvCards();
showFileMetadata();
syncGlobalMode();
updateSummary();
updateGuide();
updateOpenButton();
