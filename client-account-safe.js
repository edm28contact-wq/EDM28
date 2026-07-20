(() => {
  if (window.__edmSafeAccountPage) return;
  window.__edmSafeAccountPage = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const appState = () => (typeof state !== 'undefined' && state ? state : null);

  function showPageDirect(pageId) {
    document