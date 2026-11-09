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
      db.from('business_configuration').select('siren,siret,vat_status,vat_number,insurance_name,insurance_policy').eq('id',true).single(),
      db.from('consumer_legal_settings').select('mediator_name,mediator_postal_address,mediator_website,publication_director,host_name,host_postal_address,host_website,privacy_contact_email').eq('id',true).single()
    ]);
    if(error)throw error;
    if(businessError)throw businessError;
    if(legalError)throw legalError;
    const missing=[
      !business?.siret&&!business?.siren?'Immatriculation SIREN/SIRET':null,
      !business?.vat_status&&!business?.vat_number?'Régime TVA':null,
      !business?.insurance_name?'Assureur professionnel':null,
      !business?.insurance_policy?'Référence assurance':null
    ].filter(Boolean);
    host.innerHTML=
      '<div class="notice"><strong>Informations juridiques à vérifier :</strong> '+(missing.length?escape(missing.join(' · ')):'Données entreprise renseignées.')+
      (!legal?.mediator_name?' · Médiateur de consommation à renseigner.':'')+' Réviser les conditions avec un professionnel avant activation définitive.</div>'+
      '<p>Une déclaration reçue ne résilie pas automatiquement un rendez-vous ou une facture. Examiner les droits du consommateur et envoyer une réponse écrite. En cas d’échec de l’accusé par email, traiter la demande en priorité.</p>'+
      '<section class="card" style="margin:12px 0"><h3>Mentions légales publiques</h3><p>Indiquez uniquement les renseignements officiels vérifiés. Le médiateur doit être conventionné et inscrit sur la liste officielle. SIRET, TVA et assurance : compléter dans Informations entreprise.</p><div class="grid2" data-consumer-legal-fields>'+
      [['mediator_name','Nom du médiateur'],['mediator_postal_address','Adresse du médiateur'],['mediator_website','Site du médiateur (HTTPS)'],['publication_director','Directeur de publication'],['host_name','Hébergeur'],['host_postal_address','Adresse de l’hébergeur'],['host_website','Site de l’hébergeur (HTTPS)'],['privacy_contact_email','Contact RGPD (email)']].map(([key,label])=>'<label>'+escape(label)+'<input data-consumer-legal-field="'+escape(key)+'" value="'+escape(legal?.[key]||'')+'" maxlength="400"></label>').join('')+
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
    host.querySelector('[data-save-consumer-legal]')?.addEventListener('click',async(event)=>{
      if(working)return;working=true;event.currentTarget.disabled=true;
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
      finally{working=false;event.currentTarget.disabled=false;}
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