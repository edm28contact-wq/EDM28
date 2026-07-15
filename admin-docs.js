(() => {
  window.EDMAdminDocs = {
    async load() {
      const app = window.EDMAdmin;
      app.$('docClient').onchange = () => this.loadVehicles();
      app.$('createDraftBtn').onclick = () => this.create();
      await this.list();
    },
    async loadVehicles() {
      const app = window.EDMAdmin;
      const userId = app.$('docClient').value;
      if (!userId) {
        app.$('docVehicle').innerHTML = '<option value="">Choisir</option>';
        return;
      }
      const { data, error } = await app.db.from('vehicles').select('id,plate,brand,model').eq('user_id', userId);
      if (error) return app.status('docStatus', error.message, true);
      app.$('docVehicle').innerHTML = '<option value="">Choisir</option>' + (data || []).map((v) => `<option value="${v.id}">${app.esc(`${v.plate || ''} ${v.brand || ''} ${v.model || ''}`.trim())}</option>`).join('');
    },
    async create() {
      const app = window.EDMAdmin;
      const userId = app.$('docClient').value;
      const vehicleId = app.$('docVehicle').value || null;
      const type = app.$('docType').value;
      const description = app.$('docDescription').value.trim();
      app.markRequired(app.$('docClient'), !userId);
      app.markRequired(app.$('docDescription'), !description);
      if (!userId || !description) return app.status('docStatus', 'Client et description obligatoires.', true);
      const title = type === 'quote' ? 'Projet de devis' : type === 'invoice' ? 'Projet de facture' : 'Projet d’ordre de réparation';
      const { error } = await app.db.from('ai_drafts').insert({
        user_id: userId,
        vehicle_id: vehicleId,
        document_type: type,
        status: 'draft',
        source_snapshot: { source: 'admin', description },
        draft_payload: { title, lines: [], notes: description }
      });
      if (error) return app.status('docStatus', error.message, true);
      app.$('docDescription').value = '';
      app.markRequired(app.$('docDescription'), true);
      app.status('docStatus', 'Brouillon créé. Validation humaine obligatoire.');
      await this.list();
    },
    async list() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('ai_drafts').select('id,document_type,status,created_at,draft_payload').order('created_at', { ascending: false }).limit(20);
      if (error) return app.status('docStatus', error.message, true);
      app.$('draftList').innerHTML = (data || []).map((d) => `<article class="card compact"><span class="pill">${app.esc(d.document_type)}</span><b>${app.esc(d.draft_payload?.title || 'Brouillon')}</b><p class="muted">${new Date(d.created_at).toLocaleString('fr-FR')} · ${app.esc(d.status)}</p></article>`).join('') || '<p class="muted">Aucun brouillon.</p>';
    }
  };
})();
