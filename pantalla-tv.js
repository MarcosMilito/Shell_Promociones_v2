var SUPABASE_URL = "https://vymxicqitddocazvmpbr.supabase.co";
var SUPABASE_KEY = "sb_publishable_a67bHY2v6IowOXGlQ6jmGQ_HV2h7dMA";

var slider = document.getElementById("slider");

var pantalla = null;
var promociones = [];

var indice = 0;
var temporizador = null;

var codigoPantalla = "";
var slugLegacy = "";
var orientacionLegacy = "";

var firmaActual = "";

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

function configurarDesdeURL() {
  var partes = window.location.pathname.split("/");

  /*
    Nuevo formato:

    /tv/shell-lomas-tv-1
  */

  if (
    partes.length >= 3 &&
    partes[1] === "tv" &&
    partes[2]
  ) {
    codigoPantalla = decodeURIComponent(partes[2]);
    return;
  }

  /*
    Compatibilidad con links anteriores:

    /h/shell-lomas
    /v/shell-lomas
  */

  if (
    partes.length >= 3 &&
    partes[1] === "h"
  ) {
    slugLegacy = decodeURIComponent(partes[2]);
    orientacionLegacy = "horizontal";
    return;
  }

  if (
    partes.length >= 3 &&
    partes[1] === "v"
  ) {
    slugLegacy = decodeURIComponent(partes[2]);
    orientacionLegacy = "vertical";
    return;
  }

  codigoPantalla =
    obtenerParametro("pantalla") ||
    obtenerParametro("screen") ||
    "";
}

function requestSupabase(endpoint, callback) {
  var xhr = new XMLHttpRequest();

  xhr.open(
    "GET",
    SUPABASE_URL + "/rest/v1/" + endpoint,
    true
  );

  xhr.setRequestHeader(
    "apikey",
    SUPABASE_KEY
  );

  xhr.setRequestHeader(
    "Authorization",
    "Bearer " + SUPABASE_KEY
  );

  xhr.setRequestHeader(
    "Content-Type",
    "application/json"
  );

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;

    if (
      xhr.status >= 200 &&
      xhr.status < 300
    ) {
      try {
        callback(
          null,
          JSON.parse(xhr.responseText)
        );
      } catch (error) {
        callback(error, null);
      }

      return;
    }

    callback(
      "Error HTTP " + xhr.status,
      null
    );
  };

  xhr.onerror = function () {
    callback(
      "Error de conexión",
      null
    );
  };

  xhr.send();
}

function mostrarError(texto) {
  var debug = obtenerParametro("debug");

  if (debug === "1") {
    slider.innerHTML =
      '<div style="' +
      'color:white;' +
      'font-family:Arial;' +
      'font-size:28px;' +
      'padding:40px;' +
      'line-height:1.4;' +
      '">' +
      texto +
      "</div>";
  } else {
    slider.innerHTML = "";
  }
}

function cargarPantallaPorCodigo() {
  if (!codigoPantalla) {
    mostrarError(
      "No se encontró el código de la televisión."
    );

    return;
  }

  var endpoint =
    "pantallas" +
    "?select=id,nombre,codigo,orientacion,duracion_imagen,estacion_id" +
    "&codigo=eq." +
    encodeURIComponent(codigoPantalla) +
    "&activo=eq.true" +
    "&limit=1";

  requestSupabase(
    endpoint,
    function (error, data) {
      if (
        error ||
        !data ||
        data.length === 0
      ) {
        mostrarError(
          "No se encontró la televisión: " +
          codigoPantalla
        );

        return;
      }

      pantalla = data[0];

      iniciarPantalla();
    }
  );
}

function cargarPantallaLegacy() {
  var endpointEstacion =
    "estaciones" +
    "?select=id" +
    "&slug=eq." +
    encodeURIComponent(slugLegacy) +
    "&limit=1";

  requestSupabase(
    endpointEstacion,
    function (error, estaciones) {
      if (
        error ||
        !estaciones ||
        estaciones.length === 0
      ) {
        mostrarError(
          "No se encontró la estación."
        );

        return;
      }

      var estacionId = estaciones[0].id;

      var endpointPantalla =
        "pantallas" +
        "?select=id,nombre,codigo,orientacion,duracion_imagen,estacion_id" +
        "&estacion_id=eq." +
        encodeURIComponent(estacionId) +
        "&orientacion=eq." +
        encodeURIComponent(orientacionLegacy) +
        "&activo=eq.true" +
        "&order=created_at.asc" +
        "&limit=1";

      requestSupabase(
        endpointPantalla,
        function (errorPantalla, data) {
          if (
            errorPantalla ||
            !data ||
            data.length === 0
          ) {
            mostrarError(
              "La estación todavía no tiene una televisión " +
              orientacionLegacy +
              " creada."
            );

            return;
          }

          pantalla = data[0];

          iniciarPantalla();
        }
      );
    }
  );
}

function iniciarPantalla() {
  cargarPromociones();

  setInterval(
    cargarPromociones,
    30000
  );
}

function cargarPromociones() {
  if (!pantalla) return;

  var endpoint =
    "promociones" +
    "?select=id,orden,activo,url,path,tipo," +
    "url_horizontal,path_horizontal,tipo_horizontal," +
    "url_vertical,path_vertical,tipo_vertical" +
    "&pantalla_id=eq." +
    encodeURIComponent(pantalla.id) +
    "&activo=eq.true" +
    "&order=orden.asc,created_at.asc";

  requestSupabase(
    endpoint,
    function (error, data) {
      if (error || !data) {
        mostrarError(
          "No se pudieron cargar las promociones."
        );

        return;
      }

      var nuevasPromociones = [];

      for (var i = 0; i < data.length; i++) {
        var promo = data[i];
        var archivo = obtenerArchivo(promo);

        if (
          archivo.url &&
          archivo.tipo
        ) {
          nuevasPromociones.push(promo);
        }
      }

      var nuevaFirma =
        obtenerFirma(nuevasPromociones);

      if (
        nuevaFirma === firmaActual &&
        promociones.length > 0
      ) {
        return;
      }

      firmaActual = nuevaFirma;
      promociones = nuevasPromociones;

      indice = 0;

      mostrarPromocion();
    }
  );
}

function obtenerFirma(lista) {
  var partes = [];

  for (var i = 0; i < lista.length; i++) {
    var archivo = obtenerArchivo(lista[i]);

    partes.push(
      lista[i].id + "-" + archivo.url
    );
  }

  return partes.join("|");
}

function obtenerArchivo(promo) {
  if (
    pantalla &&
    pantalla.orientacion === "vertical"
  ) {
    return {
      url:
        promo.url_vertical ||
        promo.url,

      tipo:
        promo.tipo_vertical ||
        promo.tipo
    };
  }

  return {
    url:
      promo.url_horizontal ||
      promo.url,

    tipo:
      promo.tipo_horizontal ||
      promo.tipo
  };
}

function mostrarPromocion() {
  clearTimeout(temporizador);

  slider.innerHTML = "";

  if (
    !promociones ||
    promociones.length === 0
  ) {
    mostrarError(
      "Esta televisión no tiene promociones activas."
    );

    return;
  }

  if (indice >= promociones.length) {
    indice = 0;
  }

  var promo = promociones[indice];
  var archivo = obtenerArchivo(promo);

  if (!archivo.url) {
    siguientePromocion();
    return;
  }

  if (archivo.tipo === "imagen") {
    mostrarImagen(archivo.url);
    return;
  }

  if (archivo.tipo === "video") {
    mostrarVideo(archivo.url);
    return;
  }

  siguientePromocion();
}

function mostrarImagen(url) {
  var imagen = document.createElement("img");

  imagen.src = url;
  imagen.alt = "Promoción";

  imagen.onload = function () {
    var segundos =
      Number(pantalla.duracion_imagen) || 7;

    temporizador = setTimeout(
      siguientePromocion,
      segundos * 1000
    );
  };

  imagen.onerror = function () {
    siguientePromocion();
  };

  slider.appendChild(imagen);
}

function mostrarVideo(url) {
  var video = document.createElement("video");

  video.src = url;

  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  video.setAttribute(
    "autoplay",
    "true"
  );

  video.setAttribute(
    "muted",
    "true"
  );

  video.setAttribute(
    "playsinline",
    "true"
  );

  video.setAttribute(
    "preload",
    "auto"
  );

  video.onended = function () {
    siguientePromocion();
  };

  video.onerror = function () {
    siguientePromocion();
  };

  slider.appendChild(video);

  try {
    var reproduccion = video.play();

    if (
      reproduccion &&
      typeof reproduccion.catch === "function"
    ) {
      reproduccion.catch(function () {
        siguientePromocion();
      });
    }
  } catch (error) {
    siguientePromocion();
  }
}

function siguientePromocion() {
  if (
    !promociones ||
    promociones.length === 0
  ) {
    return;
  }

  indice++;

  if (indice >= promociones.length) {
    indice = 0;
  }

  mostrarPromocion();
}

configurarDesdeURL();

if (codigoPantalla) {
  cargarPantallaPorCodigo();
} else if (slugLegacy) {
  cargarPantallaLegacy();
} else {
  mostrarError(
    "El enlace de la televisión no es válido."
  );
}