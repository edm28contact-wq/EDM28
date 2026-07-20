(() => {
  if (window.__edmSafeAccountPage) return;
  window.__edmSafeAccountPage = true;

  const getState = () => (typeof state !== 'undefined' && state ? state : null);
  const escapeValue = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function activatePage(pageId) {
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === pageId);
    });
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === pageId);
    });
    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function redirectToLogin() {
    activatePage('appointment');
    setTimeout(() => {
      document.getElementById('email')?.focus();
      if (typeof toast === 'function') toast('Connectez-vous pour acceder a votre compte.');
    }, 0);
  }

  function renderConnectedAccount(user) {
    const host = document.getElementById('accountPageContent');
    if (!host) return;
    host.innerHTML = `
      <div class="grid">
        <div class="card">
          <h3>Informations du compte</h3>
          <div class="summary" style="margin-top:14px">
            <div class="summary-line"><span>Nom</span><strong>${escapeValue(user.lastName || '-')}</strong></div>
            <div class="summary-line"><span>Prenom</span><strong>${escapeValue(user.firstName || '-')}</strong></div>
            <div class="summary-line"><span>Telephone</span><strong>${escapeValue(user.phone || '-')}</strong></div>
            <div class="summary-line"><span>Email</span><strong>${escapeValue(user.email || '-')}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Actions sur le compte</h3>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn btn-secondary" id="safeAccountSignOut" type="button">Se deconnecter</button>
          </div>
          <div id="safeAccountStatus" style="margin-top:12px"></div>
        </div>
      </div>`;

    document.getElementById('safeAccountSignOut')?.addEventListener('click', async () => {
      const status = document.getElementById('safeAccountStatus');
      try {
        if (typeof supabaseClient !== 'undefined') {
          const result = await supabaseClient.auth.signOut();
          if (result?.error) throw result.error;
        }
        const current = getState();
        if (current) current.user = null;
        if (typeof saveState === 'function') saveState();
        activatePage('home');
      } catch (error) {
        if (status) status.textContent = error?.message || 'Deconnexion impossible.';
      }
    });
  }

  function openAccount() {
    const user = getState()?.user;
    if (!user?.id) {
      redirectToLogin();
      return;
    }
    activatePage('account');
    renderConnectedAccount(user);
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-page="account"]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    trigger.blur();
    openAccount();
  }, true);

  window.renderSafeAccount = openAccount;
})();
