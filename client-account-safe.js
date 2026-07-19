(() => {
  if (window.__edmSafeAccountPage) return;
  window.__edmSafeAccountPage = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const appState = () => (typeof state !== 'undefined' && state ? state : null);

  async function renderSafeAccount() {
    const page = document.getElementById('account');
    const host = document.getElementById('accountPageContent');
    if (!page || !host) return;

    document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node === page));
    document.querySelectorAll('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === 'account'));
    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      if (typeof supabaseClient === 'undefined') {
        host.innerHTML = '<div class="notice">Chargement du compte...</div>';
        setTimeout(renderSafeAccount, 150);
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      const user = data?.session?.user;
      if (!user) {
        host.innerHTML = '<div class="empty">Connectez-vous pour consulter votre compte client.</div>';
        return;
      }

      let profile = null;
      const result = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!result.error) profile = result.data;

      const current = appState()?.user || {};
      const firstName = profile?.first_name || user.user_metadata?.first_name || current.firstName || '';
      const lastName = profile?.last_name || user.user_metadata?.last_name || current.lastName || '';
      const phone = profile?.phone || user.user_metadata?.phone || current.phone || '';
      const email = user.email || current.email || '';

      host.innerHTML = `<div class="grid"><div class="card"><h3>Informations du compte</h3><div class="summary" style="margin-top:14px"><div class="summary-line"><span>Nom</span><strong>${esc(lastName || '-')}</strong></div><div class="summary-line"><span>Prénom</span><strong>${esc(firstName || '-')}</strong></div><div class="summary-line"><span>Téléphone</span><strong>${esc(phone || '-')}</strong></div><div class="summary-line"><span>Email</span><strong>${esc(email || '-')}</strong></div></div></div><div class="card"><h3>Actions sur le compte</h3><div class="btn-row" style="margin-top:14px"><button class="btn btn-secondary" id="safeAccountSignOut" type="button">Se déconnecter</button></div><div id="safeAccountStatus" style="margin-top:12px"></div></div></div>`;

      document.getElementById('safeAccountSignOut')?.addEventListener('click', async () => {
        const status = document.getElementById('safeAccountStatus');
        try {
          const { error: signOutError } = await supabaseClient.auth.signOut();
          if (signOutError) throw signOutError;
          const currentState = appState();
          if (currentState) {
            currentState.user = null;
            if (typeof saveState === 'function') saveState();
          }
          if (status) status.innerHTML = '<div class="okbox">Déconnecté.</div>';
          if (typeof showPage === 'function') showPage('home');
        } catch (signOutError) {
          if (status) status.innerHTML = `<div class="errorbox">${esc(signOutError.message || 'Déconnexion impossible.')}</div>`;
        }
      });
    } catch (error) {
      host.innerHTML = `<div class="errorbox"><strong>Compte indisponible.</strong><br>${esc(error.message || 'Réessayez plus tard.')}</div>`;
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-page="account"]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderSafeAccount();
  }, true);

  window.renderSafeAccount = renderSafeAccount;
})();