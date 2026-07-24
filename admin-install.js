(() => {
  if (window.__edmAdminInstallReady) return;
  window.__edmAdminInstallReady = true;

  let installPrompt = null;

  const buttons = () => Array.from(document.querySelectorAll('[data-install-admin]'));
  const statuses = () => Array.from(document.querySelectorAll('[data-install-status]'));
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setStatus(message) {
    statuses().forEach((node) => {
      node.textContent = message || '';
    });
  }

  function setInstalledUi() {
    buttons().forEach((button) => button.classList.add('hidden'));
    setStatus('Application installée sur cet appareil.');
  }

  function showInstallButtons() {
    if (standalone()) return setInstalledUi();
    buttons().forEach((button) => button.classList.remove('hidden'));
  }

  function manualInstructions() {
    const agent = navigator.userAgent.toLowerCase();
    if (agent.includes('android')) {
      return 'Dans Chrome, ouvrez le menu ⋮ puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
    }
    if (agent.includes('iphone') || agent.includes('ipad')) {
      return 'Dans le navigateur, ouvrez le menu Partager puis choisissez « Sur l’écran d’accueil ».';
    }
    return 'Dans Chrome ou Edge, utilisez l’icône d’installation dans la barre d’adresse, ou le menu du navigateur puis « Installer EDM28 Gestion ».';
  }

  async function requestInstall() {
    if (standalone()) return setInstalledUi();

    if (!installPrompt) {
      setStatus(manualInstructions());
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    if (choice?.outcome === 'accepted') {
      setStatus('Installation en cours...');
      buttons().forEach((button) => button.classList.add('hidden'));
    } else {
      setStatus('Installation annulée. Vous pourrez la relancer depuis ce bouton.');
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      setStatus('Ce navigateur ne prend pas en charge l’installation de l’application.');
      return;
    }

    try {
      await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' });
    } catch (error) {
      console.warn('EDM admin service worker unavailable', error);
      setStatus('Installation indisponible pour le moment. Le back-office reste utilisable dans le navigateur.');
    }
  }

  function bindButtons() {
    buttons().forEach((button) => {
      if (button.dataset.installBound === '1') return;
      button.dataset.installBound = '1';
      button.addEventListener('click', requestInstall);
    });
    showInstallButtons();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    bindButtons();
    setStatus('EDM28 Gestion peut être installée sur cet appareil.');
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    setInstalledUi();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', () => {
    if (standalone()) setInstalledUi();
  });

  function boot() {
    bindButtons();
    void registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
