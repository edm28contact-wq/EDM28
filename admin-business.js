(() => {
  const fields = [
    ['business_name','Raison sociale',true],['legal_name','Nom légal',true],['siret','SIRET',true],['siren','SIREN',true],
    ['vat_status','Statut TVA',true],['vat_number','Numéro de TVA',false],['address_line1','Adresse',true],
    ['postal_code','Code postal',true],['city','Ville',true],['country','Pays',true],['phone','Téléphone',true],
    ['email','Email',true],['website','Site web',false],['bank_name','Banque',false],['iban','IBAN',false],['bic','BIC',false],
    ['payment_terms','Conditions de paiement',true],['late_penalty_text','Pénalités de retard',true],
    ['recovery_fee_text','Indemnité de recouvrement',true],['insurance_name','Assureur',false],
    ['insurance_policy','Police d’assurance',false],['logo_url','URL du logo',true],['calendar_id','Identifiant Google Agenda',true],
    ['booking_url','Lien public de réservation',true],['timezone','Fuseau horaire',true],['workshop_signer_name','Nom du responsable sur les OR',false],['ai_provider','Fournisseur IA',false],['ai_model','Modèle IA',false]
  ];
  const requiredFields = fields.filter(([, , required]) => required).map(([key, label]) => ({ key, label }));
  window.EDMBusinessRequirements = {
    fields: requiredFields,
    missing(data = {}) {
      return requiredFields.filter(({ key }) => !String(data?.[key] || '').trim());
    }
  };

  window.EDMAdminBusiness = {
    data: {},
    async load() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('business_configuration').select('*').eq('id', true).single();
      if (error) throw error;
      this.data = data || {};
      app.$('businessForm').innerHTML = fields.map(([key,label,required]) => `<label class="field"><span>${app.esc(label)}${required ? ' *' : ''}</span><input id="business_${key}" data-required="${required}" value="${app.esc(this.data[key] || '')}"></label>`).join('');
      app.$('businessForm').insertAdjacentHTML('beforeend', `
        <div class="card" style="grid-column:1/-1;padding:14px">
          <h3>Signature atelier et cachet EDM28</h3>
          <p class="muted">Le cachet est automatiquement composé avec les informations légales du garage. Importez votre propre signature manuscrite (PNG ou JPEG, 1 Mo maximum) pour l’intégrer aux prochains OR. Aucun tracé n’est créé à votre place.</p>
          <label>Importer ma signature<input id="businessSignatureFile" type="file" accept="image/png,image/jpeg"></label>
          <button id="businessSignatureSave" type="button" class="btn ghost">Enregistrer la signature</button>
          <span id="businessSignatureStatus" class="muted">${this.data.workshop_signature_path ? 'Signature atelier enregistrée.' : 'Aucune signature enregistrée.'}</span>
        </div>`);
      app.$('businessSignatureSave').onclick = async () => {
        const file = app.$('businessSignatureFile').files?.[0];
        if (!file) return app.status('businessStatus','Choisissez votre signature PNG ou JPEG.',true);
        if (!['image/png','image/jpeg'].includes(file.type) || file.size > 1024 * 1024)
          return app.status('businessStatus','Signature PNG ou JPEG de 1 Mo maximum obligatoire.',true);
        const path = `company/workshop-signature-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
        const uploaded = await app.db.storage.from('repair-documents').upload(path,file,{contentType:file.type,upsert:false});
        if (uploaded.error) return app.status('businessStatus',uploaded.error.message,true);
        const saved = await app.db.from('business_configuration')
          .update({workshop_signature_path:path,updated_at:new Date().toISOString(),updated_by:app.profile.id})
          .eq('id',true).select('workshop_signature_path').single();
        if (saved.error) {
          await app.db.storage.from('repair-documents').remove([path]);
          return app.status('businessStatus',saved.error.message,true);
        }
        this.data.workshop_signature_path = path;
        app.$('businessSignatureStatus').textContent = 'Signature atelier enregistrée. Elle sera incluse sur les prochains OR générés.';
        app.status('businessStatus','Signature atelier enregistrée avec succès.');
      };
      fields.forEach(([key,,required]) => {
        const input = app.$(`business_${key}`);
        const validate = () => app.markRequired(input, required && !input.value.trim());
        input.addEventListener('input', validate);
        validate();
      });
      app.$('saveBusinessBtn').onclick = () => this.save();
    },
    async save() {
      const app = window.EDMAdmin;
      const payload = { updated_by: app.profile.id, updated_at: new Date().toISOString() };
      let invalid = false;
      fields.forEach(([key,,required]) => {
        const input = app.$(`business_${key}`);
        const value = input.value.trim();
        payload[key] = value || null;
        if (required && !value) { invalid = true; app.markRequired(input, true); }
      });
      if (invalid) return app.status('businessStatus', 'Complétez tous les champs obligatoires en rouge.', true);
      const { error } = await app.db.from('business_configuration').update(payload).eq('id', true);
      if (error) return app.status('businessStatus', error.message, true);
      const publicKeys = ['business_name','address_line1','address_line2','postal_code','city','country','phone','email','website','logo_url','timezone','booking_url'];
      const publicResult = await app.db.from('public_business_profile').select(publicKeys.join(',')).eq('id', true).maybeSingle();
      if (publicResult.error) return app.status('businessStatus', `Informations enregistrées, mais vérification publique impossible : ${publicResult.error.message}`, true);
      const mismatch = publicKeys.find((key) => String(publicResult.data?.[key] || '') !== String(payload[key] || ''));
      if (mismatch) return app.status('businessStatus', `Informations enregistrées, mais la synchronisation publique est incomplète (${mismatch}).`, true);
      this.data = { ...this.data, ...payload };
      app.status('businessStatus', 'Informations enregistrées et synchronisées sur le site public, les prochains emails et les prochains PDF.', false);
    }
  };
})();