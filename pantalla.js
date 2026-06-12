const SUPABASE_URL = "https://vymxicqitddocazvmpbr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a67bHY2v6IowOXGlQ6jmGQ_HV2h7dMA";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const slider = document.getElementById("slider");

let promociones = [];
let indice = 0;
let temporizador = null;
let estacionId = null;

const params = new URLSearchParams(window.location.search);
const slug = params.get("estacion");
const orientacion = params.get("orientacion") === "vertical" ? "vertical" : "horizontal";

async function obtenerEstacion() {
  if (!slug) {
    slider.innerHTML = "";
    return;
  }

  const respuesta = await supabaseClient
    .from("estaciones")
    .select("*")
    .eq("slug", slug)
    .single();

  if (respuesta.error || !respuesta.data) {
    console.error("No se encontró la estación:", respuesta.error);
    slider.innerHTML = "";
    return;
  }

  estacionId = respuesta.data.id;

  await cargarPromos();

  // En TV evitamos depender de realtime/websocket.
  // Mejor refrescar cada 30 segundos.
  setInterval(cargarPromos, 30000);
}

async function cargarPromos() {
  if (!estacionId) return;

  const respuesta = await supabaseClient
    .from("promociones")
    .select("*")
    .eq("estacion_id", estacionId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (respuesta.error) {
    console.error("Error al cargar promociones:", respuesta.error);
    return;
  }

  const data = respuesta.data || [];

  promociones = data.filter(function (promo) {
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

    img.onerror = function () {
      siguientePromo();
    };

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
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");

    video.onerror = function () {
      siguientePromo();
    };

    video.onended = function () {
      siguientePromo();
    };

    slider.appendChild(video);

    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise.catch(function () {
        siguientePromo();
      });
    }

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

obtenerEstacion();