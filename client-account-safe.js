(() => {
  if (window.__edmAccountNavV9) return;
  window.__edmAccountNavV9 = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const currentUser = () => {
    try {
      return typeof state !== 'undefined' && state && state.user ? state.user : null;
    } catch (_) {
      return null;
    }
  };

  function closeMenu