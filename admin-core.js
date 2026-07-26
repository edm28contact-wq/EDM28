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
      if (!node) return;
      node.textContent = message;
      node.className = `status ${error ? 'error' : 'ok'}`;
    },
    page(id) {
      document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node.id === id));
      document.querySelectorAll('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === id));
      const loaders = {
        overview: () => this.overview(),
        requests: () => window.EDMAdminRequests?.load(),
        quotes: () => window.EDMAdminQuotes?.load(),
        operations: () => window.EDMAdminOperations?.load(),
        interventions: () => window.EDMAdminInterventions?.load(),
        finalization: () => window.EDMAdminFinalization?.load(),
        'invoice-actions': () => window.EDMAdminInvoiceActions?.load(),
        clients: () => window.EDMAdminClients?.load(),
        messages: () => window.EDMAdminMessages?.load(),
        accounting: () => window.EDMAdminAccounting?.load(),
        'document-pdf': () => window.EDMAdminDocumentPdf?.load(),
        'audit-log': () => window.EDMAdminAuditLog?.load()
      };
      Promise.resolve(loaders[id]?.()).catch((error) => {
        const target = id === 'overview' ? 'anomalies' : id === 'requests' ? 'requestStatus' : id === 'quotes' ? 'quoteStatus' : id === 'clients' ? 'clientDetail' : 'anomalies';
        if (target === 'anomalies') this.$(target).innerHTML = `<div class="status error">${this.esc(error.message || 'Module indisponible.')}</div>`;
        else this.status(target, error.message || 'Module indisponible.', true);
      });
    },
    async count(table, configure) {
      let query = client.from(table).select('*', { count: 'exact', head: true });
      if (configure) query = configure(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    ensureOverviewUi() {
      const overview = this.$('overview');
      if (!overview) return;
      if (!this.$('overviewOperationalKpis')) {
        const grid = document.createElement('div');
        grid.id = 'overviewOperationalKpis';
        grid.className = 'grid';
        grid.style.marginTop = '14px';
        overview.querySelector('.grid')?.insertAdjacentElement('afterend', grid);
      }
      const anomalyCard = this.$('anomalies')?.closest('.card');
      if (anomalyCard && !this.$('overviewRefresh')) {
        const heading = anomalyCard.querySelector('h2');
        const top = document.createElement('div');
        top.className = 'top';
        heading.replaceWith(top);
        top.innerHTML = '<div><h2>Alertes et contrôles</h2><p class="muted">Priorités calculées automatiquement à partir des dossiers.</p></div><button id="overviewRefresh" class="btn ghost" type="button">Actualiser</button>';
        this.$('overviewRefresh').onclick = () => this.overview().catch((error) => { this.$('anomalies').innerHTML = `<div class="status error">${this.esc(error.message)}</div>`; });
      }
    },
    async overview(extraChecks = []) {
      this.ensureOverviewUi();
      const anomalyHost = this.$('anomalies');
      if (anomalyHost) anomalyHost.innerHTML = '<p class="muted">Analyse des dossiers…</p>';
      const now = new Date();
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const afterTomorrow = new Date(today); afterTomorrow.setDate(afterTomorrow.getDate() + 2);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      const [clientCount, requestCount, quoteCount, invoiceCount, appointmentCount, aiCount] = await Promise.all([
        this.count('profiles', (q) => q.eq('role', 'customer')),
        this.count('service_requests'), this.count('quotes'), this.count('invoices'), this.count('appointments'), this.count('ai_drafts')
      ]);
      [clientCount, requestCount, quoteCount, invoiceCount, appointmentCount, aiCount].forEach((value, index) => {
        const id = ['kpiClients','kpiRequests','kpiQuotes','kpiInvoices','kpiAppointments','kpiAi'][index];
        if (this.$(id)) this.$(id).textContent = value;
      });

      const results = await Promise.all([
        client.from('profiles').select('id,first_name,last_name,email,phone').eq('role', 'customer'),
        client.from('vehicles').select('id,user_id,plate,brand,model,mileage'),
        client.from('service_requests').select('id,status,vehicle_id,created_at,updated_at'),
        client.from('quotes').select('id,status,quote_number,total,valid_until,pdf_path,created_at,updated_at'),
        client.from('appointments').select('id,status,starts_at,user_id,vehicle_id').gte('starts_at', today.toISOString()).lt('starts_at', afterTomorrow.toISOString()),
        client.from('repair_orders').select('id,status,order_number,quote_id,appointment_id,pdf_path,created_at,updated_at'),
        client.from('inspection_reports').select('id,repair_order_id,status,pdf_path,visible_to_client,created_at,updated_at'),
        client.from('invoices').select('id,status,invoice_number,total,amount_paid,due_at,pdf_path,visible_to_client,repair_order_id,created_at,updated_at'),
        client.from('client_messages').select('id,user_id').eq('direction', 'inbound').eq('read_by_admin', false),
        client.from('business_configuration').select('*').eq('id', true).single()
      ]);
      const queryNames = ['Clients','Véhicules','Demandes','Devis','Rendez-vous','Ordres','Contrôles','Factures','Messages','Entreprise'];
      const queryErrors = results.flatMap((result, index) => result.error ? [`${queryNames[index]} : ${result.error.message}`] : []);
      const [profiles, vehicles, requests, quotes, appointments, orders, inspections, invoices, unreadMessages, business] = results.map((result) => result.data || (Array.isArray(result.data) ? [] : {}));
      const alerts = extraChecks.map((detail) => ({ severity: 'error', title: 'Module indisponible', detail, page: 'overview' }));
      queryErrors.forEach((detail) => alerts.push({ severity: 'error', title: 'Contrôle incomplet', detail, page: 'overview' }));
      const push = (condition, severity, title, detail, page) => { if (condition) alerts.push({ severity, title, detail, page }); };

      const incompleteClients = (profiles || []).filter((p) => !String(p.email || '').trim() || !String(p.phone || '').trim() || !String(p.first_name || '').trim() || !String(p.last_name || '').trim());
      push(incompleteClients.length, 'warning', 'Coordonnées client incomplètes', `${incompleteClients.length} client(s) sans nom, email ou téléphone complet.`, 'clients');
      const incompleteVehicles = (vehicles || []).filter((v) => !String(v.plate || '').trim() || !String(v.brand || '').trim() || !String(v.model || '').trim() || !(Number(v.mileage) >= 0));
      push(incompleteVehicles.length, 'warning', 'Véhicules incomplets', `${incompleteVehicles.length} véhicule(s) sans plaque, modèle ou kilométrage.`, 'clients');

      const activeRequests = (requests || []).filter((r) => !['quoted','cancelled','closed','completed'].includes(r.status));
      const oldRequests = activeRequests.filter((r) => new Date(r.updated_at || r.created_at) < oneDayAgo);
      push(activeRequests.length, 'info', 'Demandes à traiter', `${activeRequests.length} demande(s) ne sont pas encore transformées en devis.`, 'requests');
      push(oldRequests.length, 'warning', 'Demandes en attente', `${oldRequests.length} demande(s) attendent depuis plus de 24 heures.`, 'requests');
      const requestsWithoutVehicle = (requests || []).filter((r) => !r.vehicle_id);
      push(requestsWithoutVehicle.length, 'error', 'Demandes sans véhicule', `${requestsWithoutVehicle.length} demande(s) ne sont liées à aucun véhicule.`, 'requests');

      const draftQuotes = (quotes || []).filter((q) => q.status === 'draft');
      const incompleteDraftQuotes = draftQuotes.filter((q) => !String(q.quote_number || '').trim() || !(Number(q.total) > 0) || !q.valid_until);
      const staleSentQuotes = (quotes || []).filter((q) => q.status === 'sent' && new Date(q.updated_at || q.created_at) < fiveDaysAgo);
      const publishedQuotesWithoutPdf = (quotes || []).filter((q) => ['sent','accepted'].includes(q.status) && !q.pdf_path);
      push(draftQuotes.length, 'info', 'Devis brouillons', `${draftQuotes.length} devis restent à compléter ou à publier.`, 'quotes');
      push(incompleteDraftQuotes.length, 'error', 'Devis incomplets', `${incompleteDraftQuotes.length} brouillon(s) sans numéro, montant ou validité.`, 'quotes');
      push(staleSentQuotes.length, 'warning', 'Devis sans réponse', `${staleSentQuotes.length} devis envoyé(s) sont sans réponse depuis plus de 5 jours.`, 'quotes');
      push(publishedQuotesWithoutPdf.length, 'error', 'Devis publiés sans PDF', `${publishedQuotesWithoutPdf.length} devis envoyé(s) ou accepté(s) n’ont pas de PDF.`, 'document-pdf');

      const todayAppointments = (appointments || []).filter((a) => new Date(a.starts_at) >= today && new Date(a.starts_at) < tomorrow && a.status !== 'cancelled');
      const tomorrowAppointments = (appointments || []).filter((a) => new Date(a.starts_at) >= tomorrow && new Date(a.starts_at) < afterTomorrow && a.status !== 'cancelled');
      push(todayAppointments.length, 'info', 'Rendez-vous aujourd’hui', `${todayAppointments.length} véhicule(s) sont attendus aujourd’hui.`, 'operations');
      push(tomorrowAppointments.length, 'info', 'Rendez-vous demain', `${tomorrowAppointments.length} rendez-vous sont prévus demain.`, 'operations');

      const inspectionByOrder = new Map((inspections || []).map((r) => [r.repair_order_id, r]));
      const activeOrders = (orders || []).filter((o) => ['ready','signed','in_progress','completed'].includes(o.status));
      const ordersWithoutInspection = activeOrders.filter((o) => !inspectionByOrder.has(o.id));
      const incompleteInspections = (inspections || []).filter((r) => r.status !== 'completed');
      const completedWithoutPdf = (inspections || []).filter((r) => r.status === 'completed' && !r.pdf_path);
      push(activeOrders.length, 'info', 'Dossiers atelier actifs', `${activeOrders.length} intervention(s) sont en préparation ou en cours.`, 'interventions');
      push(ordersWithoutInspection.length, 'warning', 'Contrôles non créés', `${ordersWithoutInspection.length} ordre(s) actif(s) n’ont pas encore de fiche de contrôle.`, 'interventions');
      push(incompleteInspections.length, 'warning', 'Contrôles incomplets', `${incompleteInspections.length} fiche(s) de contrôle restent à terminer.`, 'interventions');
      push(completedWithoutPdf.length, 'error', 'Contrôles sans PDF', `${completedWithoutPdf.length} contrôle(s) terminé(s) n’ont pas de PDF.`, 'document-pdf');
      const completedOrders = (orders || []).filter((o) => o.status === 'completed');
      push(completedOrders.length, 'warning', 'Interventions à facturer', `${completedOrders.length} intervention(s) terminée(s) attendent une facture.`, 'finalization');

      const draftInvoices = (invoices || []).filter((i) => i.status === 'draft');
      const invoicesWithoutPdf = (invoices || []).filter((i) => ['issued','partially_paid','paid'].includes(i.status) && !i.pdf_path);
      const overdueInvoices = (invoices || []).filter((i) => ['issued','partially_paid','overdue'].includes(i.status) && i.due_at && new Date(i.due_at) < now && Number(i.amount_paid || 0) < Number(i.total || 0));
      const outstanding = (invoices || []).reduce((sum, i) => sum + Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0)), 0);
      push(draftInvoices.length, 'info', 'Factures brouillons', `${draftInvoices.length} facture(s) attendent validation et PDF.`, 'invoice-actions');
      push(invoicesWithoutPdf.length, 'error', 'Factures émises sans PDF', `${invoicesWithoutPdf.length} facture(s) visible(s) par les clients n’ont pas de PDF.`, 'document-pdf');
      push(overdueInvoices.length, 'error', 'Factures échues', `${overdueInvoices.length} facture(s) sont échues pour ${this.money(overdueInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0)), 0))}.`, 'accounting');
      push((unreadMessages || []).length, 'warning', 'Messages non lus', `${(unreadMessages || []).length} message(s) client attendent une réponse.`, 'messages');

      const requiredBusiness = ['business_name','legal_name','siret','siren','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text','logo_url','calendar_id','booking_url','timezone'];
      const missingBusiness = requiredBusiness.filter((key) => !String(business?.[key] || '').trim());
      push(missingBusiness.length, 'error', 'Entreprise non prête', `${missingBusiness.length} information(s) obligatoire(s) manquent pour les documents et automatisations.`, 'business');

      const operational = this.$('overviewOperationalKpis');
      if (operational) operational.innerHTML = [
        ['À traiter', activeRequests.length],
        ['Atelier actif', activeOrders.length],
        ['À facturer', completedOrders.length],
        ['À encaisser', this.money(outstanding)],
        ['Échues', overdueInvoices.length],
        ['Messages non lus', (unreadMessages || []).length]
      ].map(([label, value]) => `<article class="card kpi"><span>${this.esc(label)}</span><strong>${this.esc(value)}</strong></article>`).join('');

      const weight = { error: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => weight[a.severity] - weight[b.severity] || a.title.localeCompare(b.title, 'fr'));
      if (!anomalyHost) return;
      anomalyHost.innerHTML = alerts.length ? `<div style="display:grid;gap:10px">${alerts.map((alert) => `<article class="card" style="padding:12px"><div class="top"><div><span class="pill">${alert.severity === 'error' ? 'Prioritaire' : alert.severity === 'warning' ? 'À surveiller' : 'Information'}</span><strong style="margin-left:8px">${this.esc(alert.title)}</strong><p class="muted">${this.esc(alert.detail)}</p></div><button class="btn ghost" type="button" data-alert-page="${this.esc(alert.page)}">Ouvrir</button></div></article>`).join('')}</div>` : '<div class="status ok">Aucune anomalie détectée. Tous les dossiers principaux sont à jour.</div>';
      anomalyHost.querySelectorAll('[data-alert-page]').forEach((button) => button.onclick = () => this.page(button.dataset.alertPage));
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
        ['Comptabilité', () => window.EDMAdminAccounting?.load()],
        ['Entreprise', () => window.EDMAdminBusiness?.load()],
        ['Automatisations', () => window.EDMAdminSettings?.load()]
      ];
      const settled = await Promise.allSettled(modules.map(([, load]) => load()));
      const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [`Module ${modules[index][0]} indisponible : ${result.reason?.message || 'erreur inconnue'}`] : []);
      try { await this.overview(failures); }
      catch (error) { this.$('anomalies').innerHTML = `<div class="status error">${this.esc(error.message || 'Vue générale indisponible.')}</div>`; }
    }
  };

  function installOtpUi() {
    const password = app.$('adminPassword');
    password?.closest('label')?.remove();
    const legacyButton = app.$('loginBtn');
    if (!legacyButton) return;
    legacyButton.outerHTML = `
      <button id="adminOtpSend" class="btn primary" type="button">Recevoir un code</button>
      <div id="adminOtpPanel" class="hidden" style="margin-top:12px">
        <label>Code reçu<input id="adminOtpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
        <button id="adminOtpVerify" class="btn primary" type="button" style="margin-top:10px">Valider le code</button>
      </div>`;
  }

  async function sendOtp() {
    const email = app.$('adminEmail').value.trim().toLowerCase();
    if (!email) return app.status('loginStatus', 'Adresse email obligatoire.', true);
    app.status('loginStatus', 'Envoi du code…');
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return app.status('loginStatus', error.message, true);
    app.$('adminOtpPanel').classList.remove('hidden');
    app.$('adminOtpCode').focus();
    app.status('loginStatus', 'Code envoyé. Saisissez le code reçu.');
  }

  async function verifyOtp() {
    const email = app.$('adminEmail').value.trim().toLowerCase();
    const token = app.$('adminOtpCode').value.replace(/\D/g, '').slice(0, 10);
    if (!email || token.length < 6 || token.length > 10) return app.status('loginStatus', 'Entrez le code reçu par email.', true);
    app.status('loginStatus', 'Vérification…');
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return app.status('loginStatus', error.message, true);
    try { await app.requireAdmin(data.user); await app.open(); }
    catch (errorAdmin) { await client.auth.signOut(); app.status('loginStatus', errorAdmin.message, true); }
  }

  async function boot() {
    installOtpUi();
    document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => app.page(button.dataset.page)));
    app.$('requestRefresh')?.addEventListener('click', () => window.EDMAdminRequests?.load().catch((error) => app.status('requestStatus', error.message || 'Actualisation impossible.', true)));
    app.$('adminOtpSend').addEventListener('click', sendOtp);
    app.$('adminOtpVerify').addEventListener('click', verifyOtp);
    app.$('adminOtpCode').addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10); });
    app.$('adminOtpCode').addEventListener('keydown', (event) => { if (event.key === 'Enter') verifyOtp(); });
    app.$('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      try { await app.requireAdmin(data.session.user); await app.open(); }
      catch (error) { await client.auth.signOut(); app.status('loginStatus', error.message, true); }
    }
  }
  app.requireAdmin = async function requireAdmin(user) {
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    if (data.role !== 'admin') throw new Error('Ce compte ne possède pas le rôle administrateur.');
    this.profile = data;
    this.$('adminIdentity').textContent = `${data.first_name || ''} ${data.last_name || ''}`.trim() || user.email;
  };
  window.addEventListener('DOMContentLoaded', () => boot().catch((error) => app.status('loginStatus', error.message, true)));
})();