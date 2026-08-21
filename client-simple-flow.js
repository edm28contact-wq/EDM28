(() => {
  if (window.__edmClientFlowLoader) return;
  window.__edmClientFlowLoader = true;

  // Keep the stable client pages and prevent the experimental replacement modules
  // from taking over history/messaging/home when they are loaded later by the shell.
  window.__edmClientFinalExperienceInstalled = true;
  window.__edmClientFinalPatchInstalled = true;

  function forceVotreBlack() {
    const h1 = document.querySelector('#home h1');
    if (!h1) return;
    const existing = h1.querySelector('[data-edm-votre-black]');
    if (existing) {
      existing.style.setProperty('color', '#050505', 'important');
      existing.style.setProperty('text-shadow', 'none', 'important');
      return;
    }
    if (!/\bVOTRE\b/i.test(h1.textContent || '')) return;
    h1.innerHTML = h1.innerHTML.replace(/\b(VOTRE|Votre)\b/, '<span data-edm-votre-black style="color:#050505!important;text-shadow:none!important">$1</span>');
  }

  const scripts = [
    { src: '/client-password-flow.js?v=2', attr: 'data-edm-password' },
    { src: '/client-step3-fixes.js?v=2', attr: 'data-edm-step3' },
    { src: '/request-submit-safe.js?v=4', attr: 'data-edm-submit' },
    { src: '/client-quotes.js?v=1', attr: 'data-edm-quotes' },
    { src: '/client-operations.js?v=1', attr: 'data-edm-operations' },
    { src: '/client-inspections.js?v=1', attr: 'data-edm-inspections' },
    { src: '/client-invoices.js?v=1', attr: 'data-edm-invoices' },
    { src: '/client-document-download.js?v=1', attr: 'data-edm-document-downloads' },
    { src: '/client-messages.js?v=2', attr: 'data-edm-messages' },
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

  const observer = new MutationObserver(forceVotreBlack);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  forceVotreBlack();
  window.setTimeout(forceVotreBlack, 200);
  window.setTimeout(forceVotreBlack, 1000);

  scripts.reduce((chain, item) => chain.then(() => loadScript(item)), Promise.resolve())
    .catch((error) => console.error('EDM client flow loader:', error));
})();
