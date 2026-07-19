(() => {
  if (window.__edmClientFlowLoader) return;
  window.__edmClientFlowLoader = true;

  const scripts = [
    { src: '/client-otp-flow.js?v=2', marker: 'edmOtp' },
    { src: '/client-step3-fixes.js?v=1', marker: 'edmStep3' },
    { src: '/request-submit-safe.js?v=1', marker: 'edmSafeSubmit' }
  ];

  const loadScript = ({ src, marker }) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-${marker}]`);
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
    script.dataset[marker] = '1';
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Module indisponible : ${src}`)), { once: true });
    document.body.appendChild(script);
  });

  scripts.reduce((chain, item) => chain.then(() => loadScript(item)), Promise.resolve())
    .catch((error) => console.error('EDM client flow loader:', error));
})();
