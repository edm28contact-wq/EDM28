(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const drawer = document.querySelector('[data-mobile-drawer]');
  const backdrop = document.querySelector('[data-menu-backdrop]');
  const closeButton = document.querySelector('[data-menu-close]');
  if (!toggle || !drawer || !backdrop || !closeButton) return;

  let lastFocused = null;

  const setOpen = (open) => {
    drawer.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      lastFocused = document.activeElement;
      closeButton.focus();
    } else if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 820 && drawer.classList.contains('is-open')) setOpen(false);
  });
})();
