var SUPABASE_URL = "https://vymxicqitddocazvmpbr.supabase.co";
var SUPABASE_KEY = "sb_publishable_a67bHY2v6IowOXGlQ6jmGQ_HV2h7dMA";

var slider = document.getElementById("slider");

var promociones = [];
var indice = 0;
var temporizador = null;
var estacionId = null;

var slug = "";
var orientacion = "horizontal";

/* =========================
   LECTURA DE PARÁMETROS
========================= */

function obtenerParametro(nombre) {
  var query = window.location.search.substring(1);
  var partes = query.split("&");

  for (var i = 0; i < partes.length; i++) {
    var par = partes[i].split("=");

    if (decodeURIComponent(par[0]) === nombre) {
      return decodeURIComponent(par[1] || "");
    }
  }

  return null;
}

function configurarPantallaDesdeURL() {
  var partesRuta = window.location.pathname.split("/");

  /*
    Links nuevos cortos:
    /h/shell-lomas  → horizontal
    /v/shell-lomas  → vertical
  */

  if (partesRuta.length >= 3 && partesRuta[1] === "h") {
    orientacion = "horizontal";
    slug = partesRuta[2];
    return;
  }

  if (partesRuta.length >= 3 && partesRuta[1] === "v") {
    orientacion = "vertical";
    slug = partesRuta[2];
    return;
  }

  /*
    Links alternativos sin &
    pantalla.html?screen=shell-lomas-horizontal
    pantalla.html?screen=shell-lomas-vertical
  */

  var screen = obtenerParametro("screen");

  if (screen) {
    if (screen.indexOf("-vertical") !== -1) {
      orientacion = "vertical";
      slug = screen.replace("-vertical", "");
      return;
    }

    if (screen.indexOf("-horizontal") !== -1) {
      orientacion = "horizontal";
      slug = screen.replace("-horizontal", "");
      return;
    }
  }

  /*
    Links viejos:
    pantalla.html?estacion=shell-lomas&orientacion=horizontal
  */

  slug = obtenerParametro("estacion");
  orientacion = obtenerParametro("orientacion") === "vertical" ? "vertical" : "horizontal";
}

/* =========================
   SUPABASE REST COMPATIBLE
========================= */

function requestSupabase(endpoint, callback) {
  var xhr = new XMLHttpRequest();

  xhr.open("GET", SUPABASE_URL + "/rest/v1/" + endpoint, true);

  xhr.setRequestHeader("apikey", SUPABASE_KEY);
  xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_KEY);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e, null);
        }
      } else {
        callback(xhr.status, null);
      }
    }
  };

  xhr.send();
}

function mostrarMensajeDebug(texto) {
  var debug = obtenerParametro("debug");

  if (debug === "1") {
    slider.innerHTML =
      '<div style="color:white;font-family:Arial;padding:40px;font-size:28px;line-height:1.4;">' +
      texto +
      "</div>";
  } else {
    slider.innerHTML = "";
  }
}

/* =========================
   CARGA DE DATOS
========================= */

function obtenerEstacion() {
  if (!slug) {
    mostrarMensajeDebug("Falta estación en el enlace.");
    return;
  }

  var endpoint = "estaciones?select=id,nombre,slug&slug=eq." + encodeURIComponent(slug);

  requestSupabase(endpoint, function (error, data) {
    if (error || !data || data.length === 0) {
      mostrarMensajeDebug("No se encontró la estación: " + slug);
      return;
    }

    estacionId = data[0].id;

    cargarPromos();

    // En TV conviene refrescar cada 30 segundos en vez de usar realtime.
    setInterval(cargarPromos, 30000);
  });
}

function cargarPromos() {
  if (!estacionId) return;

  var endpoint =
    "promociones?select=*&activo=eq.true&estacion_id=eq." +
    encodeURIComponent(estacionId) +
    "&order=orden.asc,created_at.asc";

  requestSupabase(endpoint, function (error, data) {
    if (error || !data) {
      mostrarMensajeDebug("Error al cargar promociones.");
      return;
    }

    promociones = [];

    for (var i = 0; i < data.length; i++) {
      var promo = data[i];

      if (orientacion === "vertical") {
        if (promo.url_vertical && promo.tipo_vertical) {
          promociones.push(promo);
        }
      } else {
        if (promo.url_horizontal && promo.tipo_horizontal) {
          promociones.push(promo);
        }
      }
    }

    indice = 0;
    mostrarPromo();
  });
}

/* =========================
   CARRUSEL
========================= */

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

  if (!promociones || promociones.length === 0) {
    mostrarMensajeDebug("No hay promociones activas para orientación: " + orientacion);
    return;
  }

  var promo = promociones[indice];
  var archivo = obtenerArchivoPromo(promo);

  if (!archivo.url || !archivo.tipo) {
    siguientePromo();
    return;
  }

  if (archivo.tipo === "imagen") {
    var img = document.createElement("img");

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
    var video = document.createElement("video");

    video.src = archivo.url;
    video.autoplay = true;
    video.muted = true;
    video.loop = false;
    video.playsInline = true;

    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("playsinline", "true");

    video.onerror = function () {
      siguientePromo();
    };

    video.onended = function () {
      siguientePromo();
    };

    slider.appendChild(video);

    try {
      video.play();
    } catch (e) {
      siguientePromo();
    }

    return;
  }

  siguientePromo();
}

function siguientePromo() {
  if (!promociones || promociones.length === 0) return;

  indice++;

  if (indice >= promociones.length) {
    indice = 0;
  }

  mostrarPromo();
}

/* =========================
   INICIO
========================= */

configurarPantallaDesdeURL();
obtenerEstacion();