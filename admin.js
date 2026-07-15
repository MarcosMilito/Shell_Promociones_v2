import { supabase } from "./supabase-config.js";

/* =====================================================
   ELEMENTOS DEL HTML
===================================================== */

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

const email = document.getElementById("email");
const password = document.getElementById("password");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const tituloEstacion = document.getElementById("tituloEstacion");

const nombrePantalla = document.getElementById("nombrePantalla");
const orientacionPantalla =
  document.getElementById("orientacionPantalla");
const duracionPantalla =
  document.getElementById("duracionPantalla");

const btnCrearPantalla =
  document.getElementById("btnCrearPantalla");

const selectorPantalla =
  document.getElementById("selectorPantalla");

const btnCopiarLink =
  document.getElementById("btnCopiarLink");

const btnEliminarPantalla =
  document.getElementById("btnEliminarPantalla");

const datosPantalla =
  document.getElementById("datosPantalla");

const textoOrientacion =
  document.getElementById("textoOrientacion");

const aplicarATodas =
  document.getElementById("aplicarATodas");

const alcancePromo =
  document.getElementById("alcancePromo");

const archivoPromo =
  document.getElementById("archivoPromo");

const previewPromo =
  document.getElementById("previewPromo");

const btnSubir =
  document.getElementById("btnSubir");

const btnLimpiar =
  document.getElementById("btnLimpiar");

const btnRefrescar =
  document.getElementById("btnRefrescar");

const listaPromos =
  document.getElementById("listaPromos");

const loginStatus =
  document.getElementById("loginStatus");

const pantallaStatus =
  document.getElementById("pantallaStatus");

const uploadStatus =
  document.getElementById("uploadStatus");

/* =====================================================
   ESTADO GENERAL
===================================================== */

let usuario = null;
let estacion = null;
let rolUsuario = null;

let pantallas = [];
let pantallaSeleccionada = null;

/* =====================================================
   EVENTOS
===================================================== */

if (btnLogin) {
  btnLogin.addEventListener("click", login);
}

if (btnLogout) {
  btnLogout.addEventListener("click", logout);
}

if (password) {
  password.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      login();
    }
  });
}

if (btnCrearPantalla) {
  btnCrearPantalla.addEventListener(
    "click",
    crearPantalla
  );
}

if (selectorPantalla) {
  selectorPantalla.addEventListener(
    "change",
    seleccionarPantalla
  );
}

if (btnCopiarLink) {
  btnCopiarLink.addEventListener(
    "click",
    copiarLinkPantalla
  );
}

if (btnEliminarPantalla) {
  btnEliminarPantalla.addEventListener(
    "click",
    eliminarPantalla
  );
}

if (archivoPromo) {
  archivoPromo.addEventListener(
    "change",
    mostrarPreview
  );
}

if (btnSubir) {
  btnSubir.addEventListener(
    "click",
    subirPromo
  );
}

if (btnLimpiar) {
  btnLimpiar.addEventListener(
    "click",
    function () {
      limpiarSeleccion();
      setStatus(uploadStatus, "", "");
    }
  );
}

if (btnRefrescar) {
  btnRefrescar.addEventListener(
    "click",
    cargarPromos
  );
}

if (aplicarATodas) {
  aplicarATodas.addEventListener(
    "change",
    actualizarAlcancePromo
  );
}

/* =====================================================
   AUTENTICACIÓN
===================================================== */

async function login() {
  const correo = email.value.trim();
  const clave = password.value;

  if (!correo || !clave) {
    setStatus(
      loginStatus,
      "Ingresá el correo y la contraseña.",
      "error"
    );

    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Ingresando...";

  setStatus(
    loginStatus,
    "Verificando usuario...",
    ""
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: correo,
      password: clave
    });

  if (error) {
    console.error("Error de inicio de sesión:", error);

    setStatus(
      loginStatus,
      "El correo o la contraseña son incorrectos.",
      "error"
    );

    btnLogin.disabled = false;
    btnLogin.textContent = "Iniciar sesión";

    return;
  }

  usuario = data.user;

  await cargarEstacion();

  btnLogin.disabled = false;
  btnLogin.textContent = "Iniciar sesión";
}

async function verificarSesion() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    console.error(
      "Error verificando la sesión:",
      error
    );

    return;
  }

  if (data.session) {
    usuario = data.session.user;

    await cargarEstacion();
  }
}

async function logout() {
  await supabase.auth.signOut();

  usuario = null;
  estacion = null;
  rolUsuario = null;

  pantallas = [];
  pantallaSeleccionada = null;

  loginBox.classList.remove("hidden");
  adminBox.classList.add("hidden");

  email.value = "";
  password.value = "";

  if (selectorPantalla) {
    selectorPantalla.innerHTML = "";
  }

  if (listaPromos) {
    listaPromos.innerHTML = "";
  }

  setStatus(loginStatus, "", "");
  setStatus(pantallaStatus, "", "");
  setStatus(uploadStatus, "", "");
}

/* =====================================================
   CARGAR ESTACIÓN DEL USUARIO
===================================================== */

async function cargarEstacion() {
  setStatus(
    loginStatus,
    "Buscando la estación asignada...",
    ""
  );

  /*
    Confirmamos el usuario conectado directamente
    desde Supabase.
  */

  const {
    data: datosUsuario,
    error: errorUsuario
  } = await supabase.auth.getUser();

  if (
    errorUsuario ||
    !datosUsuario ||
    !datosUsuario.user
  ) {
    console.error(
      "No se pudo obtener el usuario:",
      errorUsuario
    );

    setStatus(
      loginStatus,
      "No se pudo verificar el usuario conectado.",
      "error"
    );

    return;
  }

  usuario = datosUsuario.user;

  console.log(
    "Usuario conectado:",
    usuario.email,
    usuario.id
  );

  /*
    Buscamos la relación en estacion_usuarios.
  */

  const {
    data: membresias,
    error: errorMembresia
  } = await supabase
    .from("estacion_usuarios")
    .select("estacion_id, rol")
    .eq("user_id", usuario.id)
    .limit(1);

  if (errorMembresia) {
    console.error(
      "Error consultando estacion_usuarios:",
      errorMembresia
    );

    setStatus(
      loginStatus,
      "No se pudo consultar la estación asignada: " +
        errorMembresia.message,
      "error"
    );

    return;
  }

  /*
    Si no aparece en estacion_usuarios,
    probamos el sistema anterior con estaciones.user_id.
    Esto mantiene funcionando al usuario original.
  */

  if (!membresias || membresias.length === 0) {
    const {
      data: estacionAnterior,
      error: errorAnterior
    } = await supabase
      .from("estaciones")
      .select("*")
      .eq("user_id", usuario.id)
      .limit(1);

    if (
      errorAnterior ||
      !estacionAnterior ||
      estacionAnterior.length === 0
    ) {
      console.error(
        "No se encontró membresía:",
        errorAnterior
      );

      setStatus(
        loginStatus,
        `El usuario ${usuario.email} no tiene una estación de servicio asignada.`,
        "error"
      );

      return;
    }

    estacion = estacionAnterior[0];
    rolUsuario = "admin";

    mostrarPanel();

    return;
  }

  const membresia = membresias[0];

  rolUsuario = membresia.rol;

  /*
    Cargamos los datos completos de la estación.
  */

  const {
    data: estacionEncontrada,
    error: errorEstacion
  } = await supabase
    .from("estaciones")
    .select("*")
    .eq("id", membresia.estacion_id)
    .single();

  if (errorEstacion || !estacionEncontrada) {
    console.error(
      "Error cargando la estación:",
      errorEstacion
    );

    setStatus(
      loginStatus,
      "El usuario está asignado, pero no se pudo leer la estación: " +
        (errorEstacion
          ? errorEstacion.message
          : "error desconocido"),
      "error"
    );

    return;
  }

  estacion = estacionEncontrada;

  mostrarPanel();
}

async function mostrarPanel() {
  loginBox.classList.add("hidden");
  adminBox.classList.remove("hidden");

  tituloEstacion.textContent =
    `Promociones - ${estacion.nombre}`;

  setStatus(loginStatus, "", "");

  await cargarPantallas();
}

/* =====================================================
   FUNCIONES PARA LAS TELEVISIONES
===================================================== */

function convertirEnSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function crearPantalla() {
  if (!estacion) {
    return;
  }

  const nombre = nombrePantalla.value.trim();
  const orientacion = orientacionPantalla.value;
  const duracion =
    Number(duracionPantalla.value);

  if (!nombre) {
    setStatus(
      pantallaStatus,
      "Ingresá un nombre para la televisión.",
      "error"
    );

    return;
  }

  if (
    orientacion !== "horizontal" &&
    orientacion !== "vertical"
  ) {
    setStatus(
      pantallaStatus,
      "Seleccioná una orientación válida.",
      "error"
    );

    return;
  }

  if (
    !Number.isFinite(duracion) ||
    duracion < 3 ||
    duracion > 60
  ) {
    setStatus(
      pantallaStatus,
      "La duración debe estar entre 3 y 60 segundos.",
      "error"
    );

    return;
  }

  const nombreSlug = convertirEnSlug(nombre);

  if (!nombreSlug) {
    setStatus(
      pantallaStatus,
      "El nombre de la televisión no es válido.",
      "error"
    );

    return;
  }

  const codigo =
    `${estacion.slug}-${nombreSlug}`;

  btnCrearPantalla.disabled = true;
  btnCrearPantalla.textContent = "Creando...";

  const { data, error } = await supabase
    .from("pantallas")
    .insert({
      estacion_id: estacion.id,
      nombre: nombre,
      codigo: codigo,
      orientacion: orientacion,
      duracion_imagen: duracion,
      activo: true
    })
    .select()
    .single();

  btnCrearPantalla.disabled = false;
  btnCrearPantalla.textContent =
    "Crear televisión";

  if (error) {
    console.error(
      "Error creando televisión:",
      error
    );

    if (
      error.code === "23505" ||
      (
        error.message &&
        error.message
          .toLowerCase()
          .includes("duplicate")
      )
    ) {
      setStatus(
        pantallaStatus,
        "Ya existe una televisión con ese nombre.",
        "error"
      );
    } else {
      setStatus(
        pantallaStatus,
        "No se pudo crear la televisión: " +
          error.message,
        "error"
      );
    }

    return;
  }

  nombrePantalla.value = "";
  duracionPantalla.value = "7";

  setStatus(
    pantallaStatus,
    "Televisión creada correctamente.",
    "success"
  );

  await cargarPantallas(data.id);
}

async function cargarPantallas(
  seleccionarId = null
) {
  if (!estacion) {
    return;
  }

  const { data, error } = await supabase
    .from("pantallas")
    .select("*")
    .eq("estacion_id", estacion.id)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(
      "Error cargando televisiones:",
      error
    );

    setStatus(
      pantallaStatus,
      "No se pudieron cargar las televisiones: " +
        error.message,
      "error"
    );

    return;
  }

  pantallas = data || [];

  selectorPantalla.innerHTML = "";

  if (pantallas.length === 0) {
    selectorPantalla.innerHTML = `
      <option value="">
        No hay televisiones creadas
      </option>
    `;

    pantallaSeleccionada = null;

    actualizarDatosPantalla();
    actualizarAlcancePromo();

    listaPromos.innerHTML = `
      <p class="status-message">
        Primero creá una televisión.
      </p>
    `;

    return;
  }

  pantallas.forEach(function (pantalla) {
    const option =
      document.createElement("option");

    option.value = pantalla.id;

    option.textContent =
      `${pantalla.nombre} - ${pantalla.orientacion}`;

    selectorPantalla.appendChild(option);
  });

  let idFinal = seleccionarId;

  if (!idFinal && pantallaSeleccionada) {
    const todavíaExiste =
      pantallas.some(function (pantalla) {
        return (
          pantalla.id ===
          pantallaSeleccionada.id
        );
      });

    if (todavíaExiste) {
      idFinal = pantallaSeleccionada.id;
    }
  }

  if (!idFinal) {
    idFinal = pantallas[0].id;
  }

  selectorPantalla.value = idFinal;

  seleccionarPantalla();
}

function seleccionarPantalla() {
  const id = selectorPantalla.value;

  pantallaSeleccionada =
    pantallas.find(function (pantalla) {
      return pantalla.id === id;
    }) || null;

  actualizarDatosPantalla();
  limpiarSeleccion();
  cargarPromos();
}

function actualizarDatosPantalla() {
  if (!pantallaSeleccionada) {
    datosPantalla.classList.add("hidden");
    datosPantalla.innerHTML = "";

    textoOrientacion.textContent =
      "Primero seleccioná una televisión.";

    return;
  }

  const enlace =
    `${window.location.origin}/tv/${pantallaSeleccionada.codigo}`;

  datosPantalla.classList.remove("hidden");

  datosPantalla.innerHTML = `
    <strong>
      ${escaparHTML(pantallaSeleccionada.nombre)}
    </strong>

    <p>
      Orientación:
      ${escaparHTML(
        pantallaSeleccionada.orientacion
      )}
    </p>

    <p>
      Tiempo por imagen:
      ${pantallaSeleccionada.duracion_imagen}
      segundos
    </p>

    <p class="screen-url">
      ${escaparHTML(enlace)}
    </p>
  `;

  textoOrientacion.textContent =
    pantallaSeleccionada.orientacion ===
    "vertical"
      ? "Formato recomendado: 1080 × 1920"
      : "Formato recomendado: 1920 × 1080";
}

async function copiarLinkPantalla() {
  if (!pantallaSeleccionada) {
    setStatus(
      pantallaStatus,
      "Primero seleccioná una televisión.",
      "error"
    );

    return;
  }

  const enlace =
    `${window.location.origin}/tv/${pantallaSeleccionada.codigo}`;

  try {
    await navigator.clipboard.writeText(
      enlace
    );

    setStatus(
      pantallaStatus,
      "Enlace copiado correctamente.",
      "success"
    );
  } catch (error) {
    console.error(
      "No se pudo copiar el enlace:",
      error
    );

    setStatus(
      pantallaStatus,
      enlace,
      ""
    );
  }
}

async function eliminarPantalla() {
  if (!pantallaSeleccionada) {
    return;
  }

  const confirmar = confirm(
    `¿Querés eliminar "${pantallaSeleccionada.nombre}" y todas sus promociones exclusivas?`
  );

  if (!confirmar) {
    return;
  }

  btnEliminarPantalla.disabled = true;
  btnEliminarPantalla.textContent =
    "Eliminando...";

  const {
    data: promocionesPantalla,
    error: errorPromociones
  } = await supabase
    .from("promociones")
    .select(
      "path,path_horizontal,path_vertical"
    )
    .eq(
      "pantalla_id",
      pantallaSeleccionada.id
    );

  if (errorPromociones) {
    console.error(
      "No se pudieron leer los archivos:",
      errorPromociones
    );
  }

  const archivos = [];

  (promocionesPantalla || []).forEach(
    function (promo) {
      agregarArchivoUnico(
        archivos,
        promo.path
      );

      agregarArchivoUnico(
        archivos,
        promo.path_horizontal
      );

      agregarArchivoUnico(
        archivos,
        promo.path_vertical
      );
    }
  );

  if (archivos.length > 0) {
    const { error: errorStorage } =
      await supabase.storage
        .from("promos")
        .remove(archivos);

    if (errorStorage) {
      console.error(
        "Error eliminando archivos:",
        errorStorage
      );
    }
  }

  const { error } = await supabase
    .from("pantallas")
    .delete()
    .eq("id", pantallaSeleccionada.id);

  btnEliminarPantalla.disabled = false;
  btnEliminarPantalla.textContent =
    "Eliminar televisión";

  if (error) {
    console.error(
      "Error eliminando televisión:",
      error
    );

    setStatus(
      pantallaStatus,
      "No se pudo eliminar la televisión: " +
        error.message,
      "error"
    );

    return;
  }

  pantallaSeleccionada = null;

  setStatus(
    pantallaStatus,
    "Televisión eliminada correctamente.",
    "success"
  );

  await cargarPantallas();
}

/* =====================================================
   PROMOCIÓN PARA UNA TV O PARA TODAS
===================================================== */

function actualizarAlcancePromo() {
  if (!aplicarATodas) {
    return;
  }

  if (aplicarATodas.checked) {
    if (alcancePromo) {
      alcancePromo.textContent =
        "Esta promoción se reproducirá en todos los televisores de la estación.";
    }

    if (selectorPantalla) {
      selectorPantalla.disabled = true;
    }

    if (textoOrientacion) {
      textoOrientacion.textContent =
        "Para todas las TVs: usá una imagen de buena calidad y mantené textos y logos centrados.";
    }
  } else {
    if (alcancePromo) {
      alcancePromo.textContent =
        "La promoción se cargará solamente en la televisión seleccionada.";
    }

    if (selectorPantalla) {
      selectorPantalla.disabled = false;
    }

    actualizarDatosPantalla();
  }
}

/* =====================================================
   SUBIR ARCHIVOS
===================================================== */

function validarArchivo(file) {
  if (!file) {
    return false;
  }

  const formatosPermitidos = [
    "image/jpeg",
    "image/png",
    "video/mp4"
  ];

  return formatosPermitidos.includes(
    file.type
  );
}

function obtenerTipo(file) {
  if (
    file &&
    file.type.startsWith("video")
  ) {
    return "video";
  }

  return "imagen";
}

async function subirArchivo(
  file,
  esGlobal
) {
  const partesNombre =
    file.name.split(".");

  let extension =
    partesNombre.length > 1
      ? partesNombre.pop().toLowerCase()
      : "";

  if (!extension) {
    extension =
      file.type === "video/mp4"
        ? "mp4"
        : file.type === "image/png"
          ? "png"
          : "jpg";
  }

  const identificador =
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 9);

  const nombreArchivo =
    `${identificador}.${extension}`;

  const carpetaDestino = esGlobal
    ? "todas-las-tvs"
    : pantallaSeleccionada.codigo;

  const path =
    `${estacion.slug}/${carpetaDestino}/${nombreArchivo}`;

  const { error } = await supabase.storage
    .from("promos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    console.error(
      "Error subiendo archivo:",
      error
    );

    throw new Error(
      "No se pudo subir el archivo: " +
        error.message
    );
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
  const esGlobal =
    aplicarATodas
      ? aplicarATodas.checked
      : false;

  if (
    !esGlobal &&
    !pantallaSeleccionada
  ) {
    setStatus(
      uploadStatus,
      "Primero seleccioná una televisión.",
      "error"
    );

    return;
  }

  const file =
    archivoPromo.files[0];

  if (!file) {
    setStatus(
      uploadStatus,
      "Seleccioná una imagen o un video.",
      "error"
    );

    return;
  }

  if (!validarArchivo(file)) {
    setStatus(
      uploadStatus,
      "Usá únicamente imágenes JPG o PNG, o videos MP4.",
      "error"
    );

    return;
  }

  let archivoSubido = null;

  try {
    btnSubir.disabled = true;
    btnSubir.textContent = "Subiendo...";

    setStatus(
      uploadStatus,
      esGlobal
        ? "Subiendo promoción para todos los televisores..."
        : "Subiendo promoción...",
      ""
    );

    archivoSubido =
      await subirArchivo(
        file,
        esGlobal
      );

    let consultaCantidad = supabase
      .from("promociones")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "estacion_id",
        estacion.id
      );

    if (esGlobal) {
      consultaCantidad =
        consultaCantidad.is(
          "pantalla_id",
          null
        );
    } else {
      consultaCantidad =
        consultaCantidad.eq(
          "pantalla_id",
          pantallaSeleccionada.id
        );
    }

    const {
      count,
      error: errorCantidad
    } = await consultaCantidad;

    if (errorCantidad) {
      console.warn(
        "No se pudo calcular el orden:",
        errorCantidad
      );
    }

    const datosPromo = {
      estacion_id: estacion.id,

      pantalla_id: esGlobal
        ? null
        : pantallaSeleccionada.id,

      tipo: archivoSubido.tipo,
      url: archivoSubido.url,
      path: archivoSubido.path,

      activo: true,
      orden: (count || 0) + 1,

      url_horizontal: null,
      path_horizontal: null,
      tipo_horizontal: null,

      url_vertical: null,
      path_vertical: null,
      tipo_vertical: null
    };

    /*
      Las promociones globales utilizan
      las columnas generales url, path y tipo.

      Las promociones exclusivas también
      completan las columnas de su orientación.
    */

    if (!esGlobal) {
      if (
        pantallaSeleccionada.orientacion ===
        "vertical"
      ) {
        datosPromo.url_vertical =
          archivoSubido.url;

        datosPromo.path_vertical =
          archivoSubido.path;

        datosPromo.tipo_vertical =
          archivoSubido.tipo;
      } else {
        datosPromo.url_horizontal =
          archivoSubido.url;

        datosPromo.path_horizontal =
          archivoSubido.path;

        datosPromo.tipo_horizontal =
          archivoSubido.tipo;
      }
    }

    const { error } = await supabase
      .from("promociones")
      .insert(datosPromo);

    if (error) {
      console.error(
        "Error guardando promoción:",
        error
      );

      /*
        Eliminamos el archivo si la fila
        no pudo guardarse.
      */

      await supabase.storage
        .from("promos")
        .remove([
          archivoSubido.path
        ]);

      throw new Error(
        "El archivo subió, pero no se pudo guardar la promoción: " +
          error.message
      );
    }

    limpiarSeleccion();

    if (aplicarATodas) {
      aplicarATodas.checked = false;
    }

    actualizarAlcancePromo();

    setStatus(
      uploadStatus,
      esGlobal
        ? "Promoción guardada para todos los televisores."
        : "Promoción guardada correctamente.",
      "success"
    );

    await cargarPromos();

  } catch (error) {
    console.error(
      "Error subiendo promoción:",
      error
    );

    setStatus(
      uploadStatus,
      error.message ||
        "Ocurrió un error al guardar la promoción.",
      "error"
    );

  } finally {
    btnSubir.disabled = false;
    btnSubir.textContent =
      "Guardar promoción";
  }
}

/* =====================================================
   CARGAR Y MOSTRAR PROMOCIONES
===================================================== */

async function cargarPromos() {
  if (!pantallaSeleccionada) {
    listaPromos.innerHTML = `
      <p class="status-message">
        Seleccioná una televisión.
      </p>
    `;

    return;
  }

  listaPromos.innerHTML = `
    <p class="status-message">
      Cargando promociones...
    </p>
  `;

  const filtro =
    `pantalla_id.eq.${pantallaSeleccionada.id},pantalla_id.is.null`;

  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq(
      "estacion_id",
      estacion.id
    )
    .or(filtro)
    .order("orden", {
      ascending: true
    })
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(
      "Error cargando promociones:",
      error
    );

    listaPromos.innerHTML = `
      <p class="status-message status-error">
        No se pudieron cargar las promociones:
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }

  listaPromos.innerHTML = "";

  if (!data || data.length === 0) {
    listaPromos.innerHTML = `
      <p class="status-message">
        Esta televisión todavía no tiene promociones.
      </p>
    `;

    return;
  }

  data.forEach(function (promo) {
    const archivo =
      obtenerArchivoPromo(promo);

    const esGlobal =
      promo.pantalla_id === null;

    const alcance = esGlobal
      ? "Todos los televisores"
      : pantallaSeleccionada.nombre;

    const article =
      document.createElement("article");

    article.className =
      promo.activo
        ? "promo-item"
        : "promo-item inactive";

    article.innerHTML = `
      <div class="promo-info">

        <div class="promo-preview-card">

          <span class="preview-label">
            ${esGlobal
              ? "General"
              : escaparHTML(
                  pantallaSeleccionada.orientacion
                )}
          </span>

          <div class="promo-preview">
            ${crearVistaPrevia(archivo)}
          </div>

        </div>

        <div class="promo-meta">

          <strong>
            ${promo.activo
              ? "Promoción activa"
              : "Promoción inactiva"}
          </strong>

          <p>
            Destino:
            ${escaparHTML(alcance)}
          </p>

          <p>
            Orden:
            ${promo.orden || 1}
          </p>

          <p>
            Tipo:
            ${escaparHTML(
              archivo.tipo || "archivo"
            )}
          </p>

        </div>

      </div>

      <div class="promo-actions">

        <button
          class="toggle-btn"
          data-toggle="${promo.id}"
        >
          ${promo.activo
            ? "Desactivar"
            : "Activar"}
        </button>

        <button
          class="delete"
          data-delete="${promo.id}"
        >
          Eliminar
        </button>

      </div>
    `;

    listaPromos.appendChild(article);
  });

  document
    .querySelectorAll("[data-toggle]")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        async function () {
          const id =
            button.dataset.toggle;

          const promo =
            data.find(function (item) {
              return item.id === id;
            });

          if (!promo) {
            return;
          }

          button.disabled = true;

          const { error: errorActualizar } =
            await supabase
              .from("promociones")
              .update({
                activo: !promo.activo
              })
              .eq("id", id);

          if (errorActualizar) {
            console.error(
              "Error cambiando estado:",
              errorActualizar
            );

            setStatus(
              uploadStatus,
              "No se pudo cambiar el estado de la promoción.",
              "error"
            );
          }

          await cargarPromos();
        }
      );
    });

  document
    .querySelectorAll("[data-delete]")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        async function () {
          const id =
            button.dataset.delete;

          const promo =
            data.find(function (item) {
              return item.id === id;
            });

          if (!promo) {
            return;
          }

          const mensaje =
            promo.pantalla_id === null
              ? "Esta promoción aparece en todos los televisores. ¿Querés eliminarla de todos?"
              : "¿Querés eliminar esta promoción?";

          const confirmar =
            confirm(mensaje);

          if (!confirmar) {
            return;
          }

          button.disabled = true;

          await eliminarPromo(promo);
          await cargarPromos();
        }
      );
    });
}

function obtenerArchivoPromo(promo) {
  /*
    Una promoción general utiliza primero
    url y tipo.

    Una promoción exclusiva utiliza las
    columnas correspondientes a la orientación.
  */

  if (promo.pantalla_id === null) {
    return {
      url: promo.url,
      path: promo.path,
      tipo: promo.tipo
    };
  }

  if (
    pantallaSeleccionada &&
    pantallaSeleccionada.orientacion ===
      "vertical"
  ) {
    return {
      url:
        promo.url_vertical ||
        promo.url,

      path:
        promo.path_vertical ||
        promo.path,

      tipo:
        promo.tipo_vertical ||
        promo.tipo
    };
  }

  return {
    url:
      promo.url_horizontal ||
      promo.url,

    path:
      promo.path_horizontal ||
      promo.path,

    tipo:
      promo.tipo_horizontal ||
      promo.tipo
  };
}

function crearVistaPrevia(archivo) {
  if (!archivo || !archivo.url) {
    return `
      <span>
        Sin archivo
      </span>
    `;
  }

  if (archivo.tipo === "video") {
    return `
      <video
        src="${escaparAtributo(archivo.url)}"
        muted
        preload="metadata"
      ></video>
    `;
  }

  return `
    <img
      src="${escaparAtributo(archivo.url)}"
      alt="Vista previa"
    >
  `;
}

async function eliminarPromo(promo) {
  const archivos = [];

  agregarArchivoUnico(
    archivos,
    promo.path
  );

  agregarArchivoUnico(
    archivos,
    promo.path_horizontal
  );

  agregarArchivoUnico(
    archivos,
    promo.path_vertical
  );

  if (archivos.length > 0) {
    const { error: errorStorage } =
      await supabase.storage
        .from("promos")
        .remove(archivos);

    if (errorStorage) {
      console.error(
        "No se pudo eliminar el archivo:",
        errorStorage
      );
    }
  }

  const { error } = await supabase
    .from("promociones")
    .delete()
    .eq("id", promo.id);

  if (error) {
    console.error(
      "No se pudo eliminar la promoción:",
      error
    );

    setStatus(
      uploadStatus,
      "No se pudo eliminar la promoción.",
      "error"
    );

    return;
  }

  setStatus(
    uploadStatus,
    promo.pantalla_id === null
      ? "Promoción eliminada de todos los televisores."
      : "Promoción eliminada correctamente.",
    "success"
  );
}

/* =====================================================
   PREVISUALIZACIÓN
===================================================== */

function mostrarPreview() {
  const file =
    archivoPromo.files[0];

  previewPromo.innerHTML = "";

  if (!file) {
    previewPromo.textContent =
      "Sin archivo seleccionado";

    previewPromo.classList.add(
      "empty-preview"
    );

    return;
  }

  if (!validarArchivo(file)) {
    previewPromo.textContent =
      "Formato no permitido";

    previewPromo.classList.add(
      "empty-preview"
    );

    setStatus(
      uploadStatus,
      "Usá únicamente JPG, PNG o MP4.",
      "error"
    );

    return;
  }

  previewPromo.classList.remove(
    "empty-preview"
  );

  const url =
    URL.createObjectURL(file);

  if (
    file.type.startsWith("video")
  ) {
    const video =
      document.createElement("video");

    video.src = url;
    video.controls = true;
    video.muted = true;

    video.onloadeddata = function () {
      URL.revokeObjectURL(url);
    };

    previewPromo.appendChild(video);
  } else {
    const imagen =
      document.createElement("img");

    imagen.src = url;
    imagen.alt = "Vista previa";

    imagen.onload = function () {
      URL.revokeObjectURL(url);
    };

    previewPromo.appendChild(imagen);
  }

  setStatus(uploadStatus, "", "");
}

function limpiarSeleccion() {
  if (archivoPromo) {
    archivoPromo.value = "";
  }

  if (previewPromo) {
    previewPromo.innerHTML =
      "Sin archivo seleccionado";

    previewPromo.classList.add(
      "empty-preview"
    );
  }
}

/* =====================================================
   FUNCIONES AUXILIARES
===================================================== */

function agregarArchivoUnico(
  lista,
  path
) {
  if (
    path &&
    !lista.includes(path)
  ) {
    lista.push(path);
  }
}

function escaparHTML(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escaparAtributo(valor) {
  return escaparHTML(valor);
}

function setStatus(
  elemento,
  mensaje,
  tipo
) {
  if (!elemento) {
    return;
  }

  elemento.textContent = mensaje || "";

  elemento.classList.remove(
    "status-success",
    "status-error"
  );

  if (tipo === "success") {
    elemento.classList.add(
      "status-success"
    );
  }

  if (tipo === "error") {
    elemento.classList.add(
      "status-error"
    );
  }
}

/* =====================================================
   INICIO
===================================================== */

actualizarAlcancePromo();
verificarSesion();