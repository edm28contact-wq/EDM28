(() => {
  const fields = ['automations_enabled','messages_enabled','booking_enabled','reminders_enabled','ai_enabled','test_mode'];
  const labels = {
    automations_enabled:'Automatisations générales',
    messages_enabled:'Messages automatiques',
    booking_enabled:'Réservation client',
    reminders_enabled:'Rappels de rendez-vous',
    ai_enabled:'Assistance IA',
    test_mode:'Mode test'
  };
  const requiredBusiness = ['business_name','legal_name','siret','siren','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text','logo_url','calendar_id','timezone'];

  window.EDMAdminSettings = {
    async load() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('automation_settings').select('*').single();
      if (error) throw error;
      app.$('automationForm').innerHTML = fields.map((field) => `<label class="field"><span>${labels[field]}</span><input type="checkbox" id="auto_${field}" ${data[field] ? 'checked' : ''}></label>`).join('') + `<label class="field"><span>Destinataire de test</span><input id="auto_test_recipient" type="email" value="${app.esc(data.test_recipient || '')}"></label>`;
      app.$('saveAutomationBtn').onclick = () => this.save();
      app.$('auto_test_recipient').addEventListener('input', () => {
        app.markRequired(app.$('auto_test_recipient'), Boolean(app.$('auto_test_mode').checked && !app.$('auto_test_recipient').value.trim()));
      });
    },

    async validate() {
      const app = window.EDMAdmin;
      const operationalEnabled = ['automations_enabled','messages_enabled','booking_enabled','reminders_enabled'].some((field) => app.$(`auto_${field}`).checked);
      const aiEnabled = app.$('auto_ai_enabled').checked;
      const testMode = app.$('auto_test_mode').checked;
      const testRecipient = app.$('auto_test_recipient');
      const email = testRecipient.value.trim();

      app.markRequired(testRecipient, Boolean(testMode && !email));
      if (testMode && !email) {
        app.status('automationStatus', 'Renseignez le destinataire de test avant d’activer le mode test.', true);
        return false;
      }
      if (testMode && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        app.markRequired(testRecipient, true);
        app.status('automationStatus', 'L’adresse du destinataire de test est invalide.', true);
        return false;
      }
      if (!operationalEnabled && !aiEnabled) return true;

      const { data, error } = await app.db.from('business_configuration').select('*').eq('id', true).single();
      if (error) {
        app.status('automationStatus', error.message, true);
        return false;
      }
      const missing = requiredBusiness.filter((key) => !String(data?.[key] || '').trim());
      if (missing.length) {
        app.status('automationStatus', `Configuration incomplète : ${missing.length} champ(s) obligatoire(s) à compléter dans Informations entreprise.`, true);
        return false;
      }
      if (aiEnabled && ['ai_provider','ai_model'].some((key) => !String(data?.[key] || '').trim())) {
        app.status('automationStatus', 'Fournisseur et modèle IA obligatoires avant activation.', true);
        return false;
      }
      return true;
    },

    async save() {
      const app = window.EDMAdmin;
      const button = app.$('saveAutomationBtn');
      button.disabled = true;
      try {
        if (!(await this.validate())) return;
        const payload = {};
        fields.forEach((field) => { payload[field] = app.$(`auto_${field}`).checked; });
        payload.test_recipient = app.$('auto_test_recipient').value.trim() || null;
        payload.updated_by = app.profile.id;
        payload.updated_at = new Date().toISOString();
        const { error } = await app.db.from('automation_settings').update(payload).eq('id', true);
        app.status('automationStatus', error ? error.message : 'Réglages enregistrés.', Boolean(error));
      } finally {
        button.disabled = false;
      }
    }
  };
})();