(function initializePwa() {
  const installButton = document.querySelector("#installApp");
  const installLabel = document.querySelector("#installAppLabel");
  const dialog = document.querySelector("#pwaInstallDialog");
  const closeButton = document.querySelector("#closePwaInstall");
  const eyebrow = document.querySelector("#pwaInstallEyebrow");
  const title = document.querySelector("#pwaInstallTitle");
  const description = document.querySelector("#pwaInstallDescription");
  const steps = document.querySelector("#pwaInstallSteps");
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIosSafari = () => {
    const userAgent = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
    return isIos && !isOtherIosBrowser;
  };

  function getText() {
    const language = window.TLG_PROGRESS?.getLanguage?.() || "es";
    return window.TLG_TRANSLATIONS?.[language]?.pwa ||
      window.TLG_TRANSLATIONS?.es?.pwa || {};
  }

  function renderText() {
    const text = getText();
    installLabel.textContent = text.install || "Instalar";
    installButton.setAttribute(
      "aria-label",
      text.installLabel || text.install || "Instalar aplicación"
    );
    eyebrow.textContent = text.eyebrow || "Llévala contigo";
    title.textContent = text.title || "Instalar To the Last Groove";
    description.textContent = text.description ||
      "Ábrela desde tu pantalla de inicio y úsala como una aplicación.";
    closeButton.setAttribute("aria-label", text.close || "Cerrar instalación");

    const stepCopy = isIosSafari()
      ? text.iosSteps
      : text.genericSteps;
    steps.replaceChildren();
    (stepCopy || []).forEach((stepText) => {
      const item = document.createElement("li");
      item.textContent = stepText;
      steps.appendChild(item);
    });
  }

  function updateVisibility() {
    installButton.hidden = isStandalone() || (!deferredPrompt && !isIosSafari());
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateVisibility();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateVisibility();
  });

  installButton?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      updateVisibility();
      return;
    }

    renderText();
    if (!dialog.open) {
      dialog.showModal();
    }
  });

  closeButton?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  window.addEventListener("tlg-language-change", renderText);
  window.matchMedia("(display-mode: standalone)").addEventListener?.(
    "change",
    updateVisibility
  );

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=8.9").catch((error) => {
        console.error("No se pudo registrar la aplicación instalable:", error);
      });
    });
  }

  renderText();
  updateVisibility();
})();
