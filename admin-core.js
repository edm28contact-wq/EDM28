(() => {
  const client = window.supabase.createClient(
    'https://ojjbnwpkfvzjfukgqddz.supabase.co',
    'sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX'
  );
  const MIN_PASSWORD_LENGTH = 8;
  const MAX_PASSWORD_LENGTH = 72;
  const app = window.EDMAdmin = {
    db: client,
    profile: null,
    clients: [],
    services: [],
    backofficeConfiguration: null,
    $: (id) => document.getElementById(id),
    esc: (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),
    money: (value) => Number(value || 0).toLocaleString('fr-FR', {style:'currency',currency:'EUR'}),
    markRequired(node, invalid) {
      if (!node) return;
      node.classList.toggle('required-missing', Boolean(invalid));
      node.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    },
    status(id, message, error = false) {
      const node = this.$(id);
      if (!node) return;
      node.textContent = message;
      node.className = `status ${error ? 'error' : 'ok'}`;
    },
    page(id) {
      const button = document.querySelector(`[data-page="${id}"]`);
      if (button?.hidden) return this.status('managementStatus', 'Ce module est désactivé dans Gestion du back-office.', true);
      document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node.id === id));
      document.querySelectorAll('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === id));
      if (id === 'requests') window.EDMAdminRequests?.load().catch((error) => this.status('requestStatus', error.message || 'Demandes indisponibles.', true));
      if (id === 'messages') window.EDMAdminMessages?.load().catch((error) => this.status('adminMessageStatus', error.message || 'Messagerie indisponible.', true));
      if (id === 'accounting') window.EDMAdminAccounting?.load().catch((error) => this.status('accountingStatus', error.message || 'Factures indisponibles.', true));
      if (id === 'management') window.EDMAdminManagement?.load().catch((error) => this.status('managementStatus', error.message || 'Gestion indisponible.', true));
      if (id === 'parts') window.EDMAdminParts?.load().catch((error) => this.status('partsStatus', error.message || 'Pièces indisponibles.', true));
      if (id === 'purchases') window.EDMAdminPurchases?.load().catch((error) => this.status('purchasesStatus', error.message || 'Achats indisponibles.', true));
      if (id === 'micro-accounting') window.EDMAdminMicroAccounting?.load().catch((error) => this.status('microAccountingStatus', error.message || 'Comptabilité indisponible.', true));
    },
    async requireAdmin(user) {
      const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      if (data.role !== 'admin') throw new Error('Ce compte ne possède pas le rôle administrateur.');
      this.profile = data;
      this.$('adminIdentity').textContent = `${data.first_name || ''} ${data.last_name || ''}`.trim() || user.email;
    },
    async count(table) {
      const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async loadBackofficeConfiguration() {
      const { data, error } = await client.from('backoffice_configuration').select('*').eq('id', true).single();
      if (error) throw error;
      this.backofficeConfiguration = data;
      this.applyModuleVisibility(data?.enabled_modules || {});
      return data;
    },
    applyModuleVisibility(modules) {
      const pageMap = {
        quotes: ['quotes'],
        agenda: [],
        workshop: ['operations','finalization'],
        parts: ['parts'],
        suppliers: ['purchases'],
        purchases: ['purchases'],
        invoices: ['invoice-actions','accounting'],
        payments: ['invoice-actions','accounting'],
        micro_accounting: ['micro-accounting'],
        messaging: ['messages'],
        automations: ['settings'],
        ai_assistant: [],
        documents: ['documents','document-pdf']
      };
      const pageStates = {};
      Object.entries(pageMap).forEach(([module, pages]) => {
        const enabled = modules[module] !== false;
        pages.forEach((pageId) => { pageStates[pageId] = (pageStates[pageId] ?? false) || enabled; });
      });
      Object.entries(pageStates).forEach(([pageId,enabled]) => {
        document.querySelectorAll(`[data-page="${pageId}"]`).forEach((node) => { node.hidden = !enabled; });
        const page = this.$(pageId);
        if (page) page.dataset.moduleEnabled = enabled ? 'true' : 'false';
      });
    },
    async overview(extraChecks = []) {
      const values = await Promise.all(['profiles','service_requests','quotes','invoices','appointments','ai_drafts'].map((name) => this.count(name)));
      ['kpiClients','kpiRequests','kpiQuotes','kpiInvoices','kpiAppointments','kpiAi'].forEach((id, index) => { this.$(id).textContent = values[index]; });
      const checks = [...extraChecks];
      const { data: noVehicle } = await client.from('service_requests').select('id').is('vehicle_id', null);
      if (noVehicle?.length) checks.push(`${noVehicle.length} demande(s) sans véhicule`);
      const { data: noPdf } = await client.from('quotes').select('id').in('status', ['sent','accepted']).is('pdf_path', null);
      if (noPdf?.length) checks.push(`${noPdf.length} devis publié(s) sans PDF`);
      const { data: business } = await client.from('business_configuration').select('*').eq('id', true).single();
      const required = ['business_name','legal_name','siret','siren','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text','logo_url','calendar_id','timezone'];
      const missing = required.filter((key) => !String(business?.[key] || '').trim());
      if (missing.length) checks.push(`${missing.length} information(s) entreprise obligatoire(s) manquante(s)`);
      const configuration = this.backofficeConfiguration;
      const requiredManagement = ['declared_activity_label','activity_kind','vat_mode','urssaf_frequency','stock_mode'];
      const missingManagement = requiredManagement.filter((key) => !String(configuration?.[key] || '').trim());
      if (missingManagement.length) checks.push(`${missingManagement.length} réglage(s) obligatoire(s) manquant(s) dans Gestion`);
      if (configuration?.enabled_modules?.micro_accounting !== false) {
        const { data: parameters } = await client.from('accounting_parameters').select('*').eq('id',true).single();
        const requiredRates = ['social_rate_services','social_rate_sales'];
        const missingRates = requiredRates.filter((key) => parameters?.[key] === null || parameters?.[key] === undefined);
        if (missingRates.length) checks.push(`${missingRates.length} taux comptable(s) à renseigner dans Comptabilité micro`);
      }
      this.$('anomalies').innerHTML = checks.length ? `<ul>${checks.map((x) => `<li>${this.esc(x)}</li>`).join('')}</ul>` : '<div class="status ok">Aucune anomalie principale détectée.</div>';
    },
    async open() {
      this.$('loginPanel').classList.add('hidden');
      this.$('dashboard').classList.remove('hidden');
      const modules = [
        ['Demandes', () => window.EDMAdminRequests?.load()],
        ['Clients', () => window.EDMAdminClients?.load()],
        ['Messagerie', () => window.EDMAdminMessages?.load()],
        ['Services', () => window.EDMAdminServices?.load()],
        ['Documents', () => window.EDMAdminDocs?.load()],
        ['Gestion', () => window.EDMAdminManagement?.load()],
        ['Factures', () => window.EDMAdminAccounting?.load()],
        ['Entreprise', () => window.EDMAdminBusiness?.load()],
        ['Automatisations', () => window.EDMAdminSettings?.load()]
      ];
      const settled = await Promise.allSettled([this.loadBackofficeConfiguration(), ...modules.map(([, load]) => load())]);
      const failures = settled.flatMap((result, index) => {
        if (result.status !== 'rejected') return [];
        const label = index === 0 ? 'Configuration' : modules[index - 1][0];
        return [`Module ${label} indisponible : ${result.reason?.message || 'erreur inconnue'}`];
      });
      try { await this.overview(failures); }
      catch (error) { this.$('anomalies').innerHTML = `<div class="status error">${this.esc(error.message || 'Vue générale indisponible.')}</div>`; }
    }
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const normalizeCode = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

  function friendly(error) {
    const message = String(error?.message || error || '');
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (lower.includes('email not confirmed')) return 'Cette adresse email doit être confirmée.';
    if (lower.includes('rate limit') || lower.includes('security purposes')) return 'Trop de tentatives. Attendez une minute avant de recommencer.';
    if (lower.includes('expired') || lower.includes('invalid token')) return 'Code incorrect ou expiré. Demandez un nouveau code.';
    if (lower.includes('password should be') || lower.includes('weak password')) return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    return message || 'Une erreur est survenue.';
  }

  function installPasswordUi() {
    const loginButton = app.$('loginBtn');
    const password = app.$('adminPassword');
    if (!loginButton || !password || app.$('adminPasswordReset')) return;
    password.minLength = MIN_PASSWORD_LENGTH;
    password.maxLength = MAX_PASSWORD_LENGTH;
    password.placeholder = `${MIN_PASSWORD_LENGTH} caractères minimum`;
    loginButton.textContent = 'Se connecter';
    loginButton.insertAdjacentHTML('afterend', `
      <button id="adminPasswordReset" class="btn ghost" type="button" style="margin-top:10px;width:100%">Définir ou réinitialiser le mot de passe</button>
      <p class="muted" style="margin-top:10px">Les comptes administrateurs sont créés uniquement par EDM28. Le code email sert seulement à définir ou récupérer le mot de passe.</p>
      <div id="adminRecoveryCodePanel" class="hidden" style="margin-top:14px">
        <label>Code reçu par email<input id="adminRecoveryCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
        <button id="adminRecoveryVerify" class="btn primary" type="button" style="margin-top:10px;width:100%">Valider le code</button>
      </div>
      <div id="adminNewPasswordPanel" class="hidden" style="margin-top:14px">
        <label>Nouveau mot de passe<input id="adminNewPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" autocomplete="new-password"></label>
        <label style="margin-top:10px">Confirmer le mot de passe<input id="adminNewPasswordConfirm" type="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" autocomplete="new-password"></label>
        <button id="adminPasswordSave" class="btn primary" type="button" style="margin-top:10px;width:100%">Enregistrer le mot de passe</button>
      </div>`);
  }

  async function signInWithPassword() {
    const email = normalizeEmail(app.$('adminEmail')?.value);
    const password = app.$('adminPassword')?.value || '';
    if (!email || !password) return app.status('loginStatus', 'Email et mot de passe obligatoires.', true);
    app.status('loginStatus', 'Connexion…');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return app.status('loginStatus', friendly(error), true);
    try {
      await app.requireAdmin(data.user || data.session?.user);
      await app.open();
    } catch (adminError) {
      await client.auth.signOut();
      app.status('loginStatus', friendly(adminError), true);
    }
  }

  async function sendPasswordSetupCode() {
    const email = normalizeEmail(app.$('adminEmail')?.value);
    if (!email) return app.status('loginStatus', 'Adresse email obligatoire.', true);
    app.status('loginStatus', 'Envoi du code de sécurité…');
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return app.status('loginStatus', friendly(error), true);
    app.$('adminRecoveryCodePanel').classList.remove('hidden');
    app.$('adminNewPasswordPanel').classList.add('hidden');
    app.$('adminRecoveryCode').focus();
    app.status('loginStatus', 'Code envoyé. Saisissez-le pour définir un nouveau mot de passe.');
  }

  async function verifyPasswordSetupCode() {
    const email = normalizeEmail(app.$('adminEmail')?.value);
    const token = normalizeCode(app.$('adminRecoveryCode')?.value);
    if (!email || token.length < 6) return app.status('loginStatus', 'Entrez le code reçu par email.', true);
    app.status('loginStatus', 'Vérification…');
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return app.status('loginStatus', friendly(error), true);
    try {
      await app.requireAdmin(data.user);
      app.$('adminRecoveryCodePanel').classList.add('hidden');
      app.$('adminNewPasswordPanel').classList.remove('hidden');
      app.$('adminNewPassword').focus();
      app.status('loginStatus', 'Compte administrateur vérifié. Choisissez maintenant votre mot de passe.');
    } catch (adminError) {
      await client.auth.signOut();
      app.status('loginStatus', friendly(adminError), true);
    }
  }

  async function saveNewPassword() {
    const password = app.$('adminNewPassword')?.value || '';
    const confirmation = app.$('adminNewPasswordConfirm')?.value || '';
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return app.status('loginStatus', `Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`, true);
    }
    if (password !== confirmation) return app.status('loginStatus', 'Les deux mots de passe ne correspondent pas.', true);
    app.status('loginStatus', 'Enregistrement du mot de passe…');
    const { error } = await client.auth.updateUser({ password });
    if (error) return app.status('loginStatus', friendly(error), true);
    await client.auth.signOut();
    app.$('adminNewPasswordPanel').classList.add('hidden');
    app.$('adminPassword').value = '';
    app.$('adminNewPassword').value = '';
    app.$('adminNewPasswordConfirm').value = '';
    app.status('loginStatus', 'Mot de passe enregistré. Connectez-vous avec votre email et ce mot de passe.');
    app.$('adminPassword').focus();
  }

  async function boot() {
    installPasswordUi();
    document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => app.page(button.dataset.page)));
    app.$('requestRefresh')?.addEventListener('click', () => window.EDMAdminRequests?.load().catch((error) => app.status('requestStatus', error.message || 'Actualisation impossible.', true)));
    app.$('loginBtn').addEventListener('click', signInWithPassword);
    app.$('adminPasswordReset').addEventListener('click', sendPasswordSetupCode);
    app.$('adminRecoveryVerify').addEventListener('click', verifyPasswordSetupCode);
    app.$('adminPasswordSave').addEventListener('click', saveNewPassword);
    app.$('adminPassword').addEventListener('keydown', (event) => { if (event.key === 'Enter') signInWithPassword(); });
    app.$('adminRecoveryCode').addEventListener('input', (event) => { event.target.value = normalizeCode(event.target.value); });
    app.$('adminRecoveryCode').addEventListener('keydown', (event) => { if (event.key === 'Enter') verifyPasswordSetupCode(); });
    app.$('adminNewPasswordConfirm').addEventListener('keydown', (event) => { if (event.key === 'Enter') saveNewPassword(); });
    app.$('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      try { await app.requireAdmin(data.session.user); await app.open(); }
      catch (error) { await client.auth.signOut(); app.status('loginStatus', friendly(error), true); }
    }
  }
  window.addEventListener('DOMContentLoaded', () => boot().catch((error) => app.status('loginStatus', friendly(error), true)));
})();
