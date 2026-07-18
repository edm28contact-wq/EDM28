(() => {
  if (window.__edmEdgeRouting) return;
  window.__edmEdgeRouting = true;

  const originalFetch = window.fetch.bind(window);
  const functionBase = 'https://ojjbnwpkfvzjfukgqddz.supabase.co/functions/v1';

  window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw === '/api/submit-request-v2' || raw?.endsWith('/api/submit-request-v2')) {
      return originalFetch(`${functionBase}/submit-request-v2`, init);
    }
    return originalFetch(input, init);
  };
})();