(() => {
  const fallbackRequiredBusiness = [
    ['business_name','Raison sociale'],['legal_name','Nom légal'],['siret','SIRET'],['siren','SIREN'],
    ['vat_status','Statut TVA'],['address_line1','Adresse'],['postal_code','Code postal'],['city','Ville'],
    ['country','Pays'],['phone','Téléphone'],['email','Email'],['payment_terms','Conditions de paiement'],
    ['late_penalty_text','Pénalités de retard'],['recovery_fee_text','Indemnité de recouvrement'],
    ['logo_url','URL du logo'],['calendar_id','Identifiant Google Agenda'],['booking_url','Lien public de réservation'],
    ['timezone','Fuseau horaire']
  ];

  const waitForApp = (fn) => {
    const timer = setInterval(() => {
      if (window.EDMAdmin && document.getElementById('saveAutomationBtn')) {
        clearInterval(timer);
        fn(window.EDMAdmin);
      }
    }, 100);
  };

  waitForApp((app) => {
    async function validateReadiness() {
      const automationIds = ['automations_enabled','messages_enabled','booking_enabled','reminders_enabled'];
      const operationalEnabled = automationIds.some((id) => app.$(`auto_${id}`)?.checked);
      const aiEnabled = app.$('auto_ai_enabled')?.checked;
      const testMode = app.$('auto_test_mode')?.checked;
      const testRecipient = app.$('auto_test_recipient');

      app.markRequired(testRecipient, Boolean(testMode && !testRecipient?.value.trim()));
      if (testMode && !testRecipient?.value.trim()) {
        app.status('automationStatus', 'Renseignez le destinataire de test avant d’activer le mode test.', true);
        return false;
      }

      if (!operationalEnabled && !aiEnabled) return true;

      const { data, error } = await app.db.from('business_configuration').select('*').eq('id', true).single();
      if (error) {
        app.status('automationStatus', error.message, true);
        return false;
      }

      const missing = window.EDMBusinessRequirements?.missing
        ? window.EDMBusinessRequirements.missing(data)
        : fallbackRequiredBusiness.filter(([key]) => !String(data?.[key] || '').trim()).map(([key, label]) => ({ key, label }));
      if (missing.length) {
        app.status(
          'automationStatus',
          `Configuration incomplète : ${missing.map((item) => item.label).join(', ')}. Complétez ces champs dans Informations entreprise.`,
          true
        );
        return false;
      }

      if (aiEnabled) {
        const aiMissing = ['ai_provider','ai_model'].filter((key) => !String(data?.[key] || '').trim());
        if (aiMissing.length) {
          app.status('automationStatus', 'Fournisseur et modèle IA obligatoires avant activation.', true);
          return false;
        }
      }

      return true;
    }

    document.addEventListener('click', async (event) => {
      if (event.target?.id !== 'saveAutomationBtn') return;
      const ready = await validateReadiness();
      if (!ready) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('input', (event) => {
      if (event.target?.id === 'auto_test_recipient') {
        app.markRequired(event.target, Boolean(app.$('auto_test_mode')?.checked && !event.target.value.trim()));
      }
    });
  });
})();
