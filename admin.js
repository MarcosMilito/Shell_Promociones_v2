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

async function subirPromo() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";

  input.click();

  input.onchange = async () => {
    const file = input.files[0];

    if (!file) return;

    const esVideo = file.type.startsWith("video");
    const tipo = esVideo ? "video" : "imagen";

    const extension = file.name.split(".").pop();
    const nombreArchivo = `${Date.now()}.${extension}`;
    const path = `${estacion.slug}/${nombreArchivo}`;

    const { error: uploadError } = await supabase.storage
      .from("promos")
      .upload(path, file);

    if (uploadError) {
      alert("Error al subir el archivo");
      console.error(uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("promos")
      .getPublicUrl(path);

    const { error: insertError } = await supabase
      .from("promociones")
      .insert({
        estacion_id: estacion.id,
        tipo: tipo,
        url: publicUrlData.publicUrl,
        path: path,
        activo: true,
        orden: 1
      });

    if (insertError) {
      alert("Error al guardar la promoción");
      console.error(insertError);
      return;
    }

    alert("Promoción subida correctamente");
    cargarPromos();
  };
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

    const preview = promo.tipo === "imagen"
      ? `<img class="promo-preview" src="${promo.url}">`
      : `<video class="promo-preview" src="${promo.url}" muted></video>`;

    div.innerHTML = `
      <div class="promo-info">
        ${preview}
        <div>
          <strong>${promo.tipo.toUpperCase()}</strong>
          <p>${promo.activo ? "Activa" : "Inactiva"}</p>
        </div>
      </div>

      <div class="promo-actions">
        <button data-toggle="${promo.id}">
          ${promo.activo ? "Desactivar" : "Activar"}
        </button>

        <button class="delete" data-delete="${promo.id}" data-path="${promo.path}">
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
      const path = btn.dataset.path;

      await supabase.storage
        .from("promos")
        .remove([path]);

      await supabase
        .from("promociones")
        .delete()
        .eq("id", id);

      cargarPromos();
    });
  });
}

verificarSesion();