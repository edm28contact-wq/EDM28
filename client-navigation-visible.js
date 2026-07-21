(() => {
  const protectedPages = new Set(['account', 'garage', 'history']);
  const safe = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

  function revealClientNavigation() {
    protectedPages.forEach((page) => {
      document.querySelectorAll(`[data-page="${page}"]`).forEach((button) => {
        button.classList.remove('hidden');
        button.removeAttribute('aria-hidden');
      });
    });
  }

  function activatePage(pageId) {
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === pageId);
    });
    document.querySelectorAll