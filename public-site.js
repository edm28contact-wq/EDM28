(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const drawer = document.querySelector('[data-mobile-drawer]');
  const backdrop = document.querySelector('[data-menu-backdrop]');
  const closeButton = document.querySelector('[data-menu-close]');
  if (!toggle || !drawer || !backdrop || !closeButton) return;

  const marketingPaths = new Set(['/freinage','/liaison-au-sol','/tarifs','/fonctionnement']);
  function updateClientNavigation(session) {
    document.querySelectorAll('.desktop-nav a, .drawer-nav a').forEach(link => {
      if (marketingPaths.has(link.getAttribute('href'))) link.hidden = Boolean(session?.user?.id);
    });
  }
  if (window.supabase?.createClient && window.EDM_PUBLIC_SUPABASE?.url && window.EDM_PUBLIC_SUPABASE?.key) {
    const c = window.supabase.createClient(window.EDM_PUBLIC_SUPABASE.url, window.EDM_PUBLIC_SUPABASE.key);
    c.auth.getSession().then(({data}) => updateClientNavigation(data?.session)).catch(()=>{});
    c.auth.onAuthStateChange((_event, session) => updateClientNavigation(session));
  }
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
