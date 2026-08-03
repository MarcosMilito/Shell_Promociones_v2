/*
  Mantiene activo el ONN mientras la página de promociones
  permanece visible.

  No simula clics. Usa Screen Wake Lock, que es la API
  diseñada para evitar que Android/Google TV atenúe,
  bloquee o apague la pantalla por inactividad.
*/

(function () {
  "use strict";

  var bloqueoPantalla = null;
  var intervaloVerificacion = null;
  var temporizadorReintento = null;

  function debugActivo() {
    return (
      window.location.search.indexOf("debug=1") !== -1
    );
  }

  function registrar(mensaje, dato) {
    if (!debugActivo()) return;

    if (typeof dato !== "undefined") {
      console.log("[Mantener activo]", mensaje, dato);
    } else {
      console.log("[Mantener activo]", mensaje);
    }
  }

  function limpiarReintento() {
    if (!temporizadorReintento) return;

    clearTimeout(temporizadorReintento);
    temporizadorReintento = null;
  }

  function programarReintento() {
    limpiarReintento();

    temporizadorReintento = setTimeout(
      solicitarBloqueoPantalla,
      5000
    );
  }

  function bloqueoSigueActivo() {
    return Boolean(
      bloqueoPantalla &&
      bloqueoPantalla.released === false
    );
  }

  function solicitarBloqueoPantalla() {
    if (
      document.visibilityState &&
      document.visibilityState !== "visible"
    ) {
      registrar("La página no está visible.");
      return;
    }

    if (
      !navigator ||
      !navigator.wakeLock ||
      typeof navigator.wakeLock.request !== "function"
    ) {
      registrar("El navegador no admite Screen Wake Lock.");
      return;
    }

    if (bloqueoSigueActivo()) {
      registrar("El bloqueo ya está activo.");
      return;
    }

    limpiarReintento();

    navigator.wakeLock
      .request("screen")
      .then(function (nuevoBloqueo) {
        bloqueoPantalla = nuevoBloqueo;

        registrar("Bloqueo de pantalla activado.");

        nuevoBloqueo.addEventListener(
          "release",
          function () {
            registrar("El sistema liberó el bloqueo.");
            bloqueoPantalla = null;

            if (
              !document.visibilityState ||
              document.visibilityState === "visible"
            ) {
              programarReintento();
            }
          }
        );
      })
      .catch(function (error) {
        bloqueoPantalla = null;
        registrar("No se pudo activar el bloqueo.", error);
        programarReintento();
      });
  }

  function iniciarProteccion() {
    solicitarBloqueoPantalla();

    if (intervaloVerificacion) {
      clearInterval(intervaloVerificacion);
    }

    /*
      Cada dos minutos comprobamos silenciosamente
      que el bloqueo siga activo.
    */

    intervaloVerificacion = setInterval(
      solicitarBloqueoPantalla,
      120000
    );
  }

  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        !document.visibilityState ||
        document.visibilityState === "visible"
      ) {
        solicitarBloqueoPantalla();
      }
    }
  );

  window.addEventListener(
    "focus",
    solicitarBloqueoPantalla
  );

  window.addEventListener(
    "pageshow",
    solicitarBloqueoPantalla
  );

  window.addEventListener(
    "online",
    solicitarBloqueoPantalla
  );

  document.addEventListener(
    "play",
    function (event) {
      if (
        event.target &&
        event.target.tagName === "VIDEO"
      ) {
        solicitarBloqueoPantalla();
      }
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciarProteccion
    );
  } else {
    iniciarProteccion();
  }
})();
