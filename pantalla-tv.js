var SUPABASE_URL = "https://vymxicqitddocazvmpbr.supabase.co";
var SUPABASE_KEY = "sb_publishable_a67bHY2v6IowOXGlQ6jmGQ_HV2h7dMA";

var slider = document.getElementById("slider");
var pantalla = null;
var promociones = [];
var indice = 0;
var codigoPantalla = "";
var slugLegacy = "";
var orientacionLegacy = "";
var firmaActual = "";

var elementoActivo = null;
var tipoActivo = "";
var elementoPreparado = null;
var tipoPreparado = "";
var indicePreparado = -1;
var preparacionEnCurso = null;
var generacionReproduccion = 0;
var temporizadorImagen = null;
var intervaloVideo = null;
var temporizadorReintento = null;
var temporizadorInicioVideo = null;
var cambioEnCurso = false;

var NOMBRE_CACHE_PROMOS = "promos-tv-local-v2";
var urlsLocales = {};
var resolucionesEnCurso = {};
var cacheLocalHabilitada = null;

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

function registrar(mensaje, dato) {
  if (obtenerParametro("debug") !== "1") return;

  if (typeof dato !== "undefined") {
    console.log("[Pantalla TV] " + mensaje, dato);
  } else {
    console.log("[Pantalla TV] " + mensaje);
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
    navigator.storage.persist().catch(function () {
      /* Mejora opcional. */
    });
  }
}

function abrirCacheLocal() {
  if (!navegadorAdmiteCacheLocal()) {
    return Promise.resolve(null);
  }

  return window.caches.open(NOMBRE_CACHE_PROMOS).catch(
    function (error) {
      registrar("No se pudo abrir Cache Storage.", error);
      return null;
    }
  );
}

function descargarArchivoParaCache(cache, url) {
  return window.fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "force-cache"
  }).then(function (respuesta) {
    if (!respuesta.ok) {
      throw new Error("Error HTTP " + respuesta.status);
    }

    if (!cache) return respuesta;

    return cache.put(url, respuesta.clone()).then(
      function () {
        return respuesta;
      },
      function () {
        return respuesta;
      }
    );
  });
}

function convertirRespuestaEnURLLocal(respuesta, urlOriginal) {
  if (!respuesta) {
    return Promise.reject(new Error("Respuesta vacía"));
  }

  return respuesta.blob().then(function (blob) {
    if (!blob || blob.size === 0) {
      throw new Error("El archivo está vacío.");
    }

    var urlLocal = window.URL.createObjectURL(blob);
    urlsLocales[urlOriginal] = urlLocal;
    return urlLocal;
  });
}

function resolverURLLocal(url) {
  if (!url) return Promise.resolve(url);
  if (urlsLocales[url]) return Promise.resolve(urlsLocales[url]);
  if (resolucionesEnCurso[url]) return resolucionesEnCurso[url];
  if (!navegadorAdmiteCacheLocal()) return Promise.resolve(url);

  var promesa = abrirCacheLocal()
    .then(function (cache) {
      if (!cache) {
        return descargarArchivoParaCache(null, url);
      }

      return cache.match(url).then(function (guardada) {
        if (guardada) return guardada;
        return descargarArchivoParaCache(cache, url);
      });
    })
    .then(function (respuesta) {
      return convertirRespuestaEnURLLocal(respuesta, url);
    })
    .catch(function (error) {
      registrar("Se utilizará la URL original.", error);
      return url;
    })
    .then(function (resultado) {
      delete resolucionesEnCurso[url];
      return resultado;
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

  Object.keys(urlsLocales).forEach(function (url) {
    if (permitidas[url]) return;

    try {
      window.URL.revokeObjectURL(urlsLocales[url]);
    } catch (error) {
      /* No interrumpimos la reproducción. */
    }

    delete urlsLocales[url];
    delete resolucionesEnCurso[url];
  });

  abrirCacheLocal().then(function (cache) {
    if (!cache) return;

    cache.keys().then(function (solicitudes) {
      for (var j = 0; j < solicitudes.length; j++) {
        if (!permitidas[solicitudes[j].url]) {
          cache.delete(solicitudes[j]);
        }
      }
    }).catch(function () {
      /* Limpieza opcional. */
    });
  });
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

  if (partes.length >= 3 && partes[1] === "h") {
    slugLegacy = decodeURIComponent(partes[2]);
    orientacionLegacy = "horizontal";
    return;
  }

  if (partes.length >= 3 && partes[1] === "v") {
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

  xhr.setRequestHeader("apikey", SUPABASE_KEY);
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

    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (error) {
        callback(error, null);
      }
      return;
    }

    callback("Error HTTP " + xhr.status, null);
  };

  xhr.onerror = function () {
    callback("Error de conexión", null);
  };

  xhr.send();
}

function limpiarTemporizadores() {
  clearTimeout(temporizadorImagen);
  clearInterval(intervaloVideo);
  clearTimeout(temporizadorReintento);
  clearTimeout(temporizadorInicioVideo);

  temporizadorImagen = null;
  intervaloVideo = null;
  temporizadorReintento = null;
  temporizadorInicioVideo = null;
}

function detenerElemento(elemento) {
  if (!elemento) return;

  elemento.onload = null;
  elemento.onerror = null;
  elemento.oncanplay = null;
  elemento.onloadeddata = null;
  elemento.onplaying = null;
  elemento.onended = null;

  if (
    elemento.tagName &&
    elemento.tagName.toLowerCase() === "video"
  ) {
    try {
      elemento.pause();
    } catch (error) {
      /* No se interrumpe la pantalla. */
    }

    try {
      elemento.removeAttribute("src");
      elemento.load();
    } catch (error) {
      /* Liberación opcional. */
    }
  }

  if (elemento.parentNode) {
    elemento.parentNode.removeChild(elemento);
  }
}

function detenerReproduccionCompleta() {
  generacionReproduccion++;
  preparacionEnCurso = null;
  cambioEnCurso = false;
  limpiarTemporizadores();
  detenerElemento(elementoActivo);
  detenerElemento(elementoPreparado);

  elementoActivo = null;
  tipoActivo = "";
  elementoPreparado = null;
  tipoPreparado = "";
  indicePreparado = -1;
}

function mostrarError(texto) {
  detenerReproduccionCompleta();

  if (obtenerParametro("debug") === "1") {
    slider.innerHTML =
      '<div style="color:white;font-family:Arial;font-size:28px;padding:40px;line-height:1.4;">' +
      texto +
      "</div>";
  } else {
    slider.innerHTML = "";
  }
}

function cargarPantallaPorCodigo() {
  if (!codigoPantalla) {
    mostrarError("No se encontró el código de la televisión.");
    return;
  }

  var endpoint =
    "pantallas" +
    "?select=id,nombre,codigo,orientacion,duracion_imagen,estacion_id" +
    "&codigo=eq." +
    encodeURIComponent(codigoPantalla) +
    "&activo=eq.true" +
    "&limit=1";

  requestSupabase(endpoint, function (error, data) {
    if (error || !data || data.length === 0) {
      mostrarError(
        "No se encontró la televisión: " + codigoPantalla
      );
      return;
    }

    pantalla = data[0];
    iniciarPantalla();
  });
}

function cargarPantallaLegacy() {
  var endpointEstacion =
    "estaciones" +
    "?select=id" +
    "&slug=eq." +
    encodeURIComponent(slugLegacy) +
    "&limit=1";

  requestSupabase(endpointEstacion, function (error, estaciones) {
    if (error || !estaciones || estaciones.length === 0) {
      mostrarError("No se encontró la estación.");
      return;
    }

    var endpointPantalla =
      "pantallas" +
      "?select=id,nombre,codigo,orientacion,duracion_imagen,estacion_id" +
      "&estacion_id=eq." +
      encodeURIComponent(estaciones[0].id) +
      "&orientacion=eq." +
      encodeURIComponent(orientacionLegacy) +
      "&activo=eq.true" +
      "&order=created_at.asc" +
      "&limit=1";

    requestSupabase(endpointPantalla, function (errorPantalla, data) {
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
    });
  });
}

function iniciarPantalla() {
  instalarEstilosReproductor();
  solicitarPersistenciaCache();
  cargarPromociones();

  setInterval(cargarPromociones, 30000);
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

  requestSupabase(endpoint, function (error, data) {
    if (error || !data) {
      if (!elementoActivo) {
        mostrarError("No se pudieron cargar las promociones.");
      }
      return;
    }

    var nuevasPromociones = [];

    for (var i = 0; i < data.length; i++) {
      var archivo = obtenerArchivo(data[i]);

      if (archivo.url && archivo.tipo) {
        nuevasPromociones.push(data[i]);
      }
    }

    var nuevaFirma = obtenerFirma(nuevasPromociones);

    if (
      nuevaFirma === firmaActual &&
      promociones.length > 0
    ) {
      return;
    }

    firmaActual = nuevaFirma;
    promociones = nuevasPromociones;
    indice = 0;

    limpiarCacheLocal(obtenerURLsActivas(promociones));

    if (promociones.length === 0) {
      mostrarError(
        "Esta televisión no tiene promociones activas."
      );
      return;
    }

    reiniciarCarruselSinPantallaNegra();
  });
}

function obtenerFirma(lista) {
  var partes = [];

  for (var i = 0; i < lista.length; i++) {
    var archivo = obtenerArchivo(lista[i]);

    partes.push(
      lista[i].id + "-" + archivo.tipo + "-" + archivo.url
    );
  }

  return partes.join("|");
}

function obtenerArchivo(promo) {
  if (pantalla && pantalla.orientacion === "vertical") {
    return {
      url: promo.url_vertical || promo.url,
      tipo: promo.tipo_vertical || promo.tipo
    };
  }

  return {
    url: promo.url_horizontal || promo.url,
    tipo: promo.tipo_horizontal || promo.tipo
  };
}

function normalizarIndice(valor) {
  if (!promociones || promociones.length === 0) return 0;

  while (valor >= promociones.length) {
    valor -= promociones.length;
  }

  while (valor < 0) {
    valor += promociones.length;
  }

  return valor;
}

function aplicarEstiloBase(elemento) {
  elemento.className = "tv-promo-media";
  elemento.style.position = "absolute";
  elemento.style.inset = "0";
  elemento.style.width = "100vw";
  elemento.style.height = "100vh";
  elemento.style.objectFit = "fill";
  elemento.style.objectPosition = "center";
  elemento.style.background = "#000000";
  elemento.style.pointerEvents = "none";
  elemento.style.visibility = "hidden";
  elemento.style.opacity = "0";
  elemento.style.zIndex = "1";
}

function configurarVideo(video) {
  video.autoplay = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.controls = false;
  video.loop = true;
  video.disablePictureInPicture = true;

  video.setAttribute("autoplay", "true");
  video.setAttribute("muted", "true");
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("preload", "auto");
  video.setAttribute("loop", "true");
  video.setAttribute(
    "controlslist",
    "nodownload nofullscreen noremoteplayback"
  );
  video.setAttribute("tabindex", "-1");
  video.removeAttribute("controls");
  video.setAttribute(
    "poster",
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
  );

  aplicarEstiloBase(video);
}

function crearElementoParaIndice(
  indiceObjetivo,
  generacionActual,
  callback
) {
  indiceObjetivo = normalizarIndice(indiceObjetivo);

  var archivo = obtenerArchivo(promociones[indiceObjetivo]);

  if (!archivo.url || !archivo.tipo) {
    callback(new Error("Promoción sin archivo válido."), null);
    return;
  }

  resolverURLLocal(archivo.url).then(function (urlReproduccion) {
    if (generacionActual !== generacionReproduccion) return;

    var terminado = false;
    var elemento = null;

    function completar(error) {
      if (terminado) return;
      terminado = true;

      if (error) {
        detenerElemento(elemento);
        callback(error, null);
        return;
      }

      callback(null, {
        elemento: elemento,
        tipo: archivo.tipo,
        indice: indiceObjetivo
      });
    }

    if (archivo.tipo === "imagen") {
      elemento = document.createElement("img");
      aplicarEstiloBase(elemento);
      elemento.alt = "Promoción";
      elemento.onload = function () {
        completar(null);
      };
      elemento.onerror = function () {
        completar(new Error("No se pudo cargar la imagen."));
      };
      slider.appendChild(elemento);
      elemento.src = urlReproduccion;
      return;
    }

    if (archivo.tipo === "video") {
      elemento = document.createElement("video");
      configurarVideo(elemento);
      elemento.oncanplay = function () {
        completar(null);
      };
      elemento.onloadeddata = function () {
        completar(null);
      };
      elemento.onerror = function () {
        completar(new Error("No se pudo cargar el video."));
      };
      slider.appendChild(elemento);
      elemento.src = urlReproduccion;

      try {
        elemento.load();
      } catch (error) {
        /* Carga automática. */
      }
      return;
    }

    completar(new Error("Tipo no reconocido."));
  }).catch(function (error) {
    callback(error, null);
  });
}

function reiniciarCarruselSinPantallaNegra() {
  generacionReproduccion++;
  var generacionActual = generacionReproduccion;

  preparacionEnCurso = null;
  cambioEnCurso = false;
  limpiarTemporizadores();
  detenerElemento(elementoPreparado);

  elementoPreparado = null;
  tipoPreparado = "";
  indicePreparado = -1;

  cargarPrimeraPromocionValida(0, 0, generacionActual);
}

function cargarPrimeraPromocionValida(
  indiceObjetivo,
  intentos,
  generacionActual
) {
  if (
    generacionActual !== generacionReproduccion ||
    intentos >= promociones.length
  ) {
    return;
  }

  crearElementoParaIndice(
    indiceObjetivo,
    generacionActual,
    function (error, paquete) {
      if (generacionActual !== generacionReproduccion) {
        if (paquete) detenerElemento(paquete.elemento);
        return;
      }

      if (error || !paquete) {
        cargarPrimeraPromocionValida(
          normalizarIndice(indiceObjetivo + 1),
          intentos + 1,
          generacionActual
        );
        return;
      }

      activarPaquete(paquete, generacionActual);
    }
  );
}

function prepararSiguientePromocion() {
  if (
    !promociones ||
    promociones.length < 2 ||
    !elementoActivo
  ) {
    return;
  }

  prepararPromocionValida(
    normalizarIndice(indice + 1),
    0,
    generacionReproduccion
  );
}

function prepararPromocionValida(
  indiceObjetivo,
  intentos,
  generacionActual
) {
  if (
    generacionActual !== generacionReproduccion ||
    intentos >= promociones.length - 1
  ) {
    return;
  }

  detenerElemento(elementoPreparado);
  elementoPreparado = null;
  tipoPreparado = "";
  indicePreparado = -1;

  var token = {};
  preparacionEnCurso = token;

  crearElementoParaIndice(
    indiceObjetivo,
    generacionActual,
    function (error, paquete) {
      if (
        generacionActual !== generacionReproduccion ||
        preparacionEnCurso !== token
      ) {
        if (paquete) detenerElemento(paquete.elemento);
        return;
      }

      if (error || !paquete) {
        prepararPromocionValida(
          normalizarIndice(indiceObjetivo + 1),
          intentos + 1,
          generacionActual
        );
        return;
      }

      preparacionEnCurso = null;
      elementoPreparado = paquete.elemento;
      tipoPreparado = paquete.tipo;
      indicePreparado = paquete.indice;
    }
  );
}

function revelarElemento(elemento) {
  elemento.style.visibility = "visible";
  elemento.style.opacity = "1";
  elemento.style.zIndex = "3";
}

function ocultarElemento(elemento) {
  if (!elemento) return;
  elemento.style.visibility = "hidden";
  elemento.style.opacity = "0";
  elemento.style.zIndex = "1";
}

function reproducirVideoAntesDeMostrar(
  video,
  alIniciar,
  alFallar
) {
  var resuelto = false;

  function exito() {
    if (resuelto) return;
    resuelto = true;
    clearTimeout(temporizadorInicioVideo);
    temporizadorInicioVideo = null;
    video.onplaying = null;
    alIniciar();
  }

  function fallo(error) {
    if (resuelto) return;
    resuelto = true;
    clearTimeout(temporizadorInicioVideo);
    temporizadorInicioVideo = null;
    video.onplaying = null;
    alFallar(error);
  }

  video.onplaying = exito;

  try {
    video.currentTime = 0;
  } catch (error) {
    /* Inicio disponible. */
  }

  try {
    var reproduccion = video.play();

    if (
      reproduccion &&
      typeof reproduccion.then === "function"
    ) {
      reproduccion.then(function () {
        setTimeout(exito, 30);
      }).catch(fallo);
    } else {
      setTimeout(function () {
        if (!video.paused) exito();
      }, 250);
    }
  } catch (error) {
    fallo(error);
    return;
  }

  temporizadorInicioVideo = setTimeout(function () {
    if (!video.paused) {
      exito();
    } else {
      fallo(new Error("El navegador no inició el video."));
    }
  }, 1800);
}

function activarPaquete(paquete, generacionActual) {
  if (
    !paquete ||
    generacionActual !== generacionReproduccion
  ) {
    if (paquete) detenerElemento(paquete.elemento);
    return;
  }

  var nuevo = paquete.elemento;
  var nuevoTipo = paquete.tipo;
  var nuevoIndice = paquete.indice;
  var anterior = elementoActivo;
  var completado = false;

  cambioEnCurso = true;

  function completarCambio() {
    if (
      completado ||
      generacionActual !== generacionReproduccion
    ) {
      return;
    }

    completado = true;

    revelarElemento(nuevo);
    if (anterior && anterior !== nuevo) {
      ocultarElemento(anterior);
    }

    elementoActivo = nuevo;
    tipoActivo = nuevoTipo;
    indice = nuevoIndice;

    if (elementoPreparado === nuevo) {
      elementoPreparado = null;
      tipoPreparado = "";
      indicePreparado = -1;
    }

    cambioEnCurso = false;

    setTimeout(function () {
      if (anterior && anterior !== nuevo) {
        detenerElemento(anterior);
      }

      if (elementoActivo === nuevo) {
        nuevo.style.zIndex = "2";
        iniciarCicloDePromocionActual();
      }
    }, 60);
  }

  function cancelarCambio(error) {
    registrar("No se pudo iniciar la promoción.", error);
    cambioEnCurso = false;
    detenerElemento(nuevo);

    if (elementoPreparado === nuevo) {
      elementoPreparado = null;
      tipoPreparado = "";
      indicePreparado = -1;
    }

    if (!anterior) {
      cargarPrimeraPromocionValida(
        normalizarIndice(nuevoIndice + 1),
        1,
        generacionActual
      );
      return;
    }

    prepararSiguientePromocion();

    if (tipoActivo === "imagen") {
      temporizadorReintento = setTimeout(
        solicitarCambio,
        600
      );
    }
  }

  if (nuevoTipo === "video") {
    reproducirVideoAntesDeMostrar(
      nuevo,
      completarCambio,
      cancelarCambio
    );
    return;
  }

  completarCambio();
}

function iniciarCicloDePromocionActual() {
  limpiarTemporizadores();
  prepararSiguientePromocion();

  if (tipoActivo === "imagen") {
    var segundos = Number(pantalla.duracion_imagen) || 7;

    temporizadorImagen = setTimeout(
      solicitarCambio,
      segundos * 1000
    );
    return;
  }

  if (tipoActivo === "video") {
    intervaloVideo = setInterval(function () {
      if (
        cambioEnCurso ||
        !elementoActivo ||
        tipoActivo !== "video"
      ) {
        return;
      }

      var duracion = Number(elementoActivo.duration);
      var tiempoActual = Number(elementoActivo.currentTime);

      if (
        !isFinite(duracion) ||
        duracion <= 0 ||
        !isFinite(tiempoActual)
      ) {
        return;
      }

      var restante = duracion - tiempoActual;

      if (restante <= 0.38 && restante >= 0) {
        solicitarCambio();
      }
    }, 80);
  }
}

function solicitarCambio() {
  if (
    cambioEnCurso ||
    !elementoActivo ||
    !promociones ||
    promociones.length < 2
  ) {
    return;
  }

  if (!elementoPreparado) {
    if (tipoActivo === "imagen") {
      clearTimeout(temporizadorReintento);
      temporizadorReintento = setTimeout(
        solicitarCambio,
        200
      );
    }
    return;
  }

  activarPaquete(
    {
      elemento: elementoPreparado,
      tipo: tipoPreparado,
      indice: indicePreparado
    },
    generacionReproduccion
  );
}

function instalarEstilosReproductor() {
  if (
    document.getElementById("tv-reproductor-sin-controles")
  ) {
    return;
  }

  var estilos = document.createElement("style");
  estilos.id = "tv-reproductor-sin-controles";
  estilos.textContent =
    "html,body{" +
    "margin:0!important;padding:0!important;" +
    "width:100%!important;height:100%!important;" +
    "overflow:hidden!important;background:#000!important;}" +
    "#slider{" +
    "position:fixed!important;inset:0!important;" +
    "width:100vw!important;height:100vh!important;" +
    "overflow:hidden!important;background:#000!important;}" +
    "#slider .tv-promo-media{" +
    "position:absolute!important;inset:0!important;" +
    "display:block!important;width:100vw!important;" +
    "height:100vh!important;object-fit:fill!important;" +
    "object-position:center!important;background:#000!important;" +
    "border:0!important;outline:0!important;" +
    "pointer-events:none!important;" +
    "-webkit-user-select:none!important;user-select:none!important;}" +
    "#slider video::-webkit-media-controls," +
    "#slider video::-webkit-media-controls-enclosure," +
    "#slider video::-webkit-media-controls-panel," +
    "#slider video::-webkit-media-controls-play-button," +
    "#slider video::-webkit-media-controls-overlay-play-button," +
    "#slider video::-webkit-media-controls-start-playback-button{" +
    "display:none!important;opacity:0!important;" +
    "visibility:hidden!important;}";

  document.head.appendChild(estilos);
}

configurarDesdeURL();

if (codigoPantalla) {
  cargarPantallaPorCodigo();
} else if (slugLegacy) {
  cargarPantallaLegacy();
} else {
  mostrarError("El enlace de la televisión no es válido.");
}
