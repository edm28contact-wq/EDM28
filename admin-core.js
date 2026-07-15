(() => {
  const client = window.supabase.createClient(
    'https://ojjbnwpkfvzjfukgqddz.supabase.co',
    'sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX'
  );
  const app = window.EDMAdmin = {
    db: client,
    profile: null,
    clients: [],
    services: [],
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
      node.textContent = message;
      node.className = `status ${error ? 'error' : 'ok'}`;
    },
    page(id) {
      document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node.id === id));
      document.querySelectorAll('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === id));
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
    async overview() {
      const values = await Promise.all(['profiles','service_requests','quotes','invoices','appointments','ai_drafts'].map((name) => this.count(name)));
      ['kpiClients','kpiRequests','kpiQuotes','kpiInvoices','kpiAppointments','kpiAi'].forEach((id, index) => { this.$(id).textContent = values[index]; });
      const checks = [];
      const { data: noVehicle } = await client.from('service_requests').select('id').is('vehicle_id', null);
      if (noVehicle?.length) checks.push(`${noVehicle.length} demande(s) sans véhicule`);
      const { data: noPdf } = await client.from('quotes').select('id').in('status', ['sent','accepted']).is('pdf_path', null);
      if (noPdf?.length) checks.push(`${noPdf.length} devis publié(s) sans PDF`);
      const { data: business } = await client.from('business_configuration').select('*').eq('id', true).single();
      const required = ['business_name','legal_name','siret','siren','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text','logo_url','calendar_id','timezone'];
      const missing = required.filter((key) => !String(business?.[key] || '').trim());
      if (missing.length) checks.push(`${missing.length} information(s) entreprise obligatoire(s) manquante(s)`);
      this.$('anomalies').innerHTML = checks.length ? `<ul>${checks.map((x) => `<li>${this.esc(x)}</li>`).join('')}</ul>` : '<div class="status ok">Aucune anomalie principale détectée.</div>';
    },
    async open() {
      this.$('loginPanel').classList.add('hidden');
      this.$('dashboard').classList.remove('hidden');
      await Promise.allSettled([
        this.overview(),
        window.EDMAdminClients?.load(),
        window.EDMAdminServices?.load(),
        window.EDMAdminDocs?.load(),
        window.EDMAdminBusiness?.load(),
        window.EDMAdminSettings?.load()
      ]);
    }
  };

  async function login() {
    app.status('loginStatus', 'Connexion…');
    const { data, error } = await client.auth.signInWithPassword({
      email: app.$('adminEmail').value.trim(),
      password: app.$('adminPassword').value
    });
    if (error) return app.status('loginStatus', error.message, true);
    try {
      await app.requireAdmin(data.user);
      await app.open();
    } catch (errorAdmin) {
      await client.auth.signOut();
      app.status('loginStatus', errorAdmin.message, true);
    }
  }

  async function boot() {
    document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => app.page(button.dataset.page)));
    app.$('loginBtn').addEventListener('click', login);
    app.$('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      try { await app.requireAdmin(data.session.user); await app.open(); }
      catch (error) { app.status('loginStatus', error.message, true); }
    }
  }
  window.addEventListener('DOMContentLoaded', () => boot().catch((error) => app.status('loginStatus', error.message, true)));
})();
