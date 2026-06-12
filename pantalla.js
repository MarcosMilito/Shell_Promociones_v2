import { supabase } from "./supabase-config.js";

const slider = document.getElementById("slider");

let promociones = [];
let indice = 0;
let temporizador = null;
let estacionId = null;
let canalRealtime = null;

const params = new URLSearchParams(window.location.search);
const slug = params.get("estacion");
const orientacion = params.get("orientacion") === "vertical" ? "vertical" : "horizontal";

async function obtenerEstacion() {
  if (!slug) {
    slider.innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("estaciones")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("No se encontró la estación:", error);
    slider.innerHTML = "";
    return;
  }

  estacionId = data.id;

  await cargarPromos();
  escucharCambios();
}

async function cargarPromos() {
  if (!estacionId) return;

  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("estacion_id", estacionId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error al cargar promociones:", error);
    return;
  }

  /*
    CORRECCIÓN IMPORTANTE:
    - Pantalla horizontal: solo muestra promociones con archivo horizontal.
    - Pantalla vertical: solo muestra promociones con archivo vertical.
    - No hay fallback entre orientaciones.
  */

  promociones = data.filter(promo => {
    if (orientacion === "vertical") {
      return Boolean(promo.url_vertical && promo.tipo_vertical);
    }

    return Boolean(promo.url_horizontal && promo.tipo_horizontal);
  });

  indice = 0;
  mostrarPromo();
}

function obtenerArchivoPromo(promo) {
  if (orientacion === "vertical") {
    return {
      url: promo.url_vertical,
      tipo: promo.tipo_vertical
    };
  }

  return {
    url: promo.url_horizontal,
    tipo: promo.tipo_horizontal
  };
}

function mostrarPromo() {
  clearTimeout(temporizador);
  slider.innerHTML = "";

  if (promociones.length === 0) {
    return;
  }

  const promo = promociones[indice];
  const archivo = obtenerArchivoPromo(promo);

  if (!archivo.url || !archivo.tipo) {
    siguientePromo();
    return;
  }

  if (archivo.tipo === "imagen") {
    const img = document.createElement("img");
    img.src = archivo.url;
    img.alt = "Promoción";

    slider.appendChild(img);

    temporizador = setTimeout(siguientePromo, 7000);
    return;
  }

  if (archivo.tipo === "video") {
    const video = document.createElement("video");
    video.src = archivo.url;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    slider.appendChild(video);

    video.onended = siguientePromo;

    video.onerror = () => {
      siguientePromo();
    };

    return;
  }

  siguientePromo();
}

function siguientePromo() {
  if (promociones.length === 0) return;

  indice++;

  if (indice >= promociones.length) {
    indice = 0;
  }

  mostrarPromo();
}

function escucharCambios() {
  if (canalRealtime) {
    supabase.removeChannel(canalRealtime);
  }

  canalRealtime = supabase
    .channel("promociones-" + estacionId)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "promociones",
        filter: `estacion_id=eq.${estacionId}`
      },
      async () => {
        await cargarPromos();
      }
    )
    .subscribe();
}

obtenerEstacion();