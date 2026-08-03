import { FFmpeg } from "./vendor/ffmpeg/wrapper/index.js";

/*
  Compresión automática de videos para Supabase Free.

  - Los archivos MP4 de hasta 44 MiB se suben sin modificar.
  - Los archivos mayores se convierten localmente en el navegador.
  - El resultado final se genera como MP4 H.264 + AAC.
  - El objetivo es quedar alrededor de 44 MiB, dejando margen
    por debajo del límite de 50 MB de Supabase Free.
*/

const MIB = 1024 * 1024;

export const UMBRAL_COMPRESION_BYTES = 44 * MIB;
export const LIMITE_SEGURO_BYTES = 48 * MIB;
export const OBJETIVO_SALIDA_BYTES = 44 * MIB;
export const LIMITE_ENTRADA_WASM_BYTES = 2 * 1024 * MIB;

const AUDIO_KBPS = 96;
const MAX_LADO_PIXELES = 1920;

const CORE_URL = new URL(
  "./vendor/ffmpeg/core/ffmpeg-core.js",
  import.meta.url
).href;

const WASM_URL = new URL(
  "./vendor/ffmpeg/core/ffmpeg-core.wasm",
  import.meta.url
).href;

let ffmpeg = null;
let promesaCarga = null;
let callbackEstadoActual = null;

function notificar(
  etapa,
  mensaje,
  porcentaje = null
) {
  if (
    typeof callbackEstadoActual !== "function"
  ) {
    return;
  }

  callbackEstadoActual({
    etapa,
    mensaje,
    porcentaje
  });
}

function limitarPorcentaje(valor) {
  if (!Number.isFinite(valor)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(valor))
  );
}

async function obtenerMotorFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    /*
      El evento progress es experimental, por eso
      también mostramos mensajes por etapa.
    */

    ffmpeg.on(
      "progress",
      function ({ progress }) {
        const porcentaje =
          12 + limitarPorcentaje(progress * 76);

        notificar(
          "comprimiendo",
          `Comprimiendo video… ${porcentaje}%`,
          porcentaje
        );
      }
    );

    ffmpeg.on(
      "log",
      function ({ message }) {
        /*
          Se conserva en consola para diagnóstico,
          sin mostrárselo al usuario.
        */

        console.debug(
          "[Compresor de video]",
          message
        );
      }
    );
  }

  if (ffmpeg.loaded) {
    return ffmpeg;
  }

  if (!promesaCarga) {
    notificar(
      "cargando-motor",
      "Preparando el compresor de video…",
      3
    );

    promesaCarga = ffmpeg
      .load({
        coreURL: CORE_URL,
        wasmURL: WASM_URL
      })
      .then(function () {
        notificar(
          "motor-listo",
          "Compresor listo. Analizando video…",
          8
        );

        return ffmpeg;
      })
      .catch(function (error) {
        promesaCarga = null;

        throw new Error(
          "No se pudo iniciar el compresor de video. " +
          "Revisá que la carpeta vendor/ffmpeg esté publicada."
        );
      });
  }

  return promesaCarga;
}

function leerMetadatosVideo(file) {
  return new Promise(function (
    resolve,
    reject
  ) {
    const video =
      document.createElement("video");

    const objectURL =
      URL.createObjectURL(file);

    function limpiar() {
      video.removeAttribute("src");

      try {
        video.load();
      } catch (error) {
        /* No interrumpimos la limpieza. */
      }

      URL.revokeObjectURL(objectURL);
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = function () {
      const duracion =
        Number(video.duration);

      const ancho =
        Number(video.videoWidth);

      const alto =
        Number(video.videoHeight);

      limpiar();

      if (
        !Number.isFinite(duracion) ||
        duracion <= 0
      ) {
        reject(
          new Error(
            "No se pudo determinar la duración del video."
          )
        );

        return;
      }

      resolve({
        duracion,
        ancho,
        alto
      });
    };

    video.onerror = function () {
      limpiar();

      reject(
        new Error(
          "El navegador no pudo analizar el video seleccionado."
        )
      );
    };

    video.src = objectURL;
  });
}

function numeroPar(valor) {
  const entero =
    Math.max(2, Math.round(valor));

  return entero % 2 === 0
    ? entero
    : entero - 1;
}

function calcularDimensiones(
  ancho,
  alto
) {
  if (
    !Number.isFinite(ancho) ||
    !Number.isFinite(alto) ||
    ancho <= 0 ||
    alto <= 0
  ) {
    return null;
  }

  const ladoMayor =
    Math.max(ancho, alto);

  if (ladoMayor <= MAX_LADO_PIXELES) {
    return null;
  }

  const factor =
    MAX_LADO_PIXELES / ladoMayor;

  return {
    ancho: numeroPar(ancho * factor),
    alto: numeroPar(alto * factor)
  };
}

function calcularBitrateVideoKbps(
  duracionSegundos,
  objetivoBytes
) {
  /*
    Dejamos un margen del 5 % para:
    - audio
    - encabezados MP4
    - variaciones del codificador
  */

  const kilobitsDisponibles =
    (
      objetivoBytes *
      8 *
      0.95
    ) / 1000;

  const bitrateTotalKbps =
    kilobitsDisponibles /
    duracionSegundos;

  const bitrateVideoKbps =
    Math.floor(
      bitrateTotalKbps -
      AUDIO_KBPS
    );

  if (bitrateVideoKbps < 120) {
    throw new Error(
      "El video es demasiado largo para reducirlo a menos de 50 MB con una calidad aceptable."
    );
  }

  return bitrateVideoKbps;
}

function nombreSeguro(nombre) {
  return String(nombre || "video")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video";
}

function crearArgumentosFFmpeg({
  archivoEntrada,
  archivoSalida,
  bitrateVideoKbps,
  dimensiones
}) {
  const argumentos = [
    "-i",
    archivoEntrada,

    "-map",
    "0:v:0",

    /*
      El signo ? hace que el audio sea opcional.
      Un video sin audio no produce un error.
    */

    "-map",
    "0:a?",

    "-sn",

    "-c:v",
    "libx264",

    /*
      ultrafast reduce bastante el tiempo de espera
      dentro del navegador.
    */

    "-preset",
    "ultrafast",

    "-b:v",
    `${bitrateVideoKbps}k`,

    "-maxrate",
    `${Math.round(
      bitrateVideoKbps * 1.05
    )}k`,

    "-bufsize",
    `${Math.round(
      bitrateVideoKbps * 2
    )}k`,

    "-r",
    "30",

    "-pix_fmt",
    "yuv420p",

    "-profile:v",
    "high",

    "-level:v",
    "4.1"
  ];

  if (dimensiones) {
    argumentos.push(
      "-vf",
      `scale=${dimensiones.ancho}:${dimensiones.alto}`
    );
  }

  argumentos.push(
    "-c:a",
    "aac",

    "-b:a",
    `${AUDIO_KBPS}k`,

    "-ac",
    "2",

    "-movflags",
    "+faststart",

    archivoSalida
  );

  return argumentos;
}

async function borrarArchivoTemporal(
  motor,
  path
) {
  if (!path) {
    return;
  }

  try {
    await motor.deleteFile(path);
  } catch (error) {
    /*
      Puede no existir si FFmpeg falló antes de crearlo.
    */
  }
}

async function ejecutarCompresion({
  motor,
  archivoEntrada,
  archivoSalida,
  metadatos,
  objetivoBytes
}) {
  const bitrateVideoKbps =
    calcularBitrateVideoKbps(
      metadatos.duracion,
      objetivoBytes
    );

  const dimensiones =
    calcularDimensiones(
      metadatos.ancho,
      metadatos.alto
    );

  const argumentos =
    crearArgumentosFFmpeg({
      archivoEntrada,
      archivoSalida,
      bitrateVideoKbps,
      dimensiones
    });

  const codigoSalida =
    await motor.exec(argumentos);

  if (codigoSalida !== 0) {
    throw new Error(
      "El compresor no pudo procesar este video."
    );
  }

  return {
    bitrateVideoKbps,
    datos: await motor.readFile(
      archivoSalida
    )
  };
}

function crearArchivoFinal(
  datos,
  nombreOriginal
) {
  const inicio =
    datos.byteOffset || 0;

  const fin =
    inicio + datos.byteLength;

  const buffer =
    datos.buffer.slice(
      inicio,
      fin
    );

  return new File(
    [buffer],
    `${nombreSeguro(nombreOriginal)}-optimizado.mp4`,
    {
      type: "video/mp4",
      lastModified: Date.now()
    }
  );
}

export function necesitaCompresion(file) {
  return Boolean(
    file &&
    file.type === "video/mp4" &&
    file.size > UMBRAL_COMPRESION_BYTES
  );
}

export function formatearBytes(bytes) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "0 MB";
  }

  if (bytes < MIB) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes / MIB
  ).toFixed(1)} MB`;
}

export async function prepararArchivoParaSubida(
  file,
  onEstado
) {
  if (!file) {
    throw new Error(
      "No se recibió ningún archivo."
    );
  }

  if (!necesitaCompresion(file)) {
    return file;
  }

  if (
    file.size >=
    LIMITE_ENTRADA_WASM_BYTES
  ) {
    throw new Error(
      "El video supera el límite técnico de 2 GB del compresor del navegador."
    );
  }

  if (
    typeof WebAssembly === "undefined" ||
    typeof Worker === "undefined"
  ) {
    throw new Error(
      "Este navegador no permite comprimir videos automáticamente."
    );
  }

  callbackEstadoActual =
    typeof onEstado === "function"
      ? onEstado
      : null;

  const identificador =
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 9);

  const archivoEntrada =
    `entrada-${identificador}.mp4`;

  const archivoSalida =
    `salida-${identificador}.mp4`;

  let motor = null;

  try {
    notificar(
      "analizando",
      "Analizando tamaño y duración del video…",
      1
    );

    const metadatos =
      await leerMetadatosVideo(file);

    motor =
      await obtenerMotorFFmpeg();

    notificar(
      "preparando",
      "Preparando el video para comprimir…",
      10
    );

    const datosEntrada =
      new Uint8Array(
        await file.arrayBuffer()
      );

    await motor.writeFile(
      archivoEntrada,
      datosEntrada
    );

    /*
      Primera pasada: apuntamos a 44 MiB.
    */

    let resultado =
      await ejecutarCompresion({
        motor,
        archivoEntrada,
        archivoSalida,
        metadatos,
        objetivoBytes:
          OBJETIVO_SALIDA_BYTES
      });

    let archivoFinal =
      crearArchivoFinal(
        resultado.datos,
        file.name
      );

    /*
      Si por variaciones del contenedor o del codec
      todavía supera el límite seguro, hacemos una
      segunda compresión con un objetivo proporcional.
    */

    if (
      archivoFinal.size >
      LIMITE_SEGURO_BYTES
    ) {
      notificar(
        "reajustando",
        "Ajustando nuevamente el tamaño final…",
        89
      );

      await borrarArchivoTemporal(
        motor,
        archivoSalida
      );

      const proporcion =
        LIMITE_SEGURO_BYTES /
        archivoFinal.size;

      const segundoObjetivo =
        Math.floor(
          OBJETIVO_SALIDA_BYTES *
          proporcion *
          0.90
        );

      resultado =
        await ejecutarCompresion({
          motor,
          archivoEntrada,
          archivoSalida,
          metadatos,
          objetivoBytes:
            segundoObjetivo
        });

      archivoFinal =
        crearArchivoFinal(
          resultado.datos,
          file.name
        );
    }

    if (
      archivoFinal.size >
      LIMITE_SEGURO_BYTES
    ) {
      throw new Error(
        "El video se comprimió, pero todavía supera el tamaño permitido. Probá con un video de menor duración."
      );
    }

    notificar(
      "completado",
      `Video optimizado: ${formatearBytes(file.size)} → ${formatearBytes(archivoFinal.size)}.`,
      95
    );

    return archivoFinal;

  } finally {
    if (motor) {
      await borrarArchivoTemporal(
        motor,
        archivoEntrada
      );

      await borrarArchivoTemporal(
        motor,
        archivoSalida
      );
    }

    callbackEstadoActual = null;
  }
}
