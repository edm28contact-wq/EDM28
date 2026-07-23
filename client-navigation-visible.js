(() => {
  if (window.__edmMenuRouterV6) return;
  window.__edmMenuRouterV6 = true;

  const allPages = new Set(['home', 'appointment', 'account', 'garage', 'history', 'about']);
  const privatePages = new Set(['account', 'garage', 'history']);
  let knownSessionUser = null;
  let sessionSync = null;

  function revealNavigation() {
    privatePages.forEach((id) => {
      document.querySelectorAll(`[data-page="${id}"]`).forEach((button) => {
        button.classList.remove('hidden');
        button.removeAttribute('aria-hidden');
        button.disabled = false;
      });
    });
  }

  function closeMenu() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sideNav')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('show');
    document.body?.classList.remove('menu-open');
  }

  function showFallback(id, error) {
    console.warn(`EDM ${id} render unavailable`, error);
    const hostId = id === 'account' ? 'accountPageContent' : id === 'garage' ? 'garageList' : 'historyList';
    const host = document.getElementById(hostId);
    if (host && !host.textContent.trim()) {
      host.innerHTML = '<div class="notice">Cette page est ouverte. Les informations du compte sont en cours de chargement.</div>';
    }
  }

  function renderPage(id) {
    try {
      if (id === 'account' && typeof renderAccountPage === 'function') renderAccountPage();
      if (id === 'garage' && typeof renderGarage === 'function') renderGarage();
      if (id === 'history' && typeof renderHistory === 'function') renderHistory();
    } catch (error) {
      showFallback(id, error);
    }
  }

  function activate(id) {
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === id);
    });
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === id);
    });
    closeMenu();
    renderPage(id);
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {}
  }

  async function hydrateSessionUser(user) {
    if (!user) return false;
    knownSessionUser = user;
    try {
      if (typeof hydrateUserFromSupabase === 'function') {
        await hydrateUserFromSupabase(user);
      } else if (typeof state !== 'undefined') {
        const meta = user.user_metadata || {};
        const current = state.user || {};
        state.user = {
          id: user.id,
          firstName: current.firstName || meta.first_name || '',
          lastName: current.lastName || meta.last_name || '',
          phone: current.phone || meta.phone || '',
          email: user.email || current.email || ''
        };
        if (typeof saveState === 'function') saveState();
      }
    } catch (error) {
      console.warn('EDM session hydration unavailable', error);
    }
    return true;
  }

  async function syncSession(activePage) {
    if (sessionSync) return sessionSync;
    sessionSync = (async () => {
      try {
        if (knownSessionUser) {
          await hydrateSessionUser(knownSessionUser);
        } else if (typeof supabaseClient !== 'undefined') {
          const result = await Promise.race([
            supabaseClient.auth.getSession(),
            new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 2500))
          ]);
          const user = result?.data?.session?.user || null;
          if (user) await hydrateSessionUser(user);
        }
      } catch (error) {
        console.warn('EDM session check unavailable', error);
      } finally {
        sessionSync = null;
      }
      if (activePage && document.getElementById(activePage)?.classList.contains('active')) renderPage(activePage);
    })();
    return sessionSync;
  }

  function navigate(id) {
    activate(id);
    if (privatePages.has(id)) void syncSession(id);
  }

  function installAuthListener() {
    try {
      if (typeof supabaseClient === 'undefined') return;
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        knownSessionUser = session?.user || null;
        if (knownSessionUser) void hydrateSessionUser(knownSessionUser);
        const activePrivate = [...privatePages].find((id) => document.getElementById(id)?.classList.contains('active'));
        if (activePrivate) setTimeout(() => renderPage(activePrivate), 0);
      });
      void syncSession();
    } catch (error) {
      console.warn('EDM auth listener unavailable', error);
    }
  }

  function install() {
    revealNavigation();
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-page]');
      const id = button?.dataset?.page;
      if (!id || !allPages.has(id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(id);
    }, true);

    new MutationObserver(revealNavigation).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'aria-hidden']
    });

    installAuthListener();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', revealNavigation);
})();
