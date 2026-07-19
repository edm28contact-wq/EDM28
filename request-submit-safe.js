(() => {
  const STORAGE_KEY = 'edm28_pending_request_v1';
  const endpoint = '/api/submit-request-v2';
  const nativeFetch = window.fetch.bind(window);

  const readPending = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (_) { return null; }
  };

  const writePending = (value) => {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.endsWith(endpoint)) return nativeFetch(input, init);

    let requestId = '';
    try { requestId = JSON.parse(init.body || '{}').requestId || ''; }
    catch (_) {}

    if (requestId) writePending({ requestId, createdAt: Date.now() });
    const