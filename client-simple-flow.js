(() => {
  if (window.__edmClientFlowLoader) return;
  window.__edmClientFlowLoader = true;

  const legacyRenderHistory = typeof window.renderHistory === 'function' ? window.renderHistory : null;
  if (legacyRenderHistory && !window.__edmLegacyHistoryGuard) {
    window.__edmLegacyHistoryGuard = true;
    window.renderHistory = function guardedRenderHistory(...args) {
      if (!document.getElementById('historyList')) return;
      return legacyRenderHistory.apply(this, args);
    };
  }

  const scripts = [
    { src: '/client-password-flow.js?v=2', attr: 'data-edm-password' },
    { src: '/client-vehicle-required-fields.js?v=1', attr: 'data-edm-vehicle-required-fields' },
    { src: '/client-step3-fixes.js?v=2', attr: 'data-edm-step3' },
    { src: '/request-submit-safe.js?v=4', attr: 'data-edm-submit' },
    { src: '/client-quotes.js?v=1', attr: 'data-edm-quotes' },
    { src: '/client-disbursements.js?v=1', attr: 'data-edm-disbursements' },
    { src: '/client-operations.js?v=1', attr: 'data-edm-operations' },
    { src: '/client-inspections.js?v=1', attr: 'data-edm-inspections' },
    { src: '/client-invoices.js?v=1', attr: 'data-edm-invoices' },
    { src: '/client-document-download.js?v=1', attr: 'data-edm-document-downloads' },
    { src: '/client-messages.js?v=1', attr: 'data-edm-messages' },
    { src: '/combo-suspended.js?v=1', attr: 'data-edm-combo-policy' },
    { src: '/client-basket-pricing.js?v=1', attr: 'data-edm-basket-pricing' },
    { src: '/client-note-guidance.js?v=1', attr: 'data-edm-note-guidance' },
    { src: '/client-labor-pricing.js?v=2', attr: 'data-edm-labor-pricing' }
  ];

  const loadScript = ({ src, attr }) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${attr}]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(attr, '1');
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Module indisponible : ${src}`)), { once: true });
    document.body.appendChild(script);
  });

  scripts.reduce((chain, item) => chain.then(() => loadScript(item)), Promise.resolve())
    .catch((error) => console.error('EDM client flow loader:', error));
})();