import { supabase } from "./supabase-config.js";

/* =====================================================
   ELEMENTOS
===================================================== */

const supportLogin = document.getElementById("supportLogin");
const supportApp = document.getElementById("supportApp");

const supportEmail = document.getElementById("supportEmail");
const supportPassword = document.getElementById("supportPassword");
const supportLoginButton = document.getElementById("supportLoginButton");
const supportLoginStatus = document.getElementById("supportLoginStatus");
const supportLogoutButton = document.getElementById("supportLogoutButton");
const refreshAllButton = document.getElementById("refreshAllButton");

const stationSearch = document.getElementById("stationSearch");
const stationList = document.getElementById("stationList");
const stationTotalBadge = document.getElementById("stationTotalBadge");

const noStationState = document.getElementById("noStationState");
const stationWorkspace = document.getElementById("stationWorkspace");
const selectedStationName = document.getElementById("selectedStationName");
const selectedStationSlug = document.getElementById("selectedStationSlug");
const openStationPanelButton = document.getElementById("openStationPanelButton");

const summaryUsers = document.getElementById("summaryUsers");
const summaryScreens = document.getElementById("summaryScreens");
const summaryPromos = document.getElementById("summaryPromos");
const summaryIssues = document.getElementById("summaryIssues");

const diagnosticList = document.getElementById("diagnosticList");
const userList = document.getElementById("userList");
const screenList = document.getElementById("screenList");
const promoList = document.getElementById("promoList");

const assignUserForm = document.getElementById("assignUserForm");
const assignUserEmail = document.getElementById("assignUserEmail");
const assignUserRole = document.getElementById("assignUserRole");

const promoScreenFilter = document.getElementById("promoScreenFilter");
const promoSearch = document.getElementById("promoSearch");

const supportToast = document.getElementById("supportToast");

/* =====================================================
   ESTADO
===================================================== */

const state = {
  stations: [],
  selectedStation: null,
  users: [],
  screens: [],
  promos: [],
  issues: []
};

let toastTimer = null;

/* =====================================================
   EVENTOS
===================================================== */

supportLoginButton.addEventListener("click", login);
supportPassword.addEventListener("keydown", function (event) {
  if (event.key === "Enter") login();
});

supportLogoutButton.addEventListener("click", logout);
refreshAllButton.addEventListener("click", refreshEverything);

stationSearch.addEventListener("input", renderStationList);

openStationPanelButton.addEventListener("click", function () {
  if (!state.selectedStation) return;

  window.open(
    `/admin.html?estacion=${encodeURIComponent(state.selectedStation.slug)}`,
    "_blank",
    "noopener"
  );
});

document.querySelectorAll(".support-tab").forEach(function (button) {
  button.addEventListener("click", function () {
    activateTab(button.dataset.tab);
  });
});

assignUserForm.addEventListener("submit", assignExistingUser);
promoScreenFilter.addEventListener("change", renderPromotions);
promoSearch.addEventListener("input", renderPromotions);

/* =====================================================
   SESIÓN
===================================================== */

async function login() {
  const email = supportEmail.value.trim();
  const password = supportPassword.value;

  if (!email || !password) {
    setLoginStatus("Ingresá el email y la contraseña.", "error");
    return;
  }

  supportLoginButton.disabled = true;
  supportLoginButton.textContent = "Ingresando...";
  setLoginStatus("Verificando acceso...", "");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setLoginStatus("El email o la contraseña son incorrectos.", "error");
    supportLoginButton.disabled = false;
    supportLoginButton.textContent = "Iniciar sesión";
    return;
  }

  const authorized = await verifySupportAccess();

  supportLoginButton.disabled = false;
  supportLoginButton.textContent = "Iniciar sesión";

  if (!authorized) {
    await supabase.auth.signOut();
    setLoginStatus("Esta cuenta no tiene acceso al centro de soporte.", "error");
    return;
  }

  await enterApplication();
}

async function verifySupportAccess() {
  const { data, error } = await supabase.rpc("soporte_es_admin");

  if (error) {
    console.error("No se pudo verificar el acceso:", error);
    return false;
  }

  return data === true;
}

async function verifyExistingSession() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) return;

  const authorized = await verifySupportAccess();

  if (authorized) {
    await enterApplication();
  } else {
    await supabase.auth.signOut();
  }
}

async function enterApplication() {
  supportLogin.classList.add("hidden");
  supportApp.classList.remove("hidden");
  setLoginStatus("", "");
  await loadStations();
}

async function logout() {
  await supabase.auth.signOut();

  state.stations = [];
  state.selectedStation = null;
  state.users = [];
  state.screens = [];
  state.promos = [];

  supportApp.classList.add("hidden");
  supportLogin.classList.remove("hidden");

  supportEmail.value = "";
  supportPassword.value = "";
}

/* =====================================================
   CARGA PRINCIPAL
===================================================== */

async function refreshEverything() {
  refreshAllButton.disabled = true;
  refreshAllButton.textContent = "Actualizando...";

  try {
    await loadStations(state.selectedStation ? state.selectedStation.id : null);
    showToast("Información actualizada.", "success");
  } finally {
    refreshAllButton.disabled = false;
    refreshAllButton.textContent = "Actualizar";
  }
}

async function loadStations(keepStationId = null) {
  stationList.innerHTML =
    '<div class="support-empty-small">Cargando estaciones...</div>';

  const { data, error } = await supabase.rpc(
    "soporte_resumen_estaciones"
  );

  if (error) {
    console.error("Error cargando estaciones:", error);
    stationList.innerHTML =
      '<div class="support-empty-small">No se pudieron cargar las estaciones.</div>';
    showToast(error.message || "No se pudieron cargar las estaciones.", "error");
    return;
  }

  state.stations = data || [];
  stationTotalBadge.textContent = String(state.stations.length);

  renderStationList();

  const savedId =
    keepStationId ||
    localStorage.getItem("support_selected_station");

  const stationToOpen =
    state.stations.find(function (station) {
      return station.id === savedId;
    }) ||
    state.stations[0] ||
    null;

  if (stationToOpen) {
    await selectStation(stationToOpen.id);
  } else {
    clearStationWorkspace();
  }
}

function renderStationList() {
  const query = stationSearch.value.trim().toLowerCase();

  const filtered = state.stations.filter(function (station) {
    return (
      station.nombre.toLowerCase().includes(query) ||
      station.slug.toLowerCase().includes(query)
    );
  });

  stationList.innerHTML = "";

  if (filtered.length === 0) {
    stationList.innerHTML =
      '<div class="support-empty-small">No se encontraron estaciones.</div>';
    return;
  }

  filtered.forEach(function (station) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-station-button";

    if (
      state.selectedStation &&
      state.selectedStation.id === station.id
    ) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <span class="support-station-icon">
        ${escapeHtml(getInitials(station.nombre))}
      </span>

      <span>
        <strong>${escapeHtml(station.nombre)}</strong>
        <small>
          ${Number(station.pantallas || 0)} TV ·
          ${Number(station.promociones || 0)} promos
        </small>
      </span>
    `;

    button.addEventListener("click", function () {
      selectStation(station.id);
    });

    stationList.appendChild(button);
  });
}

async function selectStation(stationId) {
  const station =
    state.stations.find(function (item) {
      return item.id === stationId;
    }) || null;

  if (!station) return;

  state.selectedStation = station;
  localStorage.setItem("support_selected_station", station.id);

  renderStationList();

  noStationState.classList.add("hidden");
  stationWorkspace.classList.remove("hidden");

  selectedStationName.textContent = station.nombre;
  selectedStationSlug.textContent = station.slug;

  setWorkspaceLoading(true);

  const [usersResult, screensResult, promosResult] = await Promise.all([
    supabase.rpc("soporte_usuarios_estacion", {
      p_estacion_id: station.id
    }),
    supabase.rpc("soporte_pantallas_estacion", {
      p_estacion_id: station.id
    }),
    supabase.rpc("soporte_promociones_estacion", {
      p_estacion_id: station.id
    })
  ]);

  setWorkspaceLoading(false);

  if (usersResult.error || screensResult.error || promosResult.error) {
    console.error(
      "Error cargando estación:",
      usersResult.error,
      screensResult.error,
      promosResult.error
    );

    showToast(
      "No se pudo cargar toda la información de la estación.",
      "error"
    );
  }

  state.users = usersResult.data || [];
  state.screens = screensResult.data || [];
  state.promos = promosResult.data || [];

  buildDiagnostics();
  updateSummary();
  renderUsers();
  renderScreens();
  populatePromoFilter();
  renderPromotions();
  renderDiagnostics();
}

function setWorkspaceLoading(isLoading) {
  if (!isLoading) return;

  summaryUsers.textContent = "…";
  summaryScreens.textContent = "…";
  summaryPromos.textContent = "…";
  summaryIssues.textContent = "…";

  diagnosticList.innerHTML =
    '<div class="support-empty-small">Analizando configuración...</div>';

  userList.innerHTML =
    '<div class="support-empty-small">Cargando usuarios...</div>';

  screenList.innerHTML =
    '<div class="support-empty-small">Cargando televisiones...</div>';

  promoList.innerHTML =
    '<div class="support-empty-small">Cargando promociones...</div>';
}

function clearStationWorkspace() {
  state.selectedStation = null;
  noStationState.classList.remove("hidden");
  stationWorkspace.classList.add("hidden");
}

/* =====================================================
   RESUMEN Y DIAGNÓSTICO
===================================================== */

function updateSummary() {
  summaryUsers.textContent = String(state.users.length);
  summaryScreens.textContent = String(state.screens.length);
  summaryPromos.textContent = String(state.promos.length);
  summaryIssues.textContent = String(
    state.issues.filter(function (issue) {
      return issue.level !== "ok";
    }).length
  );
}

function buildDiagnostics() {
  const issues = [];

  if (state.users.length === 0) {
    issues.push({
      level: "error",
      title: "La estación no tiene usuarios asignados",
      description:
        "Ninguna cuenta podrá administrar esta estación desde el panel normal."
    });
  } else {
    issues.push({
      level: "ok",
      title: "Usuarios configurados",
      description:
        `${state.users.length} usuario(s) tienen acceso a la estación.`
    });
  }

  if (state.screens.length === 0) {
    issues.push({
      level: "warning",
      title: "No hay televisiones creadas",
      description:
        "La estación todavía no tiene enlaces de reproducción configurados."
    });
  }

  const inactiveScreens = state.screens.filter(function (screen) {
    return !screen.activo;
  });

  if (inactiveScreens.length > 0) {
    issues.push({
      level: "warning",
      title: "Hay televisiones desactivadas",
      description:
        `${inactiveScreens.length} televisión(es) están desactivadas.`
    });
  }

  const activePromosByScreen = new Map();

  state.promos.forEach(function (promo) {
    if (!promo.activo || !promo.pantalla_id) return;

    activePromosByScreen.set(
      promo.pantalla_id,
      (activePromosByScreen.get(promo.pantalla_id) || 0) + 1
    );
  });

  const globalActivePromos = state.promos.filter(function (promo) {
    return promo.activo && promo.pantalla_id === null;
  }).length;

  const emptyActiveScreens = state.screens.filter(function (screen) {
    if (!screen.activo) return false;

    const exclusive =
      activePromosByScreen.get(screen.id) || 0;

    return exclusive + globalActivePromos === 0;
  });

  if (emptyActiveScreens.length > 0) {
    issues.push({
      level: "error",
      title: "Hay televisiones activas sin promociones",
      description:
        `${emptyActiveScreens.length} televisión(es) podrían quedar en negro porque no tienen contenido activo.`
    });
  }

  const brokenUrls = state.promos.filter(function (promo) {
    return !getPromoUrl(promo);
  });

  if (brokenUrls.length > 0) {
    issues.push({
      level: "error",
      title: "Hay promociones sin archivo",
      description:
        `${brokenUrls.length} promoción(es) no tienen una URL válida asociada.`
    });
  }

  if (
    state.screens.length > 0 &&
    state.promos.length > 0 &&
    inactiveScreens.length === 0 &&
    emptyActiveScreens.length === 0 &&
    brokenUrls.length === 0
  ) {
    issues.push({
      level: "ok",
      title: "Configuración general correcta",
      description:
        "No se detectaron problemas básicos en televisiones y promociones."
    });
  }

  state.issues = issues;
}

function renderDiagnostics() {
  diagnosticList.innerHTML = "";

  if (state.issues.length === 0) {
    diagnosticList.innerHTML =
      '<div class="support-empty-small">No hay datos suficientes para analizar.</div>';
    return;
  }

  state.issues.forEach(function (issue) {
    const item = document.createElement("article");
    item.className = `support-diagnostic-item ${issue.level}`;

    const symbol =
      issue.level === "ok"
        ? "✓"
        : issue.level === "warning"
          ? "!"
          : "×";

    item.innerHTML = `
      <div class="support-diagnostic-symbol">${symbol}</div>

      <div>
        <h4>${escapeHtml(issue.title)}</h4>
        <p>${escapeHtml(issue.description)}</p>
      </div>
    `;

    diagnosticList.appendChild(item);
  });
}

/* =====================================================
   USUARIOS
===================================================== */

function renderUsers() {
  userList.innerHTML = "";

  if (state.users.length === 0) {
    userList.innerHTML =
      '<div class="support-empty-small">No hay usuarios asignados.</div>';
    return;
  }

  state.users.forEach(function (user) {
    const row = document.createElement("article");
    row.className = "support-user-row";

    row.innerHTML = `
      <div>
        <div class="support-user-email">
          ${escapeHtml(user.email || "Sin email")}
        </div>

        <div class="support-user-id">
          ${escapeHtml(user.user_id)}
        </div>
      </div>

      <select data-user-role="${user.user_id}">
        <option value="editor" ${user.rol === "editor" ? "selected" : ""}>
          Editor
        </option>

        <option value="admin" ${user.rol === "admin" ? "selected" : ""}>
          Administrador
        </option>
      </select>

      <div class="support-row-actions">
        <button
          class="support-secondary-button"
          data-save-role="${user.user_id}"
        >
          Guardar rol
        </button>

        <button
          class="support-danger-button"
          data-remove-user="${user.user_id}"
        >
          Quitar acceso
        </button>
      </div>
    `;

    userList.appendChild(row);
  });

  document.querySelectorAll("[data-save-role]").forEach(function (button) {
    button.addEventListener("click", function () {
      updateUserRole(button.dataset.saveRole);
    });
  });

  document.querySelectorAll("[data-remove-user]").forEach(function (button) {
    button.addEventListener("click", function () {
      removeUserAccess(button.dataset.removeUser);
    });
  });
}

async function assignExistingUser(event) {
  event.preventDefault();

  if (!state.selectedStation) return;

  const email = assignUserEmail.value.trim();
  const role = assignUserRole.value;

  if (!email) return;

  const submitButton = assignUserForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Asociando...";

  const { error } = await supabase.rpc(
    "soporte_asignar_usuario_existente",
    {
      p_estacion_id: state.selectedStation.id,
      p_email: email,
      p_rol: role
    }
  );

  submitButton.disabled = false;
  submitButton.textContent = "Asociar usuario";

  if (error) {
    showToast(
      error.message ||
        "No se pudo asociar el usuario. Verificá que exista en Authentication.",
      "error"
    );
    return;
  }

  assignUserEmail.value = "";
  showToast("Usuario asociado correctamente.", "success");
  await selectStation(state.selectedStation.id);
}

async function updateUserRole(userId) {
  if (!state.selectedStation) return;

  const select =
    document.querySelector(`[data-user-role="${userId}"]`);

  const { error } = await supabase.rpc(
    "soporte_actualizar_rol",
    {
      p_estacion_id: state.selectedStation.id,
      p_user_id: userId,
      p_rol: select.value
    }
  );

  if (error) {
    showToast(error.message || "No se pudo cambiar el rol.", "error");
    return;
  }

  showToast("Rol actualizado.", "success");
  await selectStation(state.selectedStation.id);
}

async function removeUserAccess(userId) {
  if (!state.selectedStation) return;

  const user =
    state.users.find(function (item) {
      return item.user_id === userId;
    });

  const confirmed = confirm(
    `¿Querés quitarle a ${user ? user.email : "este usuario"} el acceso a ${state.selectedStation.nombre}?`
  );

  if (!confirmed) return;

  const { error } = await supabase.rpc(
    "soporte_quitar_usuario",
    {
      p_estacion_id: state.selectedStation.id,
      p_user_id: userId
    }
  );

  if (error) {
    showToast(error.message || "No se pudo quitar el acceso.", "error");
    return;
  }

  showToast("Acceso eliminado.", "success");
  await selectStation(state.selectedStation.id);
}

/* =====================================================
   TELEVISIONES
===================================================== */

function renderScreens() {
  screenList.innerHTML = "";

  if (state.screens.length === 0) {
    screenList.innerHTML =
      '<div class="support-empty-small">No hay televisiones creadas.</div>';
    return;
  }

  state.screens.forEach(function (screen) {
    const card = document.createElement("article");
    card.className = "support-screen-card";

    if (!screen.activo) {
      card.classList.add("inactive");
    }

    card.innerHTML = `
      <div class="support-screen-card-header">
        <div>
          <h4>${escapeHtml(screen.nombre)}</h4>
          <p>
            ${escapeHtml(screen.orientacion)} ·
            ${Number(screen.promociones || 0)} promoción(es)
          </p>
        </div>

        <span class="support-status-pill ${screen.activo ? "active" : "inactive"}">
          ${screen.activo ? "Activa" : "Desactivada"}
        </span>
      </div>

      <div class="support-screen-form">
        <div>
          <label for="screen-name-${screen.id}">Nombre</label>
          <input
            id="screen-name-${screen.id}"
            data-screen-name="${screen.id}"
            type="text"
            value="${escapeAttribute(screen.nombre)}"
          >
        </div>

        <div>
          <label for="screen-duration-${screen.id}">Segundos</label>
          <input
            id="screen-duration-${screen.id}"
            data-screen-duration="${screen.id}"
            type="number"
            min="3"
            max="60"
            value="${Number(screen.duracion_imagen || 7)}"
          >
        </div>
      </div>

      <div class="support-screen-actions">
        <button
          class="support-primary-button"
          data-save-screen="${screen.id}"
        >
          Guardar cambios
        </button>

        <button
          class="support-secondary-button"
          data-open-screen="${screen.id}"
        >
          Abrir
        </button>

        <button
          class="support-secondary-button"
          data-copy-screen="${screen.id}"
        >
          Copiar enlace
        </button>

        <button
          class="${screen.activo ? "support-danger-button" : "support-ghost-button"}"
          data-toggle-screen="${screen.id}"
        >
          ${screen.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    `;

    screenList.appendChild(card);
  });

  document.querySelectorAll("[data-save-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      saveScreen(button.dataset.saveScreen);
    });
  });

  document.querySelectorAll("[data-open-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      openScreen(button.dataset.openScreen);
    });
  });

  document.querySelectorAll("[data-copy-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      copyScreenLink(button.dataset.copyScreen);
    });
  });

  document.querySelectorAll("[data-toggle-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      toggleScreen(button.dataset.toggleScreen);
    });
  });
}

async function saveScreen(screenId) {
  const nameInput =
    document.querySelector(`[data-screen-name="${screenId}"]`);

  const durationInput =
    document.querySelector(`[data-screen-duration="${screenId}"]`);

  const screen =
    state.screens.find(function (item) {
      return item.id === screenId;
    });

  if (!screen) return;

  const name = nameInput.value.trim();
  const duration = Number(durationInput.value);

  if (!name) {
    showToast("El nombre de la televisión no puede quedar vacío.", "error");
    return;
  }

  if (!Number.isFinite(duration) || duration < 3 || duration > 60) {
    showToast("La duración debe estar entre 3 y 60 segundos.", "error");
    return;
  }

  const { error } = await supabase.rpc(
    "soporte_actualizar_pantalla",
    {
      p_pantalla_id: screenId,
      p_nombre: name,
      p_duracion: duration,
      p_activo: screen.activo
    }
  );

  if (error) {
    showToast(error.message || "No se pudo actualizar la televisión.", "error");
    return;
  }

  showToast("Televisión actualizada.", "success");
  await selectStation(state.selectedStation.id);
}

async function toggleScreen(screenId) {
  const screen =
    state.screens.find(function (item) {
      return item.id === screenId;
    });

  if (!screen) return;

  const { error } = await supabase.rpc(
    "soporte_actualizar_pantalla",
    {
      p_pantalla_id: screenId,
      p_nombre: screen.nombre,
      p_duracion: Number(screen.duracion_imagen || 7),
      p_activo: !screen.activo
    }
  );

  if (error) {
    showToast(error.message || "No se pudo cambiar el estado.", "error");
    return;
  }

  showToast(
    screen.activo ? "Televisión desactivada." : "Televisión activada.",
    "success"
  );

  await selectStation(state.selectedStation.id);
}

function openScreen(screenId) {
  const screen =
    state.screens.find(function (item) {
      return item.id === screenId;
    });

  if (!screen) return;

  window.open(
    `/tv/${encodeURIComponent(screen.codigo)}`,
    "_blank",
    "noopener"
  );
}

async function copyScreenLink(screenId) {
  const screen =
    state.screens.find(function (item) {
      return item.id === screenId;
    });

  if (!screen) return;

  const url =
    `${window.location.origin}/tv/${screen.codigo}`;

  try {
    await navigator.clipboard.writeText(url);
    showToast("Enlace copiado.", "success");
  } catch {
    showToast(url, "");
  }
}

/* =====================================================
   PROMOCIONES
===================================================== */

function populatePromoFilter() {
  const current = promoScreenFilter.value;

  promoScreenFilter.innerHTML =
    '<option value="all">Todas las televisiones</option>' +
    '<option value="global">Promociones generales</option>';

  state.screens.forEach(function (screen) {
    const option = document.createElement("option");
    option.value = screen.id;
    option.textContent = screen.nombre;
    promoScreenFilter.appendChild(option);
  });

  if (
    Array.from(promoScreenFilter.options).some(function (option) {
      return option.value === current;
    })
  ) {
    promoScreenFilter.value = current;
  }
}

function renderPromotions() {
  const target = promoScreenFilter.value;
  const query = promoSearch.value.trim().toLowerCase();

  const filtered = state.promos.filter(function (promo) {
    const matchesTarget =
      target === "all" ||
      (target === "global" && promo.pantalla_id === null) ||
      promo.pantalla_id === target;

    const haystack = [
      promo.pantalla_nombre || "",
      promo.tipo || "",
      promo.path || "",
      promo.path_horizontal || "",
      promo.path_vertical || ""
    ]
      .join(" ")
      .toLowerCase();

    return matchesTarget && haystack.includes(query);
  });

  promoList.innerHTML = "";

  if (filtered.length === 0) {
    promoList.innerHTML =
      '<div class="support-empty-small">No hay promociones para este filtro.</div>';
    return;
  }

  filtered.forEach(function (promo) {
    const url = getPromoUrl(promo);
    const type = getPromoType(promo);
    const path = getPromoPath(promo);

    const card = document.createElement("article");
    card.className = "support-promo-card";

    if (!promo.activo) {
      card.classList.add("inactive");
    }

    let preview =
      '<div class="support-promo-preview">Sin archivo disponible</div>';

    if (url && type === "video") {
      preview = `
        <div class="support-promo-preview">
          <video src="${escapeAttribute(url)}" muted preload="metadata"></video>
        </div>
      `;
    } else if (url) {
      preview = `
        <div class="support-promo-preview">
          <img
            src="${escapeAttribute(url)}"
            alt="Vista previa"
            loading="lazy"
          >
        </div>
      `;
    }

    card.innerHTML = `
      ${preview}

      <div class="support-promo-content">
        <div class="support-promo-card-header">
          <div>
            <h4>
              ${promo.pantalla_id
                ? escapeHtml(promo.pantalla_nombre || "Televisión")
                : "Todas las televisiones"}
            </h4>

            <p>
              ${escapeHtml(type || "archivo")} · Orden ${Number(promo.orden || 1)}
            </p>
          </div>

          <span class="support-status-pill ${promo.activo ? "active" : "inactive"}">
            ${promo.activo ? "Activa" : "Desactivada"}
          </span>
        </div>

        <p class="support-promo-path">
          ${escapeHtml(path || "Sin ruta")}
        </p>

        <div class="support-row-actions">
          ${url
            ? `<button class="support-secondary-button" data-open-promo="${promo.id}">Abrir archivo</button>`
            : ""}

          <button
            class="${promo.activo ? "support-danger-button" : "support-ghost-button"}"
            data-toggle-promo="${promo.id}"
          >
            ${promo.activo ? "Desactivar" : "Activar"}
          </button>

          <button
            class="support-danger-button"
            data-delete-promo="${promo.id}"
          >
            Eliminar
          </button>
        </div>
      </div>
    `;

    promoList.appendChild(card);
  });

  document.querySelectorAll("[data-open-promo]").forEach(function (button) {
    button.addEventListener("click", function () {
      const promo =
        state.promos.find(function (item) {
          return item.id === button.dataset.openPromo;
        });

      const url = promo ? getPromoUrl(promo) : null;

      if (url) {
        window.open(url, "_blank", "noopener");
      }
    });
  });

  document.querySelectorAll("[data-toggle-promo]").forEach(function (button) {
    button.addEventListener("click", function () {
      togglePromotion(button.dataset.togglePromo);
    });
  });

  document.querySelectorAll("[data-delete-promo]").forEach(function (button) {
    button.addEventListener("click", function () {
      deletePromotion(button.dataset.deletePromo);
    });
  });
}

async function togglePromotion(promoId) {
  const promo =
    state.promos.find(function (item) {
      return item.id === promoId;
    });

  if (!promo) return;

  const { error } = await supabase.rpc(
    "soporte_actualizar_promocion",
    {
      p_promocion_id: promoId,
      p_activo: !promo.activo
    }
  );

  if (error) {
    showToast(error.message || "No se pudo cambiar el estado.", "error");
    return;
  }

  showToast(
    promo.activo ? "Promoción desactivada." : "Promoción activada.",
    "success"
  );

  await selectStation(state.selectedStation.id);
}

async function deletePromotion(promoId) {
  const promo =
    state.promos.find(function (item) {
      return item.id === promoId;
    });

  if (!promo) return;

  const message =
    promo.pantalla_id === null
      ? "Esta promoción aparece en todas las televisiones de la estación. ¿Querés eliminarla?"
      : "¿Querés eliminar definitivamente esta promoción?";

  if (!confirm(message)) return;

  const paths = [];

  [promo.path, promo.path_horizontal, promo.path_vertical].forEach(
    function (path) {
      if (path && !paths.includes(path)) {
        paths.push(path);
      }
    }
  );

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("promos")
      .remove(paths);

    if (storageError) {
      showToast(
        "No se pudo eliminar el archivo de Storage. No se modificó la promoción.",
        "error"
      );
      return;
    }
  }

  const { error } = await supabase.rpc(
    "soporte_eliminar_promocion",
    {
      p_promocion_id: promoId
    }
  );

  if (error) {
    showToast(
      error.message || "El archivo se eliminó, pero falló el borrado del registro.",
      "error"
    );
    return;
  }

  showToast("Promoción eliminada.", "success");
  await selectStation(state.selectedStation.id);
}

/* =====================================================
   TABS
===================================================== */

function activateTab(tabName) {
  document.querySelectorAll(".support-tab").forEach(function (button) {
    button.classList.toggle(
      "active",
      button.dataset.tab === tabName
    );
  });

  document.querySelectorAll(".support-tab-panel").forEach(function (panel) {
    panel.classList.add("hidden");
  });

  const selectedPanel =
    document.getElementById(`tab-${tabName}`);

  if (selectedPanel) {
    selectedPanel.classList.remove("hidden");
  }
}

/* =====================================================
   AUXILIARES
===================================================== */

function getPromoUrl(promo) {
  if (promo.pantalla_id === null) {
    return promo.url || promo.url_horizontal || promo.url_vertical || "";
  }

  const screen =
    state.screens.find(function (item) {
      return item.id === promo.pantalla_id;
    });

  if (screen && screen.orientacion === "vertical") {
    return promo.url_vertical || promo.url || "";
  }

  return promo.url_horizontal || promo.url || "";
}

function getPromoType(promo) {
  if (promo.pantalla_id === null) {
    return promo.tipo || promo.tipo_horizontal || promo.tipo_vertical || "";
  }

  const screen =
    state.screens.find(function (item) {
      return item.id === promo.pantalla_id;
    });

  if (screen && screen.orientacion === "vertical") {
    return promo.tipo_vertical || promo.tipo || "";
  }

  return promo.tipo_horizontal || promo.tipo || "";
}

function getPromoPath(promo) {
  if (promo.pantalla_id === null) {
    return promo.path || promo.path_horizontal || promo.path_vertical || "";
  }

  const screen =
    state.screens.find(function (item) {
      return item.id === promo.pantalla_id;
    });

  if (screen && screen.orientacion === "vertical") {
    return promo.path_vertical || promo.path || "";
  }

  return promo.path_horizontal || promo.path || "";
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(function (word) {
      return word.charAt(0).toUpperCase();
    })
    .join("");
}

function setLoginStatus(message, type) {
  supportLoginStatus.textContent = message || "";
  supportLoginStatus.classList.remove("error", "success");

  if (type) {
    supportLoginStatus.classList.add(type);
  }
}

function showToast(message, type) {
  clearTimeout(toastTimer);

  supportToast.textContent = message;
  supportToast.className = "support-toast";

  if (type) {
    supportToast.classList.add(type);
  }

  requestAnimationFrame(function () {
    supportToast.classList.add("show");
  });

  toastTimer = setTimeout(function () {
    supportToast.classList.remove("show");
  }, 3500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

/* =====================================================
   INICIO
===================================================== */

verifyExistingSession();
