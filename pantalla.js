import { supabase } from "./supabase-config.js";

const slider = document.getElementById("slider");

let promociones = [];
let indice = 0;
let temporizador = null;
let estacionId = null;

const params = new URLSearchParams(window.location.search);
const slug = params.get("estacion");

async function obtenerEstacion() {
  const { data, error } = await supabase
    .from("estaciones")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    slider.innerHTML = "";
    return;
  }

  estacionId = data.id;
  cargarPromos();
  escucharCambios();
}

async function cargarPromos() {
  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("estacion_id", estacionId)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  promociones = data;
  indice = 0;
  mostrarPromo();
}

function mostrarPromo() {
  clearTimeout(temporizador);
  slider.innerHTML = "";

  if (promociones.length === 0) return;

  const promo = promociones[indice];

  if (promo.tipo === "imagen") {
    const img = document.createElement("img");
    img.src = promo.url;

    slider.appendChild(img);

    temporizador = setTimeout(siguientePromo, 7000);
  }

  if (promo.tipo === "video") {
    const video = document.createElement("video");
    video.src = promo.url;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    slider.appendChild(video);

    video.onended = siguientePromo;
  }
}

function siguientePromo() {
  indice++;

  if (indice >= promociones.length) {
    indice = 0;
  }

  mostrarPromo();
}

function escucharCambios() {
  supabase
    .channel("promociones-" + estacionId)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "promociones",
        filter: `estacion_id=eq.${estacionId}`
      },
      () => {
        cargarPromos();
      }
    )
    .subscribe();
}

obtenerEstacion();