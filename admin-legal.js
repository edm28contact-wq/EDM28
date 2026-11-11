(() => {
  const app=()=>window.EDMAdmin;
  const host=document.getElementById('legalList');
  const refresh=document.getElementById('legalRefresh');
  if(!host||!refresh||!app()?.db)return;
  const escape=v=>app().esc(v);
  let working=false;
  const status=(msg,error=false)=>app().status('legalStatus',msg,error);
  async function load(){
    const db=app().db;
    const [{data:records,error},{data:business,error:businessError},{data:legal,error:legalError}]=await Promise.all([
      db.from('consumer_withdrawal_requests').select('id,submitted_at,contract_reference,consumer_name,consumer_email,statement,receipt_status,receipt_sent_at,review_status,review_note,reviewed_at').order('submitted_at',{ascending:false}).limit(150),
      db.from('business_configuration').select('legal_name,siren,siret,vat_status,vat_number,address_line1,postal_code,city,phone,email,insurance_name,insurance_policy').eq('id',true).single(),
      db.from('consumer_legal_settings').select('mediator_name,mediator_postal_address,mediator_website,publication_director,host_name,host_postal_address,host_phone,host_website,registered_business_address,privacy_contact_email,professional_qualification_reference,compliance_reviewed_at,privacy_retention_reviewed_at').eq('id',true).single()
    ]);
    if(error)throw error;
    if(businessError)throw businessError;
    if(legalError)throw legalError;
    const required=[
      ['Dénomination légale',business?.legal_name],
      ['SIREN',business?.siren],
      ['SIRET',business?.siret],
      ['Régime de TVA',business?.vat_status],
      ['Adresse de domiciliation légale',legal?.registered_business_address],
      ['Adresse de l’établissement',business?.address_line1],
      ['Code postal',business?.postal_code],
      ['Ville',business?.city],
      ['Téléphone de contact',business?.phone],
      ['Assureur professionnel',business?.insurance_name],
      ['Référence d’assurance',business?.insurance_policy],
      ['Médiateur conventionné',legal?.mediator_name],
      ['Adresse du médiateur',legal?.mediator_postal_address],
      ['Site du médiateur',legal?.mediator_website],
      ['Directeur de publication',legal?.publication_director],
      ['Hébergeur',legal?.host_name],
      ['Téléphone de l’hébergeur',legal?.host_phone],
      ['Adresse de l’hébergeur',legal?.host_postal_address],
      ['Contact pour les données personnelles',legal?.privacy_contact_email],
      ['Justificatif de qualification professionnelle',legal?.professional_qualification_reference]
    ];
    const missing=required.filter(([,v])=>!String(v||'').trim()).map(([label])=>label);
    const checked=required.length-missing.length;
    const progress='Champs officiels renseignés : '+checked+'/'+required.length+
      '. Restants : '+(missing.length?missing.join(' · '):'aucun')+'.';
    const enterpriseFields=[
      ['legal_name','Dénomination officielle / EI'],['siren','SIREN (9 chiffres)'],
      ['siret','SIRET (14 chiffres)'],['vat_status','Régime de TVA confirmé'],
      ['vat_number','Numéro de TVA, si applicable'],['address_line1','Adresse de l’établissement'],
      ['postal_code','Code postal'],['city','Ville'],['phone','Téléphone professionnel'],
      ['insurance_name','Assureur professionnel'],['insurance_policy','Numéro de police d’assurance']
    ];
    host.innerHTML=
      '<div class="notice"><strong>Préparation juridique EDM28</strong><p>'+escape(progress)+'</p><p>Les champs manquants restent vides. Un champ rempli ne prouve pas sa vérification officielle. Ne marquez pas le dossier conforme sans contrôle documentaire et test des emails/signatures.</p></div>'+
      '<section class="card" style="margin:12px 0"><h3>Identité et assurance de l’entreprise</h3><p>Renseignez les informations tirées de votre immatriculation, attestation d’assurance et justificatifs officiels.</p><div class="grid2" data-consumer-company-fields>'+
      enterpriseFields.map(([key,label])=>'<label>'+escape(label)+'<input data-consumer-company-field="'+escape(key)+'" value="'+escape(business?.[key]||'')+'" maxlength="400"'+(['siren','siret','vat_number'].includes(key)?' autocomplete="off"':'')+'></label>').join('')+
      '</div><button type="button" class="btn primary" data-save-consumer-company>Enregistrer les informations de l’entreprise</button></section>'+
      '<p>Une déclaration reçue ne résilie pas automatiquement un rendez-vous ou une facture. Examiner les droits du consommateur et envoyer une réponse écrite. En cas d’échec de l’accusé par email, traiter la demande en priorité.</p>'+
      '<section class="card" style="margin:12px 0"><h3>Mentions légales publiques</h3><p>Indiquez uniquement les renseignements officiels vérifiés. Le médiateur doit être conventionné et inscrit sur la liste officielle. SIRET, TVA et assurance : compléter dans Informations entreprise.</p><div class="grid2" data-consumer-legal-fields>'+
      [['mediator_name','Nom du médiateur'],['mediator_postal_address','Adresse du médiateur'],['mediator_website','Site du médiateur (HTTPS)'],['publication_director','Directeur de publication'],['host_name','Hébergeur'],['host_postal_address','Adresse de l’hébergeur'],['host_phone','Téléphone de l’hébergeur'],['host_website','Site de l’hébergeur (HTTPS)'],['registered_business_address','Adresse de domiciliation officielle (EI)'],['privacy_contact_email','Contact RGPD (email)'],['professional_qualification_reference','Justificatif de qualification professionnelle (référence)']].map(([key,label])=>'<label>'+escape(label)+'<input data-consumer-legal-field="'+escape(key)+'" value="'+escape(legal?.[key]||'')+'" maxlength="400"></label>').join('')+
      '</div><button type="button" class="btn primary" data-save-consumer-legal>Enregistrer les mentions publiques</button></section>'+
      ((records||[]).length?(records||[]).map(row=>
       '<article class="card" data-withdrawal="'+escape(row.id)+'" style="margin:12px 0">'+
       '<div class="top"><strong>'+escape(row.contract_reference)+'</strong><span class="pill">'+escape(row.review_status)+'</span></div>'+
       '<p><strong>'+escape(row.consumer_name)+'</strong> · '+escape(row.consumer_email)+'</p>'+
       '<p>Date de réception : '+escape(new Date(row.submitted_at).toLocaleString('fr-FR'))+
       ' · Accusé : '+escape(row.receipt_status)+
       (row.receipt_sent_at?' ('+escape(new Date(row.receipt_sent_at).toLocaleString('fr-FR'))+')':'')+'</p>'+
       '<p>'+escape(row.statement)+'</p>'+
       '<label>Note administrative<textarea data-legal-note rows="2" maxlength="1500">'+escape(row.review_note||'')+'</textarea></label>'+
       '<div class="toolbar"><button type="button" class="btn" data-legal-status="reviewing">En cours de traitement</button>'+
       '<button type="button" class="btn primary" data-legal-status="processed">Traitement administratif terminé</button></div>'+
       '</article>'
      ).join(''):'<p class="muted">Aucune rétractation enregistrée.</p>');
    host.querySelector('[data-save-consumer-company]')?.addEventListener('click',async(event)=>{
      if(working)return;
      const button=event.currentTarget;working=true;button.disabled=true;
      try{
        const fields={};
        host.querySelectorAll('[data-consumer-company-field]').forEach(input=>{
          fields[input.dataset.consumerCompanyField]=input.value.trim()||null;
        });
        if(fields.siren && !/^[0-9]{9}$/.test(fields.siren))
          throw new Error('Le SIREN doit contenir exactement neuf chiffres.');
        if(fields.siret && !/^[0-9]{14}$/.test(fields.siret))
          throw new Error('Le SIRET doit contenir exactement quatorze chiffres.');
        if(fields.siren && fields.siret && !fields.siret.startsWith(fields.siren))
          throw new Error('Le SIRET doit commencer par les neuf chiffres du SIREN.');
        if(fields.vat_number && !/^FR[0-9A-Z]{2}[0-9]{9}$/i.test(fields.vat_number))
          throw new Error('Le format du numéro de TVA français est incorrect.');
        const {error}=await db.from('business_configuration')
          .update({...fields,updated_at:new Date().toISOString()}).eq('id',true);
        if(error)throw error;
        status('Informations entreprise enregistrées. Elles seront affichées dans les mentions publiques après synchronisation.');
        await load();
      }catch(e){status(e.message||'Enregistrement impossible.',true);}
      finally{working=false;button.disabled=false;}
    });
    host.querySelector('[data-save-consumer-legal]')?.addEventListener('click',async(event)=>{
      if(working)return;const button=event.currentTarget;working=true;button.disabled=true;
      try {
        const fields={};
        host.querySelectorAll('[data-consumer-legal-field]').forEach(input=>{
          fields[input.dataset.consumerLegalField]=input.value.trim()||null;
        });
        for(const name of ['mediator_website','host_website']){
          if(fields[name] && !/^https:\/\/[^\s]+$/i.test(fields[name]))
            throw new Error('Les sites officiels doivent utiliser une URL HTTPS valide.');
        }
        if(fields.privacy_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.privacy_contact_email))
          throw new Error('Adresse de contact RGPD invalide.');
        const {error}=await db.from('consumer_legal_settings')
          .update({...fields,updated_at:new Date().toISOString()}).eq('id',true);
        if(error)throw error;
        status('Mentions publiques enregistrées. Vérifiez leur affichage avant de valider les CGP.');
        await load();
      }catch(e){status(e.message||'Enregistrement impossible.',true);}
      finally{working=false;button.disabled=false;}
    });
    host.querySelectorAll('[data-legal-status]').forEach(button=>button.onclick=async()=>{
      if(working)return;
      const card=button.closest('[data-withdrawal]');
      if(!card)return;
      working=true;button.disabled=true;
      try{
        const note=card.querySelector('[data-legal-note]').value.trim();
        const {error}=await db.from('consumer_withdrawal_requests')
          .update({review_status:button.dataset.legalStatus,review_note:note||null,reviewed_at:new Date().toISOString()})
          .eq('id',card.dataset.withdrawal);
        if(error)throw error;
        status('Dossier de rétractation mis à jour. Vérifiez séparément les remboursements et rendez-vous.');
        await load();
      }catch(e){status(e.message||'Mise à jour impossible.',true);}
      finally{working=false;button.disabled=false;}
    });
  }
  refresh.addEventListener('click',()=>load().catch(e=>status(e.message||'Données indisponibles.',true)));
  load().catch(e=>status(e.message||'Données indisponibles.',true));
})();