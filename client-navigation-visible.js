(() => {
  const protectedPages = ['account', 'garage', 'history'];

  function revealClientNavigation() {
    protectedPages.forEach((page) => {
      document.querySelectorAll(`[data-page="${page}"]`).forEach((button) => {
        button.classList.remove('hidden');
        button.removeAttribute('aria-hidden');
      });
    });
  }

  function install() {
    revealClientNavigation();
    const nav = document.querySelector('.nav');
    if (!nav || window.__edmClientNavigationVisible) return;
    window.__edmClientNavigationVisible = true;
    new MutationObserver(revealClientNavigation).observe(nav, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
    document.addEventListener('click', () => setTimeout(revealClientNavigation, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.addEventListener('load', install);
})();
