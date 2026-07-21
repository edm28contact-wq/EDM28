(() => {
  if (window.__edmConnectedRouter) return;
  window.__edmConnectedRouter = true;

  const protectedPages = new Set(['account', 'garage', 'history']);
  const allPages = new Set(['home', 'appointment', 'account', 'garage', 'history', 'about']);

  function reveal() {
    protectedPages.forEach((id) => {
      document.querySelectorAll(`[data-page="${id}"]`).forEach((button) => {
        button.classList.remove('hidden');
        button.removeAttribute('aria-hidden');
      });
    });
  }

  function directActivate(id) {
    document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === id));
    document.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === id));
    document.getElementById('sideNav')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('show');
    document.body.classList.remove('menu-open');
    if (id === 'account' && typeof renderAccountPage === 'function') renderAccountPage();
    if (id === 'garage' && typeof renderGarage === 'function') renderGarage();
  }

  function open(id) {
    const signedIn = Boolean(window.state?.user?.id);
    const target = protectedPages.has(id) && !signedIn ? 'appointment' : id;
    try {
      if (typeof window.showPage === 'function') window.showPage(target);
      else directActivate(target);
    } catch (error) {
      console.warn('EDM navigation fallback', error);
      directActivate(target);
    }
    if (target === 'appointment' && target !== id) document.getElementById('email')?.focus();
  }

  function install() {
    reveal();
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-page]');
      const id = button?.dataset?.page;
      if (!id || !allPages.has(id) || !window.state?.user?.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open(id);
      setTimeout(reveal, 0);
    }, true);
    new MutationObserver(reveal).observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
  window.addEventListener('load', reveal);
})();