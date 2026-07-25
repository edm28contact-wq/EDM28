(() => {
  let submitting = false;

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

  function showUpdateBanner() {
    let banner = document.getElementById('edm-update-banner');
    if (banner) {
      banner.style.display = 'flex';
      return;
    }

    banner = document.createElement('div');
    banner.id = 'edm-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:10px;max-width:min(92vw,620px);padding:11px 14px;border-radius:16px;background:#172126;color:#fff;box-shadow:0 14px 34px rgba(0,0,0,.28)';
    banner.innerHTML = '<span>Une mise à jour est prête. Terminez votre saisie avant d’actualiser.</span><button type="button" class="btn btn-primary">Actualiser</button>';
    banner.querySelector('button').addEventListener('click', () => window.location.reload());
    document.body.appendChild(banner);
  }

  function watchServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', showUpdateBanner);
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
