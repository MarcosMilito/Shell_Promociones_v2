import { supabase } from "./supabase-config.js";

const listaEstaciones =
  document.getElementById("listaEstaciones");

const stationStatus =
  document.getElementById("stationStatus");

async function cargarEstaciones() {
  listaEstaciones.innerHTML = `
    <div class="station-loading">
      Cargando estaciones...
    </div>
  `;

  const { data, error } = await supabase.rpc(
    "listar_estaciones_publicas"
  );

  if (error) {
    console.error(
      "Error cargando estaciones:",
      error
    );

    listaEstaciones.innerHTML = "";

    stationStatus.textContent =
      "No se pudieron cargar las estaciones.";

    stationStatus.classList.add(
      "status-error"
    );

    return;
  }

  listaEstaciones.innerHTML = "";

  if (!data || data.length === 0) {
    stationStatus.textContent =
      "Todavía no hay estaciones disponibles.";

    return;
  }

  data.forEach(function (estacion) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "station-button";

    const icon =
      document.createElement("span");

    icon.className = "station-button-icon";
    icon.textContent = obtenerIniciales(
      estacion.nombre
    );

    const contenido =
      document.createElement("span");

    contenido.className =
      "station-button-content";

    const nombre =
      document.createElement("strong");

    nombre.textContent = estacion.nombre;

    const descripcion =
      document.createElement("small");

    descripcion.textContent =
      "Ingresar al panel administrador";

    contenido.appendChild(nombre);
    contenido.appendChild(descripcion);

    const flecha =
      document.createElement("span");

    flecha.className = "station-button-arrow";
    flecha.textContent = "›";

    button.appendChild(icon);
    button.appendChild(contenido);
    button.appendChild(flecha);

    button.addEventListener(
      "click",
      function () {
        const slug =
          encodeURIComponent(estacion.slug);

        window.location.href =
          `/admin.html?estacion=${slug}`;
      }
    );

    listaEstaciones.appendChild(button);
  });
}

function obtenerIniciales(nombre) {
  return String(nombre || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(function (palabra) {
      return palabra.charAt(0).toUpperCase();
    })
    .join("");
}

cargarEstaciones();