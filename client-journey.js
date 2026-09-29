(() => {
  async function install({client,getSession,signOut,esc,money,dateTime}) {
    const host=document.getElementById('edmInterventionsApp');
    if(!host)return;
    let generation=0, busy=false, timer=null, scrolled=false;
    const day=value=>new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    const dateInput=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const refusalUrl=q=>'mailto:contact@edm28.fr?subject='+encodeURIComponent('Motif du refus - devis '+(q.quote_number || 'EDM28'))+'&body='+encodeURIComponent('Bonjour,\n\nJe souhaite un nouveau devis. Voici le motif de mon refus :\n\n');
    const status=(root,text,error=false)=>{
      let node=root.querySelector('[data-journey-message]');
      if(!node){node=document.createElement('p');node.dataset.journeyMessage='';node.setAttribute('role','status');root.append(node);}
      node.className=error?'errorbox':'notice';node.textContent=text;
    };
    async function rpc(name,values){const r=await client.rpc(name,values);if(r.error)throw r.error;return r.data;}
    async function openFile(path,bucket='repair-documents') {
      if(!['repair-documents','purchase-proofs'].includes(bucket))throw new Error('Document indisponible.');
      const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
      try {const {data,error}=await client.storage.from(bucket).createSignedUrl(path,120);
        if(error || !data?.signedUrl)throw error || new Error('Document indisponible.');
        if(tab)tab.location.replace(data.signedUrl);else throw new Error('Autorisez l\u2019ouverture du document dans votre navigateur, puis r\u00e9essayez.');
      }catch(error){tab?.close();throw error;}
    }
    function files(g){
      const rows=[...g.quotes.map(q=>['Devis '+(q.quote_number||''),q.pdf_path]),...g.orders.map(o=>['Ordre de r\u00e9paration '+(o.order_number||''),o.pdf_path]),...g.invoices.map(i=>['Facture '+(i.invoice_number||''),i.pdf_path]),...g.inspections.map(i=>['Compte rendu du contr\u00f4le',i.pdf_path])];
      for(const i of g.inspections) for(const [index,p] of (Array.isArray(i.photo_paths)?i.photo_paths:[]).entries()) {const path=typeof p==='string'?p:p?.path;if(path)rows.push(['Photo '+(index+1),path]);}
      return '<div class="journey-files">'+rows.filter(([,path])=>path).map(([label,path])=>`<button class="text-action" type="button" data-file="${esc(path)}">${esc(label)}</button>`).join('')+'</div>';
    }
    function basket(q){
      const b=Array.isArray(q.quote_parts_baskets)?q.quote_parts_baskets[0]:q.quote_parts_baskets;
      if(!b?.requires_parts)return '';
      let url;try{url=window.EDMSupplierBasketPolicy.safeUrl(b.supplier_url);}catch(_){return '<p>Le lien du panier est indisponible. Contactez EDM28.</p>';}
      return `<details class="basket-details"><summary>Voir les pi\u00e8ces pr\u00e9conis\u00e9es et le panier</summary><p style="white-space:pre-wrap">${esc(b.recommended_parts)}</p>${b.price_details?`<p><strong>Prix indicatifs TTC${b.price_observed_at?' relev\u00e9s le '+esc(day(b.price_observed_at)):''}</strong></p><p style="white-space:pre-wrap">${esc(b.price_details)}</p>`:''}<p>Vous pouvez acheter ces m\u00eames r\u00e9f\u00e9rences sur un autre site. Les prix et la livraison d\u00e9pendent du vendeur. Toute autre r\u00e9f\u00e9rence doit \u00eatre valid\u00e9e par EDM28.</p><a class="primary-action as-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir mon panier fournisseur</a></details>`;
    }
    function card(g,archived=false){
      const q=g.quote,r=g.reservation,p=g.progress;
      const bp=Array.isArray(q.quote_parts_baskets)?q.quote_parts_baskets[0]:q.quote_parts_baskets;
      const needsParts=bp?.requires_parts !== false;
      let actions='';
      if(p.key==='quote')actions=`<p>Consultez le PDF avant de r\u00e9pondre.</p><div class="journey-actions"><button class="primary-action" data-response="accepted" data-quote="${esc(q.id)}" type="button">Accepter le devis</button><button class="secondary-action" data-response="refused" data-quote="${esc(q.id)}" type="button">Refuser le devis</button></div>`;
      if(['refused','expired'].includes(p.key))actions=`<p>Pour recevoir un nouveau devis, indiquez ${p.key==='refused'?'le motif de votre refus':'votre demande'} par email.</p><a href="${esc(refusalUrl(q))}">\u00c9crire \u00e0 EDM28</a>`;
      if(p.key==='choose')actions=`${r.review_note?`<p>${esc(r.review_note)}</p>`:''}<p>${needsParts ? 'Choisissez une date qui vous laisse le temps de recevoir les pi\u00e8ces. Le cr\u00e9neau sera gard\u00e9 48 h pour votre justificatif d\u2019achat.' : 'Choisissez une date. EDM28 v\u00e9rifiera votre demande sous 24 h ; aucun justificatif d\u2019achat n\u2019est requis.'}</p><button class="primary-action" type="button" data-planning="${esc(q.id)}" data-needs-parts="${needsParts}">Voir le planning</button><div data-planning-area></div>`;
      if(p.key==='held')actions=`<p>Cr\u00e9neau choisi : <strong>${esc(dateTime(r.starts_at))}</strong>.</p><p>Joignez votre justificatif avant le <strong>${esc(dateTime(r.expires_at))}</strong>. Sans justificatif, le cr\u00e9neau sera lib\u00e9r\u00e9. Le rendez-vous n\u2019est pas encore confirm\u00e9.</p><div class="journey-proof"><label>Joindre mon justificatif d\u2019achat<input type="file" data-proof-file accept="application/pdf,image/jpeg,image/png"></label><small>PDF, JPG ou PNG, 10 Mo maximum. Masquez les informations de paiement inutiles.</small><button class="primary-action" type="button" data-proof-submit="${esc(r.id)}">Envoyer pour validation sous 24 h</button></div>`;
      if(p.key==='review')actions=`<p>${r.proof_path ? 'Justificatif re\u00e7u.' : 'Aucun achat de pi\u00e8ce requis pour cette prestation.'} ${p.overdue?'La v\u00e9rification prend plus de temps que pr\u00e9vu. Votre cr\u00e9neau reste conserv\u00e9 ; contactez-nous en cas de besoin.':`EDM28 doit le v\u00e9rifier avant le ${esc(dateTime(r.review_deadline))}.`}</p><p>Vous recevrez un email apr\u00e8s validation. Date demand\u00e9e : ${esc(dateTime(r.starts_at))}.</p>`;
      if(p.key==='confirmed')actions=`<p>Votre rendez-vous est confirm\u00e9${r.starts_at?' le '+esc(dateTime(r.starts_at)):''}. Apportez les pi\u00e8ces indiqu\u00e9es dans le devis.</p><p>L\u2019ordre de r\u00e9paration d\u00e9crit les travaux pr\u00e9vus. Vous le retrouvez ci-dessous.</p>`;
      if(p.key==='finished')actions='<p>Merci de votre confiance. Vos documents restent disponibles dans l\u2019historique de ce v\u00e9hicule.</p>'+(archived?'':'<p>Cette intervention quittera la liste en cours au bout de 24 h.</p>');
      return `<article class="journey-card is-${p.tone}" data-case="${esc(g.id)}" data-quote-id="${esc(q.id||'')}"><p class="journey-status">${esc(archived?'Historique':p.label)}</p><h3>${esc(g.title)}</h3>${g.date?`<p>${esc(day(g.date))}</p>`:''}${q.id?`<p>Prestations EDM28 : <strong>${money(q.total)}</strong> \u2014 consommables compris, hors pi\u00e8ces.</p>`:''}${files(g)}${actions}${basket(q)}${r.proof_path?`<p><button class="text-action" type="button" data-file="${esc(r.proof_path)}" data-bucket="purchase-proofs">Mon justificatif d\u2019achat</button></p>`:''}<div data-journey-message role="status" aria-live="polite"></div></article>`;
    }
    async function showPlanning(button){
      const article=button.closest('[data-case]'),area=article.querySelector('[data-planning-area]');
      button.disabled=true;
      try {
        area.innerHTML=`<label>Afficher les dates \u00e0 partir du<input type="date" data-planning-date value="${dateInput()}" min="${dateInput()}"></label><div class="journey-slots" data-slot-list></div>`;
        const load=async()=>{
          const slots=await rpc('get_reservation_slots',{p_quote_id:button.dataset.planning,p_from:area.querySelector('input').value,p_days:30});
          const list=area.querySelector('[data-slot-list]');
          list.innerHTML=(slots||[]).map(s=>`<button type="button" data-slot="${esc(s.starts_at)}">${esc(dateTime(s.starts_at))}</button>`).join('') || '<p>Aucun cr\u00e9neau disponible sur ces dates. Choisissez une autre p\u00e9riode ou contactez EDM28.</p>';
          list.querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',async()=>{
            if(busy || !confirm(button.dataset.needsParts === 'false' ? 'Demander la validation de ce rendez-vous ? Aucune pi\u00e8ce de remplacement n\u2019est requise.' : 'Pr\u00e9-r\u00e9server ce cr\u00e9neau pendant 48 h ? Vous devrez transmettre votre justificatif d\u2019achat pour demander la confirmation.'))return;
            busy=true;b.disabled=true;
            try{await rpc('reserve_quote_slot',{p_quote_id:button.dataset.planning,p_starts_at:b.dataset.slot});await render();}
            catch(error){status(article,error.message||'Ce cr\u00e9neau n\u2019est plus disponible.',true);b.disabled=false;}
            finally{busy=false;}
          }));
        };
        area.querySelector('input').addEventListener('change',()=>load().catch(e=>status(article,e.message,true)));
        await load();
      }catch(error){status(article,error.message||'Planning indisponible.',true);}
      finally{button.disabled=false;}
    }
    async function sendProof(button){
      const article=button.closest('[data-case]'),file=article.querySelector('[data-proof-file]').files[0];
      if(!file)return status(article,'Choisissez votre justificatif d\u2019achat.',true);
      if(file.size<=0||file.size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type))return status(article,'Utilisez un PDF, un JPG ou un PNG de 10 Mo maximum.',true);
      const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
      const valid=file.type==='application/pdf'?String.fromCharCode(...bytes.slice(0,5))==='%PDF-':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.join(',')==='137,80,78,71,13,10,26,10';
      if(!valid)return status(article,'Le contenu du fichier ne correspond pas au format annonc\u00e9.',true);
      if(busy)return;busy=true;button.disabled=true;
      try{
        const session=await getSession();if(!session?.user)throw new Error('Reconnectez-vous avant de joindre le justificatif.');
        const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[file.type];
        const path=`${session.user.id}/${button.dataset.proofSubmit}/${crypto.randomUUID()}.${ext}`;
        const uploaded=await client.storage.from('purchase-proofs').upload(path,file,{contentType:file.type,upsert:false});
        if(uploaded.error)throw uploaded.error;
        await rpc('submit_reservation_proof',{p_reservation_id:button.dataset.proofSubmit,p_path:path});
        await render();
      }catch(error){status(article,error.message||'Justificatif non enregistr\u00e9. R\u00e9essayez.',true);}
      finally{busy=false;button.disabled=false;}
    }
    async function render(){
      const turn=++generation;
      const session=await getSession();
      if(turn!==generation)return;
      if(!session?.user){
        host.replaceChildren();
        const target=new URL('/demande',location.origin);target.searchParams.set('retour','interventions');
        const q=new URLSearchParams(location.search).get('devis');if(/^[0-9a-f-]{36}$/i.test(q||''))target.searchParams.set('devis',q);
        target.hash='connexion';location.replace(target.href);return;
      }
      const uid=session.user.id;
      const requests=[
        ['vehicles','id,plate,brand,model,year,energy,mileage,created_at'],
        ['service_requests','id,vehicle_id,status,services,notes,submitted_at,created_at'],
        ['quotes','id,vehicle_id,service_request_id,quote_number,status,title,total,pdf_path,created_at,valid_until,commercial_model,quote_parts_baskets(requires_parts,supplier_url,recommended_parts,price_details,price_observed_at)'],
        ['appointments','id,vehicle_id,service_request_id,starts_at,ends_at,status,created_at'],
        ['repair_orders','id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,pdf_path,created_at,updated_at,completed_at'],
        ['inspection_reports','id,vehicle_id,repair_order_id,report_number,observations,pdf_path,photo_paths,completed_at,created_at'],
        ['invoices','id,vehicle_id,quote_id,repair_order_id,invoice_number,status,total,pdf_path,issued_at,created_at'],
        ['interventions','id,repair_order_id,status,completed_at,client_summary,created_at'],
        ['booking_reservations','id,quote_id,user_id,vehicle_id,status,starts_at,ends_at,expires_at,proof_path,proof_received_at,review_deadline,review_note,created_at']
      ];
      const results=await Promise.all(requests.map(([table,columns])=>{
        let query=client.from(table).select(columns).eq('user_id',uid).order('created_at',{ascending:false});
        if(['quotes','appointments','repair_orders','inspection_reports','invoices'].includes(table))query=query.eq('visible_to_client',true);
        return query;
      }));
      if(turn!==generation)return;
      const failed=results.find(r=>r.error);if(failed)throw failed.error;
      const [vehicles,serviceRequests,quotes,appointments,orders,inspections,invoices,interventions,reservations]=results.map(r=>r.data||[]);
      const groups=window.EDMJourneyModel.group({requests:serviceRequests,quotes,appointments,orders,inspections,invoices,interventions,reservations});
      const active=groups.filter(g=>!g.progress.archived);
      const archiveVehicles=[...vehicles];
      if(groups.some(g=>g.progress.archived&&!vehicles.some(v=>v.id===g.vehicleId)))archiveVehicles.push({id:null,plate:'V\u00e9hicule non renseign\u00e9'});
      const archives=archiveVehicles.map(v=>{
        const list=groups.filter(g=>g.progress.archived&&(v.id?g.vehicleId===v.id:!vehicles.some(vehicle=>vehicle.id===g.vehicleId)));
        return `<details class="vehicle-archive"><summary>${esc([v.plate,v.brand,v.model].filter(Boolean).join(' \u00b7 '))} \u2014 ${list.length} intervention${list.length>1?'s':''}</summary><div class="archive-content">${list.map(g=>`<details class="intervention-archive"><summary>${esc(g.title)}${g.date?' \u2014 '+esc(day(g.date)):''}</summary>${card(g,true)}</details>`).join('')||'<p>Aucune intervention termin\u00e9e pour ce v\u00e9hicule.</p>'}</div></details>`;
      }).join('');
      host.innerHTML=`<section class="client-panel account-strip"><div><strong>${esc(session.user.email||'')}</strong><p>Votre espace client</p></div><div class="action-row"><a href="/demande" class="primary-action as-link">Nouvelle demande</a><button class="secondary-action" type="button" data-signout>Me d\u00e9connecter</button></div></section><section><h2>En cours</h2>${active.map(g=>{const v=vehicles.find(v=>v.id===g.vehicleId);return `<div>${v?`<p><strong>${esc([v.plate,v.brand,v.model].filter(Boolean).join(' \u00b7 '))}</strong></p>`:''}${card(g)}</div>`;}).join('')||'<p>Aucune intervention en cours.</p>'}</section><section><h2>Historique par v\u00e9hicule</h2><p>Ouvrez un v\u00e9hicule, puis une intervention pour retrouver ses documents.</p>${archives||'<p>Aucun v\u00e9hicule enregistr\u00e9.</p>'}</section>`;
      host.querySelector('[data-signout]').addEventListener('click',async()=>{await signOut();await render();});
      host.querySelectorAll('[data-file]').forEach(b=>b.addEventListener('click',()=>openFile(b.dataset.file,b.dataset.bucket).catch(e=>status(b.closest('article'),e.message,true))));
      host.querySelectorAll('[data-response]').forEach(b=>b.addEventListener('click',async()=>{
        if(busy||!confirm(b.dataset.response==='accepted'?'Confirmez-vous avoir lu et accepter ce devis ?':'Confirmez-vous le refus de ce devis ?'))return;
        busy=true;b.disabled=true;
        try{await rpc('client_respond_quote',{p_quote_id:b.dataset.quote,p_response:b.dataset.response});await render();}
        catch(e){status(b.closest('article'),e.message||'R\u00e9ponse non enregistr\u00e9e.',true);}
        finally{busy=false;b.disabled=false;}
      }));
      host.querySelectorAll('[data-planning]').forEach(b=>b.addEventListener('click',()=>void showPlanning(b)));
      host.querySelectorAll('[data-proof-submit]').forEach(b=>b.addEventListener('click',()=>void sendProof(b)));
      const target=new URLSearchParams(location.search).get('devis');
      if(!scrolled && /^[0-9a-f-]{36}$/i.test(target||'')){host.querySelector(`[data-quote-id="${target}"]`)?.scrollIntoView({block:'start'});scrolled=true;}
      clearTimeout(timer);
      const autoRefresh=()=>{
        const editing=host.querySelector('input:focus, details[open], [data-slot]') || [...host.querySelectorAll('[data-proof-file]')].some(input=>input.files?.length);
        if(!busy && !editing)render().catch(()=>{});else timer=setTimeout(autoRefresh,60000);
      };
      timer=setTimeout(autoRefresh,60000);
    }
    const refresh=()=>render().catch(error=>{host.innerHTML='<section class="client-panel"><p class="errorbox">'+esc(error.message||'Vos interventions ne peuvent pas \u00eatre charg\u00e9es. Rechargez la page.')+'</p></section>';});
    await refresh();
    client.auth.onAuthStateChange(()=>setTimeout(()=>void refresh(),0));
  }
  window.EDMClientJourney={install};
})();
