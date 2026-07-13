import { supabase } from "./supabase-config.js";

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

const email = document.getElementById("email");
const password = document.getElementById("password");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const tituloEstacion = document.getElementById("tituloEstacion");

const nombrePantalla = document.getElementById("nombrePantalla");
const orientacionPantalla = document.getElementById("orientacionPantalla");
const duracionPantalla = document.getElementById("duracionPantalla");

const btnCrearPantalla = document.getElementById("btnCrearPantalla");
const selectorPantalla = document.getElementById("selectorPantalla");

const btnCopiarLink = document.getElementById("btnCopiarLink");
const btnEliminarPantalla = document.getElementById("btnEliminarPantalla");

const datosPantalla = document.getElementById("datosPantalla");
const textoOrientacion = document.getElementById("textoOrientacion");

const archivoPromo = document.getElementById("archivoPromo");
const previewPromo = document.getElementById("previewPromo");

const btnSubir = document.getElementById("btnSubir");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnRefrescar = document.getElementById("btnRefrescar");

const listaPromos = document.getElementById("listaPromos");

const loginStatus = document.getElementById("loginStatus");
const pantallaStatus = document.getElementById("pantallaStatus");
const uploadStatus = document.getElementById("uploadStatus");

let usuario = null;
let estacion = null;

let pantallas = [];
let pantallaSeleccionada = null;

btnLogin.addEventListener("click", login);
btnLogout.addEventListener("click", logout);

btnCrearPantalla.addEventListener("click", crearPantalla);

selectorPantalla.addEventListener("change", seleccionarPantalla);

btnCopiarLink.addEventListener("click", copiarLinkPantalla);
btnEliminarPantalla.addEventListener("click", eliminarPantalla);

archivoPromo.addEventListener("change", mostrarPreview);

btnSubir.addEventListener("click", subirPromo);
btnLimpiar.addEventListener("click", limpiarSeleccion);
btnRefrescar.addEventListener("click", cargarPromos);

async function login() {
  setStatus(loginStatus, "Ingresando...", "");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value
  });

  if (error) {
    setStatus(
      loginStatus,
      "Usuario o contraseña incorrectos.",
      "error"
    );

    return;
  }

  usuario = data.user;

  await cargarEstacion();
}

async function verificarSesion() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    usuario = data.session.user;

    await cargarEstacion();
  }
}

async function cargarEstacion() {
  const { data, error } = await supabase
    .from("estaciones")
    .select("*")
    .eq("user_id", usuario.id)
    .single();

  if (error || !data) {
    setStatus(
      loginStatus,
      "Este usuario no tiene una estación asignada.",
      "error"
    );

    return;
  }

  estacion = data;

  loginBox.classList.add("hidden");
  adminBox.classList.remove("hidden");

  tituloEstacion.textContent =
    `Promociones - ${estacion.nombre}`;

  await cargarPantallas();
}

async function logout() {
  await supabase.auth.signOut();

  usuario = null;
  estacion = null;
  pantallas = [];
  pantallaSeleccionada = null;

  loginBox.classList.remove("hidden");
  adminBox.classList.add("hidden");

  email.value = "";
  password.value = "";

  setStatus(loginStatus, "", "");
}

function convertirEnSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function crearPantalla() {
  if (!estacion) return;

  const nombre = nombrePantalla.value.trim();
  const orientacion = orientacionPantalla.value;

  const duracion = Number(duracionPantalla.value);

  if (!nombre) {
    setStatus(
      pantallaStatus,
      "Ingresá un nombre para la televisión.",
      "error"
    );

    return;
  }

  if (duracion < 3 || duracion > 60) {
    setStatus(
      pantallaStatus,
      "La duración debe estar entre 3 y 60 segundos.",
      "error"
    );

    return;
  }

  const codigo =
    `${estacion.slug}-${convertirEnSlug(nombre)}`;

  btnCrearPantalla.disabled = true;
  btnCrearPantalla.textContent = "Creando...";

  const { data, error } = await supabase
    .from("pantallas")
    .insert({
      estacion_id: estacion.id,
      nombre,
      codigo,
      orientacion,
      duracion_imagen: duracion,
      activo: true
    })
    .select()
    .single();

  btnCrearPantalla.disabled = false;
  btnCrearPantalla.textContent = "Crear televisión";

  if (error) {
    console.error(error);

    if (
      error.message &&
      error.message.toLowerCase().includes("duplicate")
    ) {
      setStatus(
        pantallaStatus,
        "Ya existe una televisión con ese nombre.",
        "error"
      );
    } else {
      setStatus(
        pantallaStatus,
        "No se pudo crear la televisión.",
        "error"
      );
    }

    return;
  }

  nombrePantalla.value = "";
  duracionPantalla.value = "7";

  setStatus(
    pantallaStatus,
    "Televisión creada correctamente.",
    "success"
  );

  await cargarPantallas(data.id);
}

async function cargarPantallas(seleccionarId = null) {
  if (!estacion) return;

  const { data, error } = await supabase
    .from("pantallas")
    .select("*")
    .eq("estacion_id", estacion.id)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(error);

    setStatus(
      pantallaStatus,
      "No se pudieron cargar las televisiones.",
      "error"
    );

    return;
  }

  pantallas = data || [];

  selectorPantalla.innerHTML = "";

  if (pantallas.length === 0) {
    selectorPantalla.innerHTML = `
      <option value="">
        No hay televisiones creadas
      </option>
    `;

    pantallaSeleccionada = null;

    actualizarDatosPantalla();

    listaPromos.innerHTML = `
      <p class="status-message">
        Primero creá una televisión.
      </p>
    `;

    return;
  }

  pantallas.forEach((pantalla) => {
    const option = document.createElement("option");

    option.value = pantalla.id;

    option.textContent =
      `${pantalla.nombre} - ${pantalla.orientacion}`;

    selectorPantalla.appendChild(option);
  });

  const idFinal =
    seleccionarId ||
    pantallaSeleccionada?.id ||
    pantallas[0].id;

  selectorPantalla.value = idFinal;

  seleccionarPantalla();
}

function seleccionarPantalla() {
  const id = selectorPantalla.value;

  pantallaSeleccionada =
    pantallas.find((pantalla) => pantalla.id === id) || null;

  actualizarDatosPantalla();
  limpiarSeleccion();
  cargarPromos();
}

function actualizarDatosPantalla() {
  if (!pantallaSeleccionada) {
    datosPantalla.classList.add("hidden");

    datosPantalla.innerHTML = "";

    textoOrientacion.textContent =
      "Primero seleccioná una televisión.";

    return;
  }

  const enlace =
    `${window.location.origin}/tv/${pantallaSeleccionada.codigo}`;

  datosPantalla.classList.remove("hidden");

  datosPantalla.innerHTML = `
    <strong>${pantallaSeleccionada.nombre}</strong>

    <p>
      Orientación:
      ${pantallaSeleccionada.orientacion}
    </p>

    <p>
      Tiempo por imagen:
      ${pantallaSeleccionada.duracion_imagen} segundos
    </p>

    <p class="screen-url">
      ${enlace}
    </p>
  `;

  textoOrientacion.textContent =
    pantallaSeleccionada.orientacion === "vertical"
      ? "Formato recomendado: 1080 × 1920"
      : "Formato recomendado: 1920 × 1080";
}

async function copiarLinkPantalla() {
  if (!pantallaSeleccionada) {
    setStatus(
      pantallaStatus,
      "Primero seleccioná una televisión.",
      "error"
    );

    return;
  }

  const enlace =
    `${window.location.origin}/tv/${pantallaSeleccionada.codigo}`;

  try {
    await navigator.clipboard.writeText(enlace);

    setStatus(
      pantallaStatus,
      "Enlace copiado correctamente.",
      "success"
    );
  } catch {
    setStatus(
      pantallaStatus,
      enlace,
      ""
    );
  }
}

async function eliminarPantalla() {
  if (!pantallaSeleccionada) return;

  const confirmar = confirm(
    `¿Querés eliminar "${pantallaSeleccionada.nombre}" y todas sus promociones?`
  );

  if (!confirmar) return;

  const { data: promociones } = await supabase
    .from("promociones")
    .select("path,path_horizontal,path_vertical")
    .eq("pantalla_id", pantallaSeleccionada.id);

  const archivos = [];

  (promociones || []).forEach((promo) => {
    if (promo.path_horizontal) {
      archivos.push(promo.path_horizontal);
    }

    if (promo.path_vertical) {
      archivos.push(promo.path_vertical);
    }

    if (
      promo.path &&
      !archivos.includes(promo.path)
    ) {
      archivos.push(promo.path);
    }
  });

  if (archivos.length > 0) {
    await supabase.storage
      .from("promos")
      .remove(archivos);
  }

  const { error } = await supabase
    .from("pantallas")
    .delete()
    .eq("id", pantallaSeleccionada.id);

  if (error) {
    console.error(error);

    setStatus(
      pantallaStatus,
      "No se pudo eliminar la televisión.",
      "error"
    );

    return;
  }

  pantallaSeleccionada = null;

  setStatus(
    pantallaStatus,
    "Televisión eliminada.",
    "success"
  );

  await cargarPantallas();
}

function validarArchivo(file) {
  if (!file) return false;

  const formatosPermitidos = [
    "image/jpeg",
    "image/png",
    "video/mp4"
  ];

  return formatosPermitidos.includes(file.type);
}

function obtenerTipo(file) {
  if (file.type.startsWith("video")) {
    return "video";
  }

  return "imagen";
}

async function subirArchivo(file) {
  const extension =
    file.name.split(".").pop().toLowerCase();

  const nombreArchivo =
    `${Date.now()}.${extension}`;

  const path =
    `${estacion.slug}/${pantallaSeleccionada.codigo}/${nombreArchivo}`;

  const { error } = await supabase.storage
    .from("promos")
    .upload(path, file);

  if (error) {
    console.error(error);

    throw new Error(
      "No se pudo subir el archivo."
    );
  }

  const { data } = supabase.storage
    .from("promos")
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
    tipo: obtenerTipo(file)
  };
}

async function subirPromo() {
  if (!pantallaSeleccionada) {
    setStatus(
      uploadStatus,
      "Primero seleccioná una televisión.",
      "error"
    );

    return;
  }

  const file = archivoPromo.files[0];

  if (!file) {
    setStatus(
      uploadStatus,
      "Seleccioná una imagen o un video.",
      "error"
    );

    return;
  }

  if (!validarArchivo(file)) {
    setStatus(
      uploadStatus,
      "Usá únicamente JPG, PNG o MP4.",
      "error"
    );

    return;
  }

  try {
    btnSubir.disabled = true;
    btnSubir.textContent = "Subiendo...";

    setStatus(
      uploadStatus,
      "Subiendo promoción...",
      ""
    );

    const archivo = await subirArchivo(file);

    const { count } = await supabase
      .from("promociones")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("pantalla_id", pantallaSeleccionada.id);

    const datosPromo = {
      estacion_id: estacion.id,
      pantalla_id: pantallaSeleccionada.id,

      tipo: archivo.tipo,
      url: archivo.url,
      path: archivo.path,

      activo: true,
      orden: (count || 0) + 1,

      url_horizontal: null,
      path_horizontal: null,
      tipo_horizontal: null,

      url_vertical: null,
      path_vertical: null,
      tipo_vertical: null
    };

    if (pantallaSeleccionada.orientacion === "vertical") {
      datosPromo.url_vertical = archivo.url;
      datosPromo.path_vertical = archivo.path;
      datosPromo.tipo_vertical = archivo.tipo;
    } else {
      datosPromo.url_horizontal = archivo.url;
      datosPromo.path_horizontal = archivo.path;
      datosPromo.tipo_horizontal = archivo.tipo;
    }

    const { error } = await supabase
      .from("promociones")
      .insert(datosPromo);

    if (error) {
      console.error(error);

      throw new Error(
        "El archivo subió, pero no se pudo guardar la promoción."
      );
    }

    limpiarSeleccion();

    setStatus(
      uploadStatus,
      "Promoción guardada correctamente.",
      "success"
    );

    await cargarPromos();

  } catch (error) {
    console.error(error);

    setStatus(
      uploadStatus,
      error.message || "Error al guardar la promoción.",
      "error"
    );

  } finally {
    btnSubir.disabled = false;
    btnSubir.textContent = "Guardar promoción";
  }
}

async function cargarPromos() {
  if (!pantallaSeleccionada) {
    listaPromos.innerHTML = `
      <p class="status-message">
        Seleccioná una televisión.
      </p>
    `;

    return;
  }

  listaPromos.innerHTML = `
    <p class="status-message">
      Cargando promociones...
    </p>
  `;

  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("pantalla_id", pantallaSeleccionada.id)
    .order("orden", {
      ascending: true
    })
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(error);

    listaPromos.innerHTML = `
      <p class="status-message status-error">
        No se pudieron cargar las promociones.
      </p>
    `;

    return;
  }

  listaPromos.innerHTML = "";

  if (!data || data.length === 0) {
    listaPromos.innerHTML = `
      <p class="status-message">
        Esta televisión todavía no tiene promociones.
      </p>
    `;

    return;
  }

  data.forEach((promo) => {
    const archivo = obtenerArchivoPromo(promo);

    const article = document.createElement("article");

    article.className =
      promo.activo
        ? "promo-item"
        : "promo-item inactive";

    article.innerHTML = `
      <div class="promo-info">

        <div class="promo-preview-card">

          <span class="preview-label">
            ${pantallaSeleccionada.orientacion}
          </span>

          <div class="promo-preview">
            ${crearVistaPrevia(archivo)}
          </div>

        </div>

        <div class="promo-meta">

          <strong>
            ${promo.activo
              ? "Promoción activa"
              : "Promoción inactiva"}
          </strong>

          <p>
            Orden: ${promo.orden || 1}
          </p>

          <p>
            Tipo: ${archivo.tipo || "archivo"}
          </p>

        </div>

      </div>

      <div class="promo-actions">

        <button
          class="toggle-btn"
          data-toggle="${promo.id}"
        >
          ${promo.activo
            ? "Desactivar"
            : "Activar"}
        </button>

        <button
          class="delete"
          data-delete="${promo.id}"
        >
          Eliminar
        </button>

      </div>
    `;

    listaPromos.appendChild(article);
  });

  document
    .querySelectorAll("[data-toggle]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.toggle;

        const promo =
          data.find((item) => item.id === id);

        await supabase
          .from("promociones")
          .update({
            activo: !promo.activo
          })
          .eq("id", id);

        await cargarPromos();
      });
    });

  document
    .querySelectorAll("[data-delete]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmar = confirm(
          "¿Querés eliminar esta promoción?"
        );

        if (!confirmar) return;

        const id = button.dataset.delete;

        const promo =
          data.find((item) => item.id === id);

        await eliminarPromo(promo);
        await cargarPromos();
      });
    });
}

function obtenerArchivoPromo(promo) {
  if (pantallaSeleccionada.orientacion === "vertical") {
    return {
      url: promo.url_vertical || promo.url,
      path: promo.path_vertical || promo.path,
      tipo: promo.tipo_vertical || promo.tipo
    };
  }

  return {
    url: promo.url_horizontal || promo.url,
    path: promo.path_horizontal || promo.path,
    tipo: promo.tipo_horizontal || promo.tipo
  };
}

function crearVistaPrevia(archivo) {
  if (!archivo.url) {
    return "Sin archivo";
  }

  if (archivo.tipo === "video") {
    return `
      <video
        src="${archivo.url}"
        muted
        preload="metadata"
      ></video>
    `;
  }

  return `
    <img
      src="${archivo.url}"
      alt="Vista previa"
    >
  `;
}

async function eliminarPromo(promo) {
  const archivos = [];

  if (promo.path_horizontal) {
    archivos.push(promo.path_horizontal);
  }

  if (promo.path_vertical) {
    archivos.push(promo.path_vertical);
  }

  if (
    promo.path &&
    !archivos.includes(promo.path)
  ) {
    archivos.push(promo.path);
  }

  if (archivos.length > 0) {
    await supabase.storage
      .from("promos")
      .remove(archivos);
  }

  await supabase
    .from("promociones")
    .delete()
    .eq("id", promo.id);
}

function mostrarPreview() {
  const file = archivoPromo.files[0];

  previewPromo.innerHTML = "";

  if (!file) {
    previewPromo.textContent =
      "Sin archivo seleccionado";

    previewPromo.classList.add("empty-preview");

    return;
  }

  previewPromo.classList.remove("empty-preview");

  const url = URL.createObjectURL(file);

  if (file.type.startsWith("video")) {
    const video = document.createElement("video");

    video.src = url;
    video.controls = true;
    video.muted = true;

    previewPromo.appendChild(video);
  } else {
    const image = document.createElement("img");

    image.src = url;
    image.alt = "Vista previa";

    previewPromo.appendChild(image);
  }
}

function limpiarSeleccion() {
  archivoPromo.value = "";

  previewPromo.innerHTML =
    "Sin archivo seleccionado";

  previewPromo.classList.add("empty-preview");
}

function setStatus(element, message, type) {
  element.textContent = message;

  element.classList.remove(
    "status-success",
    "status-error"
  );

  if (type === "success") {
    element.classList.add("status-success");
  }

  if (type === "error") {
    element.classList.add("status-error");
  }
}

verificarSesion();