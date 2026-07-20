(() => {
  if (window.__edmSafeAccountPage) return;
  window.__edmSafeAccountPage = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const appState = () => (typeof state !== 'undefined' && state ? state : null);

  function showAccountShell() {
    const page = document.getElementById('account');
    const host = document.getElementById('accountPageContent');
    if (!page || !host) return null;

    document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node === page));
    document.querySelectorAll('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === 'account'));
    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return host;
  }

  function redirectToLogin() {
    if (typeof showPage === 'function') showPage('appointment');
    else {
      document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node.id === 'appointment'));
      document.getElementById('sidebar')?.classList.remove('open');
    }
    setTimeout(() => {
      document.getElementById('email')?.focus();
      if (typeof toast === 'function') toast('Connectez-vous pour accéder à votre compte.');
    }, 0);
  }

  function renderProfile(host, { firstName = '', lastName = '', phone = '', email = '' }) {
    host.innerHTML = `<div class="grid"><div class="card"><h3>Informations du compte</h3><div class="summary" style="margin-top:14px"><div class="summary-line"><span>Nom</span><strong>${esc(lastName || '-')}</strong></div><div class="summary-line"><span>Prénom</span><strong>${esc(firstName || '-')}</strong></div><div class="summary-line"><span>Téléphone</span><strong>${esc(phone || '-')}</strong></div><div class="summary-line"><span>Email</span><strong>${esc(email || '-')}</strong></div></div></div><div class="card"><h3>Actions sur le compte</h3><div class="btn-row" style="margin-top:14px"><button class="btn btn-secondary" id="safeAccountSignOut" type="button">Se déconnecter</button></div><div id="safeAccountStatus" style="margin-top:12px"></div></div></div>`;

    document.getElementById('safeAccountSignOut')?.addEventListener('click', async () => {
      const status = document.getElementById('safeAccountStatus');
      try {
        if (typeof supabaseClient === 'undefined') throw new Error('Service de connexion indisponible.');
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        const current = appState();
        if (current) {
          current.user = null;
          if (typeof saveState === 'function') saveState();
        }
        if (typeof showPage === 'function') showPage('home');
      } catch (error) {
        if (status) status.innerHTML = `<div class="errorbox">${esc(error.message || 'Déconnexion impossible.')}</div>`;
      }
    });
  }

  async function renderSafeAccount() {
    const current = appState()?.user || null;
    if (!current?.id) {
      redirectToLogin();
      return;
    }

    const host = showAccountShell();
    if (!host) return;
    renderProfile(host, current);

    if (typeof supabaseClient === 'undefined') return;
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      const user = data?.session?.user;
      if (!user) {
        const stateRef = appState();
        if (stateRef) stateRef.user = null;
        redirectToLogin();
        return;
      }

      const result = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const profile = result.error ? null : result.data;
      const latest = appState()?.user || {};
      renderProfile(host, {
        firstName: profile?.first_name || user.user_metadata?.first_name || latest.firstName || '',
        lastName: profile?.last_name || user.user_metadata?.last_name || latest.lastName || '',
        phone: profile?.phone || user.user_metadata?.phone || latest.phone || '',
        email: user.email || latest.email || ''
      });
    } catch (error) {
      console.warn('EDM account refresh unavailable:', error.message || error);
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-page="account"]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    trigger.blur();
    renderSafeAccount();
  }, true);

  window.renderSafeAccount = renderSafeAccount;
})();
