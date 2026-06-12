import { supabase } from "./supabase-config.js";

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

const email = document.getElementById("email");
const password = document.getElementById("password");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnSubir = document.getElementById("btnSubir");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnRefrescar = document.getElementById("btnRefrescar");

const btnCopiarHorizontal = document.getElementById("btnCopiarHorizontal");
const btnCopiarVertical = document.getElementById("btnCopiarVertical");

const archivoHorizontal = document.getElementById("archivoHorizontal");
const archivoVertical = document.getElementById("archivoVertical");

const previewHorizontal = document.getElementById("previewHorizontal");
const previewVertical = document.getElementById("previewVertical");

const listaPromos = document.getElementById("listaPromos");
const tituloEstacion = document.getElementById("tituloEstacion");

const loginStatus = document.getElementById("loginStatus");
const uploadStatus = document.getElementById("uploadStatus");

let usuario = null;
let estacion = null;

btnLogin.addEventListener("click", login);
btnLogout.addEventListener("click", logout);
btnSubir.addEventListener("click", subirPromo);
btnLimpiar.addEventListener("click", limpiarSeleccion);
btnRefrescar.addEventListener("click", cargarPromos);

btnCopiarHorizontal.addEventListener("click", () => copiarLink("horizontal"));
btnCopiarVertical.addEventListener("click", () => copiarLink("vertical"));

archivoHorizontal.addEventListener("change", () => mostrarPreview(archivoHorizontal, previewHorizontal, "horizontal"));
archivoVertical.addEventListener("change", () => mostrarPreview(archivoVertical, previewVertical, "vertical"));

async function login() {
  setStatus(loginStatus, "Ingresando...", "");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value
  });

  if (error) {
    setStatus(loginStatus, "Usuario o contraseña incorrectos.", "error");
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
    setStatus(loginStatus, "Este usuario no tiene estación asignada.", "error");
    return;
  }

  estacion = data;

  loginBox.classList.add("hidden");
  adminBox.classList.remove("hidden");

  tituloEstacion.textContent = `Promociones - ${estacion.nombre}`;

  await cargarPromos();
}

async function logout() {
  await supabase.auth.signOut();

  usuario = null;
  estacion = null;

  loginBox.classList.remove("hidden");
  adminBox.classList.add("hidden");

  email.value = "";
  password.value = "";
  setStatus(loginStatus, "", "");
}

function obtenerTipo(file) {
  if (!file) return null;
  return file.type.startsWith("video") ? "video" : "imagen";
}

function validarArchivo(file) {
  if (!file) return true;

  const formatosPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  return formatosPermitidos.includes(file.type);
}

async function subirArchivo(file, orientacion) {
  if (!file) return null;

  if (!validarArchivo(file)) {
    throw new Error(`Formato no permitido para archivo ${orientacion}. Usá JPG, PNG, WEBP, MP4, WEBM o MOV.`);
  }

  const extension = file.name.split(".").pop();
  const nombreArchivo = `${Date.now()}-${orientacion}.${extension}`;
  const path = `${estacion.slug}/${orientacion}/${nombreArchivo}`;

  const { error } = await supabase.storage
    .from("promos")
    .upload(path, file);

  if (error) {
    console.error(error);
    throw new Error(`No se pudo subir el archivo ${orientacion}.`);
  }

  const { data } = supabase.storage
    .from("promos")
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path: path,
    tipo: obtenerTipo(file)
  };
}

async function subirPromo() {
  const fileHorizontal = archivoHorizontal.files[0];
  const fileVertical = archivoVertical.files[0];

  if (!fileHorizontal && !fileVertical) {
    setStatus(uploadStatus, "Tenés que seleccionar al menos un archivo horizontal o vertical.", "error");
    return;
  }

  try {
    btnSubir.disabled = true;
    btnSubir.textContent = "Subiendo...";
    setStatus(uploadStatus, "Subiendo archivos, esperá unos segundos...", "");

    const horizontal = await subirArchivo(fileHorizontal, "horizontal");
    const vertical = await subirArchivo(fileVertical, "vertical");

    const { error } = await supabase
      .from("promociones")
      .insert({
        estacion_id: estacion.id,
        activo: true,
        orden: 1,

        tipo: "promo",

        url_horizontal: horizontal ? horizontal.url : null,
        path_horizontal: horizontal ? horizontal.path : null,
        tipo_horizontal: horizontal ? horizontal.tipo : null,

        url_vertical: vertical ? vertical.url : null,
        path_vertical: vertical ? vertical.path : null,
        tipo_vertical: vertical ? vertical.tipo : null,

        url: horizontal ? horizontal.url : vertical.url,
        path: horizontal ? horizontal.path : vertical.path
      });

    if (error) {
      console.error(error);
      setStatus(uploadStatus, "El archivo subió, pero hubo un error al guardar la promoción.", "error");
      return;
    }

    limpiarSeleccion();

    setStatus(uploadStatus, "Promoción guardada correctamente.", "success");

    await cargarPromos();

  } catch (error) {
    console.error(error);
    setStatus(uploadStatus, error.message || "Error al subir la promoción.", "error");

  } finally {
    btnSubir.disabled = false;
    btnSubir.textContent = "Guardar promoción";
  }
}

async function cargarPromos() {
  if (!estacion) return;

  listaPromos.innerHTML = `<p class="status-message">Cargando promociones...</p>`;

  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("estacion_id", estacion.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    listaPromos.innerHTML = `<p class="status-message status-error">No se pudieron cargar las promociones.</p>`;
    return;
  }

  listaPromos.innerHTML = "";

  if (!data || data.length === 0) {
    listaPromos.innerHTML = `<p class="status-message">Todavía no hay promociones cargadas.</p>`;
    return;
  }

  data.forEach(promo => {
    const div = document.createElement("article");
    div.className = promo.activo ? "promo-item" : "promo-item inactive";

    div.innerHTML = `
      <div class="promo-info">
        <div class="preview-group">
          ${crearPreviewCard("Horizontal", promo.url_horizontal, promo.tipo_horizontal, "horizontal")}
          ${crearPreviewCard("Vertical", promo.url_vertical, promo.tipo_vertical, "vertical")}
        </div>

        <div class="promo-meta">
          <strong>${promo.activo ? "Promoción activa" : "Promoción inactiva"}</strong>
          <p>Horizontal: ${promo.url_horizontal ? "cargada" : "no cargada"}</p>
          <p>Vertical: ${promo.url_vertical ? "cargada" : "no cargada"}</p>
        </div>
      </div>

      <div class="promo-actions">
        <button class="toggle-btn" data-toggle="${promo.id}">
          ${promo.activo ? "Desactivar" : "Activar"}
        </button>

        <button class="delete" data-delete="${promo.id}">
          Eliminar
        </button>
      </div>
    `;

    listaPromos.appendChild(div);
  });

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.toggle;
      const promo = data.find(p => p.id === id);

      await supabase
        .from("promociones")
        .update({ activo: !promo.activo })
        .eq("id", id);

      await cargarPromos();
    });
  });

  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const confirmar = confirm("¿Querés eliminar esta promoción?");

      if (!confirmar) return;

      const id = btn.dataset.delete;
      const promo = data.find(p => p.id === id);

      await eliminarPromo(promo);
      await cargarPromos();
    });
  });
}

function crearPreviewCard(label, url, tipo, orientacion) {
  const clase = orientacion === "vertical" ? "promo-preview-card vertical-card" : "promo-preview-card";

  let contenido = `<div class="promo-preview">Sin archivo</div>`;

  if (url && tipo === "imagen") {
    contenido = `
      <div class="promo-preview">
        <img src="${url}" alt="Vista previa ${label}">
      </div>
    `;
  }

  if (url && tipo === "video") {
    contenido = `
      <div class="promo-preview">
        <video src="${url}" muted></video>
      </div>
    `;
  }

  return `
    <div class="${clase}">
      <span class="preview-label">${label}</span>
      ${contenido}
    </div>
  `;
}

async function eliminarPromo(promo) {
  const archivos = [];

  if (promo.path_horizontal) archivos.push(promo.path_horizontal);
  if (promo.path_vertical) archivos.push(promo.path_vertical);

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

function mostrarPreview(input, previewElement, orientacion) {
  const file = input.files[0];

  previewElement.innerHTML = "";
  previewElement.classList.remove("empty-preview");

  if (!file) {
    previewElement.textContent = orientacion === "horizontal"
      ? "Sin archivo horizontal"
      : "Sin archivo vertical";

    previewElement.classList.add("empty-preview");
    return;
  }

  const url = URL.createObjectURL(file);

  if (file.type.startsWith("video")) {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.controls = true;

    previewElement.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.alt = `Preview ${orientacion}`;

    previewElement.appendChild(img);
  }
}

function limpiarSeleccion() {
  archivoHorizontal.value = "";
  archivoVertical.value = "";

  previewHorizontal.innerHTML = "Sin archivo horizontal";
  previewVertical.innerHTML = "Sin archivo vertical";

  previewHorizontal.classList.add("empty-preview");
  previewVertical.classList.add("empty-preview");

  setStatus(uploadStatus, "", "");
}

async function copiarLink(orientacion) {
  if (!estacion) return;

  const link = `${window.location.origin}/pantalla.html?estacion=${estacion.slug}&orientacion=${orientacion}`;

  try {
    await navigator.clipboard.writeText(link);
    setStatus(uploadStatus, `Link ${orientacion} copiado correctamente.`, "success");
  } catch {
    setStatus(uploadStatus, link, "");
  }
}

function setStatus(element, message, type) {
  element.textContent = message;

  element.classList.remove("status-success", "status-error");

  if (type === "success") {
    element.classList.add("status-success");
  }

  if (type === "error") {
    element.classList.add("status-error");
  }
}

verificarSesion();