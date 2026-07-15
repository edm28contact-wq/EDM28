(() => {
  const mod = window.EDMAdminDocs = {
    async load() {
      const app = window.EDMAdmin;
      app.$('docClient').onchange = () => this.loadVehicles();
      app.$('createDraftBtn').onclick = () => this.create();
      await this.list();
    },
    async loadVehicles() {
      const app = window.EDMAdmin;
      const id = app.$('docClient').value;
      const { data } = await app.db.from('vehicles').select('id,plate,brand,model').eq('user_id', id);
      app.$('docVehicle').innerHTML = '<option value="">Choisir</option>' + (data || []).map((v) => `<option value="${v.id}">${app.esc(`${v.plate} ${v.brand || ''} ${v.model || ''}`)}</option>`).join('');
    },
    async create() {
      const app = window.EDMAdmin;
      const userId = app.$('docClient').value;
      if (!userId) return app.status('docStatus', 'Client obligatoire.', true);
      const type = app.$('docType').value;
      const description = app.$('docDescription').value.trim();
      const title = type === 'quote' ? 'Projet de devis' : type === 'invoice' ? 'Projet de facture' : 'Projet d’ordre de réparation';
      const { error } = await app.db.from('ai_drafts').insert({
        user_id: userId,
        document_type: type,
        status: 'draft',
        input_data: { description, vehicle_id: app.$('docVehicle').value || null, source: 'admin' },
        output_data: { title, lines: [], notes: description },
        created_by: app.profile.id
      });
      if (error) return app.status('docStatus', error.message, true);
      app.status('docStatus', 'Brouillon créé. Validation humaine obligatoire.');
      await this.list();
    },
    async list() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('ai_drafts').select('id,document_type,status,created_at,output_data').order('created_at', { ascending: false }).limit(20);
      if (error) return;
      app.$('draftList').innerHTML = (data || []).map((d) => `<article class="card" style="margin:8px 0"><span class="pill">${app.esc(d.document_type)}</span><b style="display:block;margin-top:8px">${app.esc(d.output_data?.title || 'Brouillon')}</b><p class="muted">${new Date(d.created_at).toLocaleString('fr-FR')} · ${app.esc(d.status)}</p></article>`).join('') || '<p class="muted">Aucun brouillon.</p>';
    }
  };
})();