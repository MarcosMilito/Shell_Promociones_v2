import { supabase } from "./supabase-config.js";

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const email = document.getElementById("email");
const password = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnSubir = document.getElementById("btnSubir");
const listaPromos = document.getElementById("listaPromos");
const tituloEstacion = document.getElementById("tituloEstacion");

const nombrePromo = document.getElementById("nombrePromo");
const archivoHorizontal = document.getElementById("archivoHorizontal");
const archivoVertical = document.getElementById("archivoVertical");

let usuario = null;
let estacion = null;

btnLogin.addEventListener("click", login);
btnLogout.addEventListener("click", logout);
btnSubir.addEventListener("click", subirPromo);

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  });

  if (error) {
    alert("Usuario o contraseña incorrectos");
    return;
  }

  usuario = data.user;
  cargarEstacion();
}

async function verificarSesion() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    usuario = data.session.user;
    cargarEstacion();
  }
}

async function cargarEstacion() {
  const { data, error } = await supabase
    .from("estaciones")
    .select("*")
    .eq("user_id", usuario.id)
    .single();

  if (error || !data) {
    alert("Este usuario no tiene estación asignada.");
    return;
  }

  estacion = data;

  loginBox.classList.add("hidden");
  adminBox.classList.remove("hidden");

  tituloEstacion.textContent = `Panel de promociones - ${estacion.nombre}`;

  cargarPromos();
}

async function logout() {
  await supabase.auth.signOut();

  usuario = null;
  estacion = null;

  loginBox.classList.remove("hidden");
  adminBox.classList.add("hidden");
}

function obtenerTipo(file) {
  if (!file) return null;
  return file.type.startsWith("video") ? "video" : "imagen";
}

async function subirArchivo(file, orientacion) {
  if (!file) return null;

  const extension = file.name.split(".").pop();
  const nombreArchivo = `${Date.now()}-${orientacion}.${extension}`;
  const path = `${estacion.slug}/${orientacion}/${nombreArchivo}`;

  const { error } = await supabase.storage
    .from("promos")
    .upload(path, file);

  if (error) {
    console.error(error);
    throw new Error("Error al subir archivo");
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
    alert("Tenés que subir al menos un archivo horizontal o vertical.");
    return;
  }

  try {
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
      alert("Error al guardar la promoción");
      return;
    }

    nombrePromo.value = "";
    archivoHorizontal.value = "";
    archivoVertical.value = "";

    alert("Promoción guardada correctamente");
    cargarPromos();

  } catch (error) {
    alert("Error al subir la promoción");
    console.error(error);
  }
}

async function cargarPromos() {
  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("estacion_id", estacion.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  listaPromos.innerHTML = "";

  if (data.length === 0) {
    listaPromos.innerHTML = "<p>No hay promociones cargadas.</p>";
    return;
  }

  data.forEach(promo => {
    const div = document.createElement("div");
    div.className = promo.activo ? "promo-item" : "promo-item inactive";

    const previewHorizontal = promo.url_horizontal
      ? `<img class="promo-preview" src="${promo.url_horizontal}">`
      : `<div class="promo-preview empty">Sin horizontal</div>`;

    const previewVertical = promo.url_vertical
      ? `<img class="promo-preview vertical-preview" src="${promo.url_vertical}">`
      : `<div class="promo-preview empty">Sin vertical</div>`;

    div.innerHTML = `
      <div class="promo-info">
        ${previewHorizontal}
        ${previewVertical}
        <div>
          <strong>PROMOCIÓN</strong>
          <p>${promo.activo ? "Activa" : "Inactiva"}</p>
          <p>Horizontal: ${promo.url_horizontal ? "Cargada" : "No cargada"}</p>
          <p>Vertical: ${promo.url_vertical ? "Cargada" : "No cargada"}</p>
        </div>
      </div>

      <div class="promo-actions">
        <button data-toggle="${promo.id}">
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

      cargarPromos();
    });
  });

  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const confirmar = confirm("¿Querés eliminar esta promoción?");

      if (!confirmar) return;

      const id = btn.dataset.delete;
      const promo = data.find(p => p.id === id);

      const archivosAEliminar = [];

      if (promo.path_horizontal) archivosAEliminar.push(promo.path_horizontal);
      if (promo.path_vertical) archivosAEliminar.push(promo.path_vertical);

      if (archivosAEliminar.length > 0) {
        await supabase.storage
          .from("promos")
          .remove(archivosAEliminar);
      }

      await supabase
        .from("promociones")
        .delete()
        .eq("id", id);

      cargarPromos();
    });
  });
}

verificarSesion();