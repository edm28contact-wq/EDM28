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
  window.EDMAdminSettings = {
    async load() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('automation_settings').select('*').single();
      if (error) throw error;
      app.$('automationForm').innerHTML = fields.map((field) => `<label class="field"><span>${labels[field]}</span><input type="checkbox" id="auto_${field}" ${data[field] ? 'checked' : ''}></label>`).join('') + `<label class="field"><span>Destinataire de test</span><input id="auto_test_recipient" value="${app.esc(data.test_recipient || '')}"></label>`;
      app.$('saveAutomationBtn').onclick = () => this.save();
    },
    async save() {
      const app = window.EDMAdmin;
      const payload = {};
      fields.forEach((field) => { payload[field] = app.$(`auto_${field}`).checked; });
      payload.test_recipient = app.$('auto_test_recipient').value.trim() || null;
      payload.updated_by = app.profile.id;
      payload.updated_at = new Date().toISOString();
      const { error } = await app.db.from('automation_settings').update(payload).eq('id', true);
      app.status('automationStatus', error ? error.message : 'Réglages enregistrés.', Boolean(error));
    }
  };
})();