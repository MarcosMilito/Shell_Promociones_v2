/* ============================================================
   MOBILE PRO
   Navegación táctil para el panel normal y el centro de soporte.
   No modifica consultas, permisos ni datos.
============================================================ */

(function () {
  "use strict";

  var MOBILE_QUERY = "(max-width: 760px)";
  var media = window.matchMedia(MOBILE_QUERY);

  function isMobile() {
    return media.matches;
  }

  function setBodyNavState(nav) {
    if (!nav) return;

    var visible =
      isMobile() &&
      !nav.hidden;

    document.body.classList.toggle(
      "mobile-pro-has-nav",
      visible
    );
  }

  function scrollToElement(element) {
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function createNav(items, label) {
    var nav = document.createElement("nav");

    nav.className = "mobile-pro-nav";
    nav.setAttribute("aria-label", label);

    items.forEach(function (item) {
      var button = document.createElement("button");

      button.type = "button";
      button.textContent = item.label;
      button.dataset.icon = item.icon;
      button.dataset.mobileKey = item.key;

      button.addEventListener(
        "click",
        item.onClick
      );

      nav.appendChild(button);
    });

    document.body.appendChild(nav);

    return nav;
  }

  function setActiveButton(nav, key) {
    if (!nav) return;

    nav
      .querySelectorAll("[data-mobile-key]")
      .forEach(function (button) {
        button.classList.toggle(
          "is-active",
          button.dataset.mobileKey === key
        );
      });
  }

  /* =========================================================
     PANEL DE ESTACIÓN
  ========================================================= */

  function setupAdminMobile() {
    if (
      !document.body.classList.contains("admin-body")
    ) {
      return;
    }

    var adminBox =
      document.getElementById("adminBox");

    var sections = {
      tvs: document.getElementById("screensSection"),
      upload: document.getElementById("uploadSection"),
      promos: document.getElementById("promosSection")
    };

    if (!adminBox || !sections.tvs) return;

    var nav = createNav(
      [
        {
          key: "tvs",
          label: "Televisiones",
          icon: "▣",
          onClick: function () {
            setActiveButton(nav, "tvs");
            scrollToElement(sections.tvs);
          }
        },
        {
          key: "upload",
          label: "Cargar",
          icon: "＋",
          onClick: function () {
            setActiveButton(nav, "upload");
            scrollToElement(sections.upload);
          }
        },
        {
          key: "promos",
          label: "Promociones",
          icon: "▶",
          onClick: function () {
            setActiveButton(nav, "promos");
            scrollToElement(sections.promos);
          }
        }
      ],
      "Accesos rápidos del panel"
    );

    function updateVisibility() {
      nav.hidden =
        !isMobile() ||
        adminBox.classList.contains("hidden");

      setBodyNavState(nav);
    }

    var observer = new MutationObserver(updateVisibility);

    observer.observe(adminBox, {
      attributes: true,
      attributeFilter: ["class"]
    });

    updateVisibility();
    setActiveButton(nav, "tvs");

    if ("IntersectionObserver" in window) {
      var sectionObserver =
        new IntersectionObserver(
          function (entries) {
            var visible = entries
              .filter(function (entry) {
                return entry.isIntersecting;
              })
              .sort(function (a, b) {
                return b.intersectionRatio - a.intersectionRatio;
              })[0];

            if (visible && visible.target.dataset.mobileSection) {
              setActiveButton(
                nav,
                visible.target.dataset.mobileSection
              );
            }
          },
          {
            root: null,
            rootMargin: "-15% 0px -58% 0px",
            threshold: [0.05, 0.25, 0.5]
          }
        );

      Object.keys(sections).forEach(function (key) {
        var section = sections[key];

        if (!section) return;

        section.dataset.mobileSection = key;
        sectionObserver.observe(section);
      });
    }

    var archivo =
      document.getElementById("archivoPromo");

    if (archivo) {
      archivo.addEventListener("change", function () {
        if (!isMobile() || !archivo.files || !archivo.files[0]) {
          return;
        }

        window.setTimeout(function () {
          var preview =
            document.querySelector(".upload-preview-layout");

          if (preview) {
            scrollToElement(preview);
          }
        }, 220);
      });
    }

    media.addEventListener
      ? media.addEventListener("change", updateVisibility)
      : media.addListener(updateVisibility);
  }

  /* =========================================================
     CENTRO DE SOPORTE
  ========================================================= */

  function setupSupportMobile() {
    if (
      !document.body.classList.contains("support-body")
    ) {
      return;
    }

    var supportApp =
      document.getElementById("supportApp");

    if (!supportApp) return;

    var tabMap = {
      diagnostico: "Estado",
      usuarios: "Usuarios",
      televisiones: "TVs",
      promociones: "Promos"
    };

    var iconMap = {
      diagnostico: "✓",
      usuarios: "◎",
      televisiones: "▣",
      promociones: "▶"
    };

    var items = Object.keys(tabMap).map(function (tabName) {
      return {
        key: tabName,
        label: tabMap[tabName],
        icon: iconMap[tabName],
        onClick: function () {
          var tabButton =
            document.querySelector(
              '.support-tab[data-tab="' +
              tabName +
              '"]'
            );

          if (tabButton) {
            tabButton.click();
          }

          setActiveButton(nav, tabName);

          var workspace =
            document.getElementById("stationWorkspace");

          scrollToElement(workspace);
        }
      };
    });

    var nav = createNav(
      items,
      "Secciones del centro de soporte"
    );

    function updateVisibility() {
      nav.hidden =
        !isMobile() ||
        supportApp.classList.contains("hidden");

      setBodyNavState(nav);
    }

    var observer = new MutationObserver(updateVisibility);

    observer.observe(supportApp, {
      attributes: true,
      attributeFilter: ["class"]
    });

    document
      .querySelectorAll(".support-tab")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          setActiveButton(
            nav,
            button.dataset.tab
          );
        });
      });

    updateVisibility();
    setActiveButton(nav, "diagnostico");

    media.addEventListener
      ? media.addEventListener("change", updateVisibility)
      : media.addListener(updateVisibility);
  }

  function init() {
    document.documentElement.classList.toggle(
      "mobile-pro-active",
      isMobile()
    );

    setupAdminMobile();
    setupSupportMobile();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
