(() => {
  if (window.__edmClientFlowLoader) return;
  window.__edmClientFlowLoader = true;

  const scripts = [
    { src: '/client-otp-flow.js?v=2', attr: 'data-edm-otp' },
    { src: '/client-step3-fixes.js?v=1', attr: 'data-edm-step3' },
    { src: '/request-submit-safe.js?v=1', attr: 'data-edm-submit' },
    { src: '/client-quotes.js?v=1', attr: 'data-edm-quotes' },
    { src: '/client-operations.js?v=1', attr: 'data-edm-operations' },
    { src: '/client-invoices.js?v=1', attr: 'data-edm-invoices' }
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