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

/*
  Reproductor continuo para listas formadas únicamente por videos.

  Cada video usa loop nativo, incluso cuando hay varios.
  El siguiente se precarga oculto y se coloca encima antes de que
  termine el actual. De esta manera el navegador nunca muestra
  su estado nativo de "video terminado" ni el botón Play gris.
*/

var videoActivo = null;
var videoPreparado = null;
var indicePreparado = -1;
var intervaloTransicionVideo = null;
var temporizadorCambioVideo = null;
var cambioVideoEnCurso = false;

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

  if (
    partes.length >= 3 &&
    partes[1] === "tv" &&
    partes[2]
  ) {
    codigoPantalla = decodeURIComponent(partes[2]);
    return;
  }

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
  detenerReproduccionActual();

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
  instalarEstilosAntiControles();
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

function todasLasPromocionesSonVideos() {
  if (
    !promociones ||
    promociones.length === 0
  ) {
    return false;
  }

  for (var i = 0; i < promociones.length; i++) {
    var archivo = obtenerArchivo(promociones[i]);

    if (
      archivo.tipo !== "video" ||
      !archivo.url
    ) {
      return false;
    }
  }

  return true;
}

function detenerElementoVideo(video) {
  if (!video) return;

  try {
    video.pause();
  } catch (error) {
    /* No interrumpimos la pantalla por este error. */
  }

  video.onended = null;
  video.onerror = null;
  video.onplaying = null;
  video.oncanplay = null;

  if (video.parentNode) {
    video.parentNode.removeChild(video);
  }
}

function detenerReproduccionActual() {
  clearTimeout(temporizador);
  temporizador = null;

  clearInterval(intervaloTransicionVideo);
  intervaloTransicionVideo = null;

  clearTimeout(temporizadorCambioVideo);
  temporizadorCambioVideo = null;

  cambioVideoEnCurso = false;

  detenerElementoVideo(videoActivo);

  if (
    videoPreparado &&
    videoPreparado !== videoActivo
  ) {
    detenerElementoVideo(videoPreparado);
  }

  videoActivo = null;
  videoPreparado = null;
  indicePreparado = -1;
}

function mostrarPromocion() {
  detenerReproduccionActual();
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

  /*
    Cuando todas las promociones son videos se usa un
    reproductor doble: uno visible y otro precargado.
  */

  if (todasLasPromocionesSonVideos()) {
    iniciarSecuenciaContinuaDeVideos();
    return;
  }

  mostrarPromocionComun();
}

function mostrarPromocionComun() {
  var promo = promociones[indice];
  var archivo = obtenerArchivo(promo);

  if (!archivo.url) {
    siguientePromocionComun();
    return;
  }

  if (archivo.tipo === "imagen") {
    mostrarImagen(archivo.url);
    return;
  }

  if (archivo.tipo === "video") {
    mostrarVideoComun(archivo.url);
    return;
  }

  siguientePromocionComun();
}

function mostrarImagen(url) {
  var imagen = document.createElement("img");

  imagen.src = url;
  imagen.alt = "Promoción";

  imagen.onload = function () {
    var segundos =
      Number(pantalla.duracion_imagen) || 7;

    temporizador = setTimeout(
      siguientePromocionComun,
      segundos * 1000
    );
  };

  imagen.onerror = function () {
    siguientePromocionComun();
  };

  slider.appendChild(imagen);
}

function configurarVideoBase(video) {
  video.autoplay = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.controls = false;
  video.disablePictureInPicture = true;

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
    "webkit-playsinline",
    "true"
  );

  video.setAttribute(
    "preload",
    "auto"
  );

  video.setAttribute(
    "controlslist",
    "nodownload nofullscreen noremoteplayback"
  );

  video.setAttribute(
    "tabindex",
    "-1"
  );

  video.removeAttribute("controls");

  video.style.position = "absolute";
  video.style.inset = "0";
  video.style.width = "100vw";
  video.style.height = "100vh";
  video.style.objectFit = "fill";
  video.style.objectPosition = "center";
  video.style.background = "#000000";
  video.style.pointerEvents = "none";
}

function reproducirSilenciosamente(video, alFallar) {
  try {
    var reproduccion = video.play();

    if (
      reproduccion &&
      typeof reproduccion.catch === "function"
    ) {
      reproduccion.catch(function () {
        if (typeof alFallar === "function") {
          alFallar();
        }
      });
    }
  } catch (error) {
    if (typeof alFallar === "function") {
      alFallar();
    }
  }
}

function mostrarVideoComun(url) {
  var video = document.createElement("video");

  configurarVideoBase(video);

  video.src = url;
  video.loop = promociones.length === 1;

  if (video.loop) {
    video.setAttribute(
      "loop",
      "true"
    );
  } else {
    video.onended = function () {
      siguientePromocionComun();
    };
  }

  video.onerror = function () {
    if (!video.loop) {
      siguientePromocionComun();
    }
  };

  slider.appendChild(video);

  reproducirSilenciosamente(
    video,
    function () {
      if (!video.loop) {
        siguientePromocionComun();
      }
    }
  );
}

function siguientePromocionComun() {
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

/* =====================================================
   REPRODUCTOR CONTINUO DE VARIOS VIDEOS
===================================================== */

function crearVideoDeSecuencia(url, visible) {
  var video = document.createElement("video");

  configurarVideoBase(video);

  video.src = url;

  /*
    El loop queda activo incluso si hay varios videos.
    Así el elemento jamás entra en estado "ended" y el
    navegador no puede mostrar el botón Play gris.
  */

  video.loop = true;

  video.setAttribute(
    "loop",
    "true"
  );

  video.style.zIndex = visible ? "2" : "1";
  video.style.visibility = visible
    ? "visible"
    : "hidden";
  video.style.opacity = visible
    ? "1"
    : "0";

  slider.appendChild(video);

  try {
    video.load();
  } catch (error) {
    /* Algunos navegadores cargan automáticamente. */
  }

  return video;
}

function iniciarSecuenciaContinuaDeVideos() {
  var archivoActual =
    obtenerArchivo(promociones[indice]);

  videoActivo = crearVideoDeSecuencia(
    archivoActual.url,
    true
  );

  videoActivo.onerror = function () {
    avanzarVideoPorError();
  };

  reproducirSilenciosamente(
    videoActivo,
    avanzarVideoPorError
  );

  if (promociones.length === 1) {
    return;
  }

  prepararSiguienteVideo();

  intervaloTransicionVideo = setInterval(
    verificarMomentoDeCambio,
    100
  );
}

function prepararSiguienteVideo() {
  if (
    !promociones ||
    promociones.length < 2 ||
    !videoActivo
  ) {
    return;
  }

  if (videoPreparado) {
    detenerElementoVideo(videoPreparado);
    videoPreparado = null;
  }

  indicePreparado = indice + 1;

  if (indicePreparado >= promociones.length) {
    indicePreparado = 0;
  }

  var archivoSiguiente =
    obtenerArchivo(promociones[indicePreparado]);

  videoPreparado = crearVideoDeSecuencia(
    archivoSiguiente.url,
    false
  );

  videoPreparado.onerror = function () {
    detenerElementoVideo(videoPreparado);
    videoPreparado = null;
    indicePreparado = -1;
  };
}

function verificarMomentoDeCambio() {
  if (
    cambioVideoEnCurso ||
    !videoActivo ||
    !videoPreparado
  ) {
    return;
  }

  var duracion = Number(videoActivo.duration);
  var tiempoActual = Number(videoActivo.currentTime);

  if (
    !isFinite(duracion) ||
    duracion <= 0 ||
    !isFinite(tiempoActual)
  ) {
    return;
  }

  var restante = duracion - tiempoActual;

  /*
    El siguiente video ya está descargado en memoria.
    Iniciamos el cambio unas décimas antes del final.
  */

  if (
    restante <= 0.30 &&
    restante >= 0 &&
    videoPreparado.readyState >= 2
  ) {
    activarVideoPreparado();
  }
}

function activarVideoPreparado() {
  if (
    cambioVideoEnCurso ||
    !videoActivo ||
    !videoPreparado
  ) {
    return;
  }

  cambioVideoEnCurso = true;

  var anterior = videoActivo;
  var siguiente = videoPreparado;
  var siguienteIndice = indicePreparado;
  var activado = false;

  function completarCambio() {
    if (activado) return;

    activado = true;

    clearTimeout(temporizadorCambioVideo);
    temporizadorCambioVideo = null;

    siguiente.style.visibility = "visible";
    siguiente.style.opacity = "1";
    siguiente.style.zIndex = "3";

    anterior.style.visibility = "hidden";
    anterior.style.opacity = "0";

    videoActivo = siguiente;
    videoPreparado = null;
    indicePreparado = -1;
    indice = siguienteIndice;
    cambioVideoEnCurso = false;

    setTimeout(
      function () {
        detenerElementoVideo(anterior);

        if (videoActivo) {
          videoActivo.style.zIndex = "2";
        }

        prepararSiguienteVideo();
      },
      40
    );
  }

  function cancelarCambio() {
    if (activado) return;

    clearTimeout(temporizadorCambioVideo);
    temporizadorCambioVideo = null;

    try {
      siguiente.pause();
      siguiente.currentTime = 0;
    } catch (error) {
      /* Conservamos el video anterior en reproducción. */
    }

    siguiente.style.visibility = "hidden";
    siguiente.style.opacity = "0";
    siguiente.style.zIndex = "1";

    cambioVideoEnCurso = false;
  }

  siguiente.onplaying = completarCambio;

  try {
    siguiente.currentTime = 0;
  } catch (error) {
    /* El video igualmente intentará comenzar desde el inicio. */
  }

  try {
    var reproduccion = siguiente.play();

    if (
      reproduccion &&
      typeof reproduccion.then === "function"
    ) {
      reproduccion.then(
        completarCambio
      ).catch(
        cancelarCambio
      );
    }
  } catch (error) {
    cancelarCambio();
    return;
  }

  /*
    El anterior continúa en loop mientras el nuevo comienza.
    Si el ONN tarda, nunca queda visible un video terminado.
  */

  temporizadorCambioVideo = setTimeout(
    cancelarCambio,
    2000
  );
}

function avanzarVideoPorError() {
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

/* =====================================================
   OCULTAR CONTROLES NATIVOS DEL NAVEGADOR
===================================================== */

function instalarEstilosAntiControles() {
  if (
    document.getElementById(
      "tv-anti-media-controls"
    )
  ) {
    return;
  }

  var estilos = document.createElement("style");

  estilos.id = "tv-anti-media-controls";

  estilos.textContent =
    "#slider video{" +
    "pointer-events:none!important;" +
    "-webkit-user-select:none!important;" +
    "user-select:none!important;" +
    "}" +
    "#slider video::-webkit-media-controls{" +
    "display:none!important;" +
    "opacity:0!important;" +
    "visibility:hidden!important;" +
    "}" +
    "#slider video::-webkit-media-controls-enclosure{" +
    "display:none!important;" +
    "opacity:0!important;" +
    "visibility:hidden!important;" +
    "}" +
    "#slider video::-webkit-media-controls-panel{" +
    "display:none!important;" +
    "opacity:0!important;" +
    "visibility:hidden!important;" +
    "}" +
    "#slider video::-webkit-media-controls-play-button{" +
    "display:none!important;" +
    "opacity:0!important;" +
    "visibility:hidden!important;" +
    "}" +
    "#slider video::-webkit-media-controls-overlay-play-button{" +
    "display:none!important;" +
    "opacity:0!important;" +
    "visibility:hidden!important;" +
    "}";

  document.head.appendChild(estilos);
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
