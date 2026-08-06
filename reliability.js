(() => {
  let submitting = false;
  let serviceWorkerWatching = false;

  function ensureNetworkBanner() {
    if (document.getElementById('edm-network-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'edm-network-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;padding:11px 16px;border-radius:999px;background:#7a2e22;color:#fff;font-weight:900;box-shadow:0 14px 34px rgba(0,0,0,.28);display:none';
    banner.textContent = 'Connexion internet indisponible';
    document.body.appendChild(banner);

    const refresh = () => {
      banner.style.display = navigator.onLine ? 'none' : 'block';
      const submit = document.getElementById('btnSubmit');
      if (submit && !submitting) submit.disabled = !navigator.onLine;
    };

    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    refresh();
  }

  function protectSubmission() {
    const button = document.getElementById('btnSubmit');
    if (!button || button.dataset.reliabilityReady === '1') return;
    button.dataset.reliabilityReady = '1';

    button.addEventListener('click', (event) => {
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const host = document.getElementById('submitStatus');
        if (host) host.innerHTML = '<div class="errorbox"><strong>Connexion indisponible.</strong><br>Reconnectez-vous avant d’envoyer la demande.</div>';
        return;
      }
      if (submitting) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      submitting = true;
      setTimeout(() => { submitting = false; }, 12000);
    }, true);
  }

  function watchServiceWorker() {
    if (!('serviceWorker' in navigator) || serviceWorkerWatching) return;
    serviceWorkerWatching = true;

    const controlledAtStart = Boolean(navigator.serviceWorker.controller);
    const reloadKey = 'edm-sw-controller-reload-at';
    let reloadScheduled = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A first installation can claim the current page while it is still loading.
      // Reloading in that case interrupts navigation and can send users back home.
      if (!controlledAtStart || reloadScheduled) return;

      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      if (now - lastReload < 30000) return;

      reloadScheduled = true;
      sessionStorage.setItem(reloadKey, String(now));
      setTimeout(() => window.location.reload(), 250);
    });
  }

  function init() {
    ensureNetworkBanner();
    protectSubmission();
    watchServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', () => setTimeout(init, 250));
})();
