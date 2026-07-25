(() => {
  const moduleGroups = [
    ['quotes','Devis'],['agenda','Agenda'],['workshop','Atelier'],['parts','Pièces'],
    ['suppliers','Fournisseurs'],['purchases','Achats'],['invoices','Factures'],['payments','Encaissements'],
    ['micro_accounting','Comptabilité micro'],['messaging','Messagerie'],['automations','Automatisations'],
    ['ai_assistant','Assistant IA'],['documents','Documents']
  ];

  const accountingFeatures = [
    ['revenue_book','Livre chronologique des recettes'],
    ['sales_services_split','Séparation ventes / prestations'],
    ['purchase_register','Registre des achats'],
    ['expenses','Suivi des dépenses réelles'],
    ['urssaf_preparation','Préparation déclaration Urssaf'],
    ['tax_reserve','Réserve cotisations et impôt'],
    ['cfe_tracking','Suivi CFE'],
    ['vat_tracking','Suivi TVA'],
    ['cash_register','Caisse espèces'],
    ['part_margin','Marge sur les pièces'],
    ['job_profitability','Rentabilité par intervention'],
    ['cashflow','Trésorerie'],
    ['annual_archive','Archivage annuel']
  ];

  const requiredActivity = ['declared_activity_label','activity_kind','vat_mode','urssaf_frequency','stock_mode'];

  const checked = (value) => value ? ' checked' : '';
  const esc = (value) => window.EDMAdmin.esc(value ?? '');

  function checkbox(id, label, value, help = '') {
    return `<label class="management-choice"><input type="checkbox" id="${id}"${checked(value)}><span><b>${esc(label)}</b>${help ? `<small>${esc(help)}</small>` : ''}</span></label>`;
  }

  function select(id, label, value, options, required = false) {
    return `<label class="field"><span>${esc(label)}${required ? ' *' : ''}</span><select id="${id}" data-required="${required}"><option value="">Choisir…</option>${options.map(([key,text]) => `<option value="${esc(key)}"${value === key ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  }

  const mod = {
    data: null,

    async load() {
      const app = window.EDMAdmin;
      const host = app.$('managementForm');
      if (!host) return;
      const { data, error } = await app.db.from('backoffice_configuration').select('*').eq('id', true).single();
      if (error) throw error;
      this.data = data || {};
      this.render();
      app.$('saveManagementBtn').onclick = () => this.save();
    },

    render() {
      const app = window.EDMAdmin;
      const data = this.data || {};
      const modules = data.enabled_modules || {};
      const accounting = data.accounting_features || {};
      const paymentMethods = new Set(data.payment_methods || []);
      const segments = new Set(data.customer_segments || []);

      app.$('managementForm').innerHTML = `
        <div class="management-tabs" role="tablist">
          <button type="button" class="btn ghost active" data-management-tab="activity">Activité</button>
          <button type="button" class="btn ghost" data-management-tab="modules">Modules</button>
          <button type="button" class="btn ghost" data-management-tab="accounting-options">Comptabilité</button>
          <button type="button" class="btn ghost" data-management-tab="parts-options">Pièces et débours</button>
        </div>

        <div class="management-panel active" data-management-panel="activity">
          <div class="grid2">
            <label class="field"><span>Intitulé exact de l’activité *</span><input id="mgmt_declared_activity_label" data-required="true" value="${esc(data.declared_activity_label)}"></label>
            ${select('mgmt_activity_kind','Nature de l’activité',data.activity_kind,[['service','Prestation de services'],['mixed','Activité mixte : vente + prestation'],['sales','Vente principale']],true)}
            ${select('mgmt_vat_mode','Régime de TVA',data.vat_mode,[['franchise_en_base','Franchise en base'],['liable','Redevable de TVA']],true)}
            ${select('mgmt_urssaf_frequency','Déclaration Urssaf',data.urssaf_frequency,[['monthly','Mensuelle'],['quarterly','Trimestrielle']],true)}
            ${select('mgmt_stock_mode','Gestion des pièces',data.stock_mode || 'per_job',[['none','Aucun stock'],['per_job','Commande pour chaque intervention'],['light_stock','Stock léger']],true)}
            <label class="field"><span>Fin de l’ACRE</span><input id="mgmt_acre_end_date" type="date" value="${esc(data.acre_end_date)}"></label>
          </div>
          <div class="management-grid">
            ${checkbox('mgmt_liberatory_tax_enabled','Versement libératoire',data.liberatory_tax_enabled)}
            ${checkbox('mgmt_acre_enabled','ACRE active',data.acre_enabled)}
            ${checkbox('mgmt_dedicated_bank_account','Compte bancaire dédié',data.dedicated_bank_account)}
          </div>
          <h3>Modes de paiement acceptés</h3>
          <div class="management-grid">
            ${['card','cash','bank_transfer','check'].map((key) => checkbox(`mgmt_payment_${key}`,{card:'Carte',cash:'Espèces',bank_transfer:'Virement',check:'Chèque'}[key],paymentMethods.has(key))).join('')}
          </div>
          <h3>Clientèle</h3>
          <div class="management-grid">
            ${checkbox('mgmt_segment_private','Particuliers',segments.has('private'))}
            ${checkbox('mgmt_segment_business','Professionnels',segments.has('business'))}
          </div>
        </div>

        <div class="management-panel" data-management-panel="modules">
          <div class="status">Clients, véhicules, demandes, sécurité, catalogue et journal d’audit constituent le noyau obligatoire.</div>
          <div class="management-grid">${moduleGroups.map(([key,label]) => checkbox(`mgmt_module_${key}`,label,modules[key] !== false)).join('')}</div>
        </div>

        <div class="management-panel" data-management-panel="accounting-options">
          <p class="muted">Active uniquement les notions utiles. Une option activée apparaîtra ensuite dans le module Comptabilité.</p>
          <div class="management-grid">${accountingFeatures.map(([key,label]) => checkbox(`mgmt_accounting_${key}`,label,Boolean(accounting[key]))).join('')}</div>
        </div>

        <div class="management-panel" data-management-panel="parts-options">
          ${select('mgmt_part_default_mode','Mode utilisé par défaut',data.part_default_mode || 'resale',[['resale','Revente par EDM28'],['customer_supplied','Pièce fournie par le client'],['disbursement','Débours strict']],true)}
          <div class="management-grid">
            ${checkbox('mgmt_allow_part_resale','Autoriser la revente',data.allow_part_resale !== false,'Pièce achetée au nom d’EDM28, prix de vente et marge suivis.')}
            ${checkbox('mgmt_allow_customer_supplied_parts','Autoriser les pièces client',data.allow_customer_supplied_parts !== false,'La pièce n’est pas vendue par EDM28 ; seule la main-d’œuvre est facturée.')}
            ${checkbox('mgmt_allow_disbursements','Autoriser les débours',Boolean(data.allow_disbursements),'Mandat, facture au nom du client, justificatif et remboursement exact obligatoires.')}
          </div>
          <div class="status error"><b>Règle non désactivable :</b> un débours ne peut contenir aucune marge et reste bloqué sans mandat, facture au nom du client et justificatif.</div>
        </div>`;

      this.bindTabs();
      this.bindValidation();
      this.syncConditionalFields();
    },

    bindTabs() {
      document.querySelectorAll('[data-management-tab]').forEach((button) => button.onclick = () => {
        document.querySelectorAll('[data-management-tab]').forEach((node) => node.classList.toggle('active', node === button));
        document.querySelectorAll('[data-management-panel]').forEach((node) => node.classList.toggle('active', node.dataset.managementPanel === button.dataset.managementTab));
      });
    },

    bindValidation() {
      const app = window.EDMAdmin;
      requiredActivity.forEach((key) => {
        const node = app.$(`mgmt_${key}`);
        const validate = () => app.markRequired(node, !String(node.value || '').trim());
        node?.addEventListener('input', validate);
        validate();
      });
      app.$('mgmt_acre_enabled')?.addEventListener('change', () => this.syncConditionalFields());
      ['mgmt_allow_part_resale','mgmt_allow_customer_supplied_parts','mgmt_allow_disbursements','mgmt_part_default_mode'].forEach((id) => app.$(id)?.addEventListener('change', () => this.validatePartModes(false)));
    },

    syncConditionalFields() {
      const app = window.EDMAdmin;
      const acre = app.$('mgmt_acre_enabled')?.checked;
      const endDate = app.$('mgmt_acre_end_date');
      if (endDate) {
        endDate.disabled = !acre;
        if (!acre) endDate.value = '';
      }
    },

    validatePartModes(showStatus = true) {
      const app = window.EDMAdmin;
      const allowed = {
        resale: app.$('mgmt_allow_part_resale').checked,
        customer_supplied: app.$('mgmt_allow_customer_supplied_parts').checked,
        disbursement: app.$('mgmt_allow_disbursements').checked
      };
      const selected = app.$('mgmt_part_default_mode').value;
      const valid = Boolean(allowed[selected]);
      app.markRequired(app.$('mgmt_part_default_mode'), !valid);
      if (!valid && showStatus) app.status('managementStatus', 'Le mode de pièce par défaut doit être autorisé.', true);
      return valid;
    },

    async save() {
      const app = window.EDMAdmin;
      const button = app.$('saveManagementBtn');
      let invalid = false;
      requiredActivity.forEach((key) => {
        const node = app.$(`mgmt_${key}`);
        const missing = !String(node?.value || '').trim();
        app.markRequired(node, missing);
        invalid ||= missing;
      });
      if (invalid) return app.status('managementStatus', 'Complète les champs obligatoires en rouge.', true);
      if (!this.validatePartModes()) return;

      const enabledModules = Object.fromEntries(moduleGroups.map(([key]) => [key, app.$(`mgmt_module_${key}`).checked]));
      const accounting = Object.fromEntries(accountingFeatures.map(([key]) => [key, app.$(`mgmt_accounting_${key}`).checked]));
      const paymentMethods = ['card','cash','bank_transfer','check'].filter((key) => app.$(`mgmt_payment_${key}`).checked);
      const customerSegments = [['private','mgmt_segment_private'],['business','mgmt_segment_business']].filter(([,id]) => app.$(id).checked).map(([key]) => key);

      const payload = {
        declared_activity_label: app.$('mgmt_declared_activity_label').value.trim(),
        activity_kind: app.$('mgmt_activity_kind').value,
        vat_mode: app.$('mgmt_vat_mode').value,
        urssaf_frequency: app.$('mgmt_urssaf_frequency').value,
        stock_mode: app.$('mgmt_stock_mode').value,
        liberatory_tax_enabled: app.$('mgmt_liberatory_tax_enabled').checked,
        acre_enabled: app.$('mgmt_acre_enabled').checked,
        acre_end_date: app.$('mgmt_acre_enabled').checked ? (app.$('mgmt_acre_end_date').value || null) : null,
        dedicated_bank_account: app.$('mgmt_dedicated_bank_account').checked,
        payment_methods: paymentMethods,
        customer_segments: customerSegments,
        enabled_modules: enabledModules,
        accounting_features: accounting,
        part_default_mode: app.$('mgmt_part_default_mode').value,
        allow_part_resale: app.$('mgmt_allow_part_resale').checked,
        allow_customer_supplied_parts: app.$('mgmt_allow_customer_supplied_parts').checked,
        allow_disbursements: app.$('mgmt_allow_disbursements').checked,
        strict_disbursement_controls: true,
        updated_by: app.profile.id,
        updated_at: new Date().toISOString()
      };

      button.disabled = true;
      try {
        const { error } = await app.db.from('backoffice_configuration').update(payload).eq('id', true);
        if (error) throw error;
        this.data = payload;
        app.status('managementStatus', 'Configuration enregistrée. Les modules seront appliqués au prochain chargement.');
      } catch (error) {
        app.status('managementStatus', error.message || 'Enregistrement impossible.', true);
      } finally {
        button.disabled = false;
      }
    }
  };

  window.EDMAdminManagement = mod;
})();
