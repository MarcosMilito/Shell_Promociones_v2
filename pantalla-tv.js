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

var preparacionVideoEnCurso = null;
var generacionReproduccion = 0;

/*
  Caché local persistente de promociones.

  La primera vez que este ONN necesita una imagen o un video,
  lo descarga desde Supabase, lo guarda en Cache Storage y crea
  una URL local tipo blob:. Las siguientes vueltas reproducen
  esa copia local y no vuelven a transferir el mismo archivo.

  Si Cache Storage no está disponible o se queda sin espacio,
  el reproductor vuelve automáticamente a la URL original.
*/

var NOMBRE_CACHE_PROMOS = "promos-tv-local-v1";
var urlsLocales = {};
var resolucionesEnCurso = {};
var cacheLocalHabilitada = null;

function registrarCache(mensaje, dato) {
  if (obtenerParametro("debug") !== "1") {
    return;
  }

  if (typeof dato !== "undefined") {
    console.log(
      "[Cache TV] " + mensaje,
      dato
    );
  } else {
    console.log(
      "[Cache TV] " + mensaje
    );
  }
}

function navegadorAdmiteCacheLocal() {
  if (cacheLocalHabilitada !== null) {
    return cacheLocalHabilitada;
  }

  cacheLocalHabilitada = Boolean(
    window.caches &&
    window.fetch &&
    window.Promise &&
    window.URL &&
    typeof window.URL.createObjectURL === "function"
  );

  return cacheLocalHabilitada;
}

function solicitarPersistenciaCache() {
  if (
    navigator.storage &&
    typeof navigator.storage.persist === "function"
  ) {
    navigator.storage
      .persist()
      .then(function (concedido) {
        registrarCache(
          concedido
            ? "El sistema permitió conservar la caché."
            : "La caché puede ser eliminada por el sistema si falta espacio."
        );
      })
      .catch(function () {
        /* La persistencia es una mejora opcional. */
      });
  }
}

function abrirCacheLocal() {
  if (!navegadorAdmiteCacheLocal()) {
    return Promise.resolve(null);
  }

  return window.caches
    .open(NOMBRE_CACHE_PROMOS)
    .catch(function (error) {
      registrarCache(
        "No se pudo abrir Cache Storage.",
        error
      );

      return null;
    });
}

function convertirRespuestaEnURLLocal(
  respuesta,
  urlOriginal
) {
  if (!respuesta) {
    return Promise.reject(
      new Error("Respuesta vacía")
    );
  }

  if (
    respuesta.type !== "opaque" &&
    !respuesta.ok
  ) {
    return Promise.reject(
      new Error(
        "No se pudo descargar el archivo: " +
        respuesta.status
      )
    );
  }

  return respuesta
    .blob()
    .then(function (blob) {
      if (!blob || blob.size === 0) {
        throw new Error(
          "El archivo descargado está vacío."
        );
      }

      var urlLocal =
        window.URL.createObjectURL(blob);

      urlsLocales[urlOriginal] = urlLocal;

      registrarCache(
        "Archivo listo en almacenamiento local: " +
        urlOriginal
      );

      return urlLocal;
    });
}

function descargarArchivoParaCache(
  cache,
  url
) {
  return window
    .fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "force-cache"
    })
    .then(function (respuesta) {
      if (!respuesta.ok) {
        throw new Error(
          "Error HTTP " + respuesta.status
        );
      }

      if (!cache) {
        return respuesta;
      }

      var copia = respuesta.clone();

      return cache
        .put(url, copia)
        .then(function () {
          registrarCache(
            "Archivo guardado en Cache Storage: " +
            url
          );

          return respuesta;
        })
        .catch(function (error) {
          /*
            Si la cuota local se llena, igual usamos el blob
            durante la sesión actual.
          */

          registrarCache(
            "No se pudo guardar de forma persistente; se usará en memoria.",
            error
          );

          return respuesta;
        });
    });
}

function resolverURLLocal(url) {
  if (!url) {
    return Promise.resolve(url);
  }

  if (urlsLocales[url]) {
    return Promise.resolve(
      urlsLocales[url]
    );
  }

  if (resolucionesEnCurso[url]) {
    return resolucionesEnCurso[url];
  }

  if (!navegadorAdmiteCacheLocal()) {
    return Promise.resolve(url);
  }

  var promesa = abrirCacheLocal()
    .then(function (cache) {
      if (!cache) {
        return descargarArchivoParaCache(
          null,
          url
        );
      }

      return cache
        .match(url)
        .then(function (respuestaGuardada) {
          if (respuestaGuardada) {
            registrarCache(
              "Se reutiliza el archivo guardado: " +
              url
            );

            return respuestaGuardada;
          }

          return descargarArchivoParaCache(
            cache,
            url
          );
        });
    })
    .then(function (respuesta) {
      return convertirRespuestaEnURLLocal(
        respuesta,
        url
      );
    })
    .catch(function (error) {
      registrarCache(
        "Se usará la URL original como respaldo.",
        error
      );

      return url;
    })
    .then(function (urlResultado) {
      delete resolucionesEnCurso[url];
      return urlResultado;
    });

  resolucionesEnCurso[url] = promesa;

  return promesa;
}

function obtenerURLsActivas(lista) {
  var urls = [];

  for (var i = 0; i < lista.length; i++) {
    var archivo = obtenerArchivo(lista[i]);

    if (
      archivo.url &&
      urls.indexOf(archivo.url) === -1
    ) {
      urls.push(archivo.url);
    }
  }

  return urls;
}

function limpiarCacheLocal(urlsActivas) {
  var permitidas = {};

  for (var i = 0; i < urlsActivas.length; i++) {
    permitidas[urlsActivas[i]] = true;
  }

  Object.keys(urlsLocales).forEach(
    function (url) {
      if (permitidas[url]) {
        return;
      }

      try {
        window.URL.revokeObjectURL(
          urlsLocales[url]
        );
      } catch (error) {
        /* No interrumpimos la reproducción. */
      }

      delete urlsLocales[url];
      delete resolucionesEnCurso[url];
    }
  );

  abrirCacheLocal().then(function (cache) {
    if (!cache) return;

    cache
      .keys()
      .then(function (solicitudes) {
        var eliminaciones = [];

        for (
          var j = 0;
          j < solicitudes.length;
          j++
        ) {
          var solicitud = solicitudes[j];

          if (!permitidas[solicitud.url]) {
            eliminaciones.push(
              cache.delete(solicitud)
            );
          }
        }

        return Promise.all(eliminaciones);
      })
      .catch(function (error) {
        registrarCache(
          "No se pudo limpiar la caché anterior.",
          error
        );
      });
  });
}

function precargarSiguientePromocionComun() {
  if (
    !promociones ||
    promociones.length < 2
  ) {
    return;
  }

  var siguienteIndice = indice + 1;

  if (siguienteIndice >= promociones.length) {
    siguienteIndice = 0;
  }

  var archivoSiguiente =
    obtenerArchivo(
      promociones[siguienteIndice]
    );

  if (archivoSiguiente.url) {
    resolverURLLocal(
      archivoSiguiente.url
    );
  }
}

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
  solicitarPersistenciaCache();
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

      /*
        Conservamos únicamente los archivos que esta TV
        sigue necesitando. Las promociones eliminadas se
        liberan del almacenamiento local.
      */

      limpiarCacheLocal(
        obtenerURLsActivas(promociones)
      );

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

  try {
    video.removeAttribute("src");
    video.load();
  } catch (error) {
    /* Liberación opcional de memoria del elemento. */
  }

  if (video.parentNode) {
    video.parentNode.removeChild(video);
  }
}

function detenerReproduccionActual() {
  /*
    Invalida cualquier descarga o preparación asíncrona
    perteneciente a la reproducción anterior.
  */

  generacionReproduccion++;
  preparacionVideoEnCurso = null;

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

  var generacionActual =
    generacionReproduccion;

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
    iniciarSecuenciaContinuaDeVideos(
      generacionActual
    );

    return;
  }

  mostrarPromocionComun(
    generacionActual
  );
}

function mostrarPromocionComun(
  generacionActual
) {
  var promo = promociones[indice];
  var archivo = obtenerArchivo(promo);

  if (!archivo.url) {
    siguientePromocionComun();
    return;
  }

  if (archivo.tipo === "imagen") {
    mostrarImagen(
      archivo.url,
      generacionActual
    );

    return;
  }

  if (archivo.tipo === "video") {
    mostrarVideoComun(
      archivo.url,
      generacionActual
    );

    return;
  }

  siguientePromocionComun();
}

function mostrarImagen(
  url,
  generacionActual
) {
  resolverURLLocal(url).then(
    function (urlReproduccion) {
      if (
        generacionActual !==
        generacionReproduccion
      ) {
        return;
      }

      var imagen =
        document.createElement("img");

      imagen.src = urlReproduccion;
      imagen.alt = "Promoción";

      imagen.onload = function () {
        var segundos =
          Number(
            pantalla.duracion_imagen
          ) || 7;

        precargarSiguientePromocionComun();

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
  );
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

function mostrarVideoComun(
  url,
  generacionActual
) {
  resolverURLLocal(url).then(
    function (urlReproduccion) {
      if (
        generacionActual !==
        generacionReproduccion
      ) {
        return;
      }

      var video =
        document.createElement("video");

      configurarVideoBase(video);

      video.src = urlReproduccion;
      video.loop =
        promociones.length === 1;

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

      precargarSiguientePromocionComun();

      reproducirSilenciosamente(
        video,
        function () {
          if (!video.loop) {
            siguientePromocionComun();
          }
        }
      );
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

function iniciarSecuenciaContinuaDeVideos(
  generacionActual
) {
  var archivoActual =
    obtenerArchivo(promociones[indice]);

  resolverURLLocal(
    archivoActual.url
  ).then(function (urlReproduccion) {
    if (
      generacionActual !==
      generacionReproduccion
    ) {
      return;
    }

    videoActivo = crearVideoDeSecuencia(
      urlReproduccion,
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

    prepararSiguienteVideo(
      generacionActual
    );

    intervaloTransicionVideo =
      setInterval(
        verificarMomentoDeCambio,
        100
      );
  });
}

function prepararSiguienteVideo(
  generacionActual
) {
  if (
    !promociones ||
    promociones.length < 2 ||
    !videoActivo ||
    generacionActual !==
      generacionReproduccion
  ) {
    return;
  }

  if (videoPreparado) {
    detenerElementoVideo(
      videoPreparado
    );

    videoPreparado = null;
  }

  var siguienteIndice = indice + 1;

  if (
    siguienteIndice >= promociones.length
  ) {
    siguienteIndice = 0;
  }

  var archivoSiguiente =
    obtenerArchivo(
      promociones[siguienteIndice]
    );

  var preparacion = {
    generacion: generacionActual,
    indice: siguienteIndice,
    url: archivoSiguiente.url
  };

  preparacionVideoEnCurso = preparacion;
  indicePreparado = siguienteIndice;

  resolverURLLocal(
    archivoSiguiente.url
  ).then(function (urlReproduccion) {
    if (
      preparacionVideoEnCurso !==
        preparacion ||
      generacionActual !==
        generacionReproduccion ||
      !videoActivo
    ) {
      return;
    }

    preparacionVideoEnCurso = null;

    videoPreparado =
      crearVideoDeSecuencia(
        urlReproduccion,
        false
      );

    videoPreparado.onerror = function () {
      detenerElementoVideo(
        videoPreparado
      );

      videoPreparado = null;
      indicePreparado = -1;

      setTimeout(
        function () {
          prepararSiguienteVideo(
            generacionReproduccion
          );
        },
        2000
      );
    };
  });
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

        prepararSiguienteVideo(
          generacionReproduccion
        );
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
