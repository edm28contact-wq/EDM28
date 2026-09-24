(() => {
  if (window.__edmMenuRouterV7) return;
  window.__edmMenuRouterV7 = true;
  window.__edmConnectedRouter = true;

  const allPages = new Set(['home', 'appointment', 'account', 'request-status', 'history', 'disbursements', 'about']);
  const privatePages = new Set(['request-status', 'history', 'disbursements']);

  let sessionUser = null;
  let sessionKnown = false;
  let sessionRequest = null;

  function getStateUser() {
    try {
      return typeof state !== 'undefined' ? state?.user || null : null;
    } catch (_) {
      return null;
    }
  }

  function hasKnownUser() {
    return Boolean(sessionUser?.id || getStateUser()?.id);
  }

  function revealNavigation() {
    privatePages.forEach((id) => {
      document.querySelectorAll(`[data-page="${id}"]`).forEach((button) => {
        if (button.classList.contains('hidden')) button.classList.remove('hidden');
        if (button.hasAttribute('aria-hidden')) button.removeAttribute('aria-hidden');
        if (button.disabled) button.disabled = false;
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
    const hostId = id === 'account'
      ? 'accountPageContent'
      : id === 'request-status'
        ? 'requestStatusList'
        : 'historyList';
    const host = document.getElementById(hostId);
    if (host && !host.textContent.trim()) {
      host.innerHTML = '<div class="notice">La page est ouverte. Les informations du compte sont en cours de chargement.</div>';
    }
  }

  function renderGuestPage(id) {
    const page = document.getElementById(id);
    if (!page) return;
    let guest = page.querySelector('[data-guest-page]');
    if (!guest) {
      guest = document.createElement('div');
      guest.dataset.guestPage = 'true';
      guest.className = 'panel';
      page.prepend(guest);
    }
    const labels = {
      'request-status': ['Suivi de mes demandes', 'Connectez-vous pour afficher l’avancement de vos dossiers.'],
      history: ['Mes interventions', 'Connectez-vous pour retrouver vos véhicules, interventions et documents personnels.'],
      disbursements: ['Pièces et débours', 'Connectez-vous pour consulter les pièces préparées pour vos dossiers et les actions de paiement.']
    };
    const details = labels[id] || ['Espace personnel', 'Connectez-vous pour afficher vos informations personnelles.'];
    guest.innerHTML = '<div class="section-title"><div><h2>' + details[0] + '</h2><p class="lead">' + details[1] + '</p></div></div><div class="btn-row"><button class="btn btn-primary" type="button" data-page="account">Se connecter / créer un compte</button><button class="btn btn-secondary" type="button" data-page="home">Continuer à visiter le site</button></div>';
  }

  function clearGuestPage(id) {
    document.getElementById(id)?.querySelector('[data-guest-page]')?.remove();
  }

  function renderPage(id) {
    if (privatePages.has(id) && !hasKnownUser()) {
      renderGuestPage(id);
      return;
    }
    clearGuestPage(id);
    try {
      if (id === 'account' && typeof renderAccountPage === 'function') renderAccountPage();
      if (id === 'history' && typeof renderGarage === 'function') renderGarage();
      if (id === 'history' && typeof renderHistory === 'function') renderHistory();
    } catch (error) {
      showFallback(id, error);
    }

    if (id === 'request-status' && typeof window.renderRequestStatus === 'function') {
      void window.renderRequestStatus().catch((error) => showFallback(id, error));
    }
    if (id === 'history' && typeof window.renderRequestHistory === 'function') {
      void window.renderRequestHistory().catch((error) => console.warn('EDM request history unavailable', error));
    }
    if (id === 'history' && typeof window.renderCompletedInterventionHistory === 'function') {
      void window.renderCompletedInterventionHistory().catch((error) => console.warn('EDM intervention archive unavailable', error));
    }
  }

  function activate(id) {
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === id);
    });
    document.querySelectorAll('[data-page]').forEach((button) => {
      const active = button.dataset.page === id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    closeMenu();
    renderPage(id);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (_) {}
  }

  async function hydrateSessionUser(user) {
    if (!user?.id) return false;
    sessionUser = user;

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

  function clearStaleLocalUser() {
    try {
      if (typeof state === 'undefined' || !state?.user) return;
      state.user = null;
      if (typeof saveState === 'function') saveState();
    } catch (error) {
      console.warn('EDM local session cleanup unavailable', error);
    }
  }

  async function resolveSession() {
    if (sessionUser?.id) return hydrateSessionUser(sessionUser);
    if (sessionKnown) return false;
    if (sessionRequest) return sessionRequest;

    sessionRequest = (async () => {
      try {
        if (typeof supabaseClient === 'undefined') return hasKnownUser();

        const result = await Promise.race([
          supabaseClient.auth.getSession(),
          new Promise((resolve) => setTimeout(() => resolve({ data: { session: null }, timedOut: true }), 2500))
        ]);

        if (result?.timedOut) return hasKnownUser();

        sessionKnown = true;
        sessionUser = result?.data?.session?.user || null;

        if (sessionUser) return hydrateSessionUser(sessionUser);

        clearStaleLocalUser();
        return false;
      } catch (error) {
        console.warn('EDM session check unavailable', error);
        return hasKnownUser();
      } finally {
        sessionRequest = null;
      }
    })();

    return sessionRequest;
  }

  async function navigate(id) {
    activate(id);
    if (!privatePages.has(id)) return;

    if (hasKnownUser()) {
      const authenticated = await resolveSession();
      if (authenticated && document.getElementById(id)?.classList.contains('active')) renderPage(id);
      if (!authenticated && document.getElementById(id)?.classList.contains('active')) renderGuestPage(id);
      return;
    }

    const authenticated = await resolveSession();
    if (authenticated && document.getElementById(id)?.classList.contains('active')) renderPage(id);
    else if (document.getElementById(id)?.classList.contains('active')) renderGuestPage(id);
  }

  function installAuthListener() {
    try {
      if (typeof supabaseClient === 'undefined') return;

      supabaseClient.auth.onAuthStateChange((_event, session) => {
        sessionKnown = true;
        sessionUser = session?.user || null;

        if (sessionUser) {
          void hydrateSessionUser(sessionUser).then(() => {
            const activePrivate = [...privatePages].find((id) => document.getElementById(id)?.classList.contains('active'));
            if (activePrivate) renderPage(activePrivate);
          });
        } else {
          clearStaleLocalUser();
          const activePrivate = [...privatePages].find((id) => document.getElementById(id)?.classList.contains('active'));
          if (activePrivate) renderGuestPage(activePrivate);
        }

        revealNavigation();
      });

      void resolveSession();
    } catch (error) {
      console.warn('EDM auth listener unavailable', error);
    }
  }

  function install() {
    revealNavigation();

    document.addEventListener('click', (event) => {
      const routeButton = event.target.closest?.('[data-page], [data-jump]');
      const id = routeButton?.dataset?.page || routeButton?.dataset?.jump;
      if (!id || !allPages.has(id)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void navigate(id);
    }, true);

    installAuthListener();
  }

  window.__edmNavigate = navigate;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.addEventListener('pageshow', () => {
    revealNavigation();
    void resolveSession();
  });
})();
