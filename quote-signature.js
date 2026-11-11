(() => {
  if (window.EDMQuoteSignature) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid = id => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id || '');
  let busy = false;
  async function action(client,quoteId,type,details={}) {
    const {data:{session},error} = await client.auth.getSession();
    if (error || !session?.access_token) throw new Error('Reconnectez-vous pour signer votre devis.');
    const response = await fetch('/api/sign-quote',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({action:type,quoteId,...details})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success!==true)throw new Error(result.error||'Signature indisponible.');
    return result;
  }
  async function sign(client,quoteId) {
    if (busy) return false;
    if (!client || !uuid(quoteId)) throw new Error('Devis invalide.');
    busy = true;
    let popup;
    try {
      const {data:{session}}=await client.auth.getSession();
      if (!session?.user) throw new Error('Connexion obligatoire.');
      const [qResult,pResult]=await Promise.all([
        client.from('quotes').select('id,quote_number,total,valid_until,pdf_path,status').eq('id',quoteId).eq('status','sent').single(),
        client.from('profiles').select('first_name,last_name').eq('id',session.user.id).single()
      ]);
      const quote=qResult.data,profile=pResult.data;
      if(qResult.error||!quote?.pdf_path)throw new Error('Devis non disponible.');
      if(pResult.error||!profile)throw new Error('Identité du signataire indisponible.');
      const {data:doc,error:docError}=await client.storage.from('repair-documents').createSignedUrl(quote.pdf_path,600);
      if(docError||!doc?.signedUrl)throw new Error('PDF du devis indisponible.');
      const name=[profile.first_name,profile.last_name].filter(Boolean).join(' ').trim();
      popup=document.createElement('div');
      popup.setAttribute('role','dialog');
      popup.setAttribute('aria-modal','true');
      popup.setAttribute('aria-label','Signer le devis EDM28');
      popup.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(7,18,33,.84);display:flex;align-items:center;justify-content:center;padding:12px';
      popup.innerHTML='<section style="width:min(940px,100%);height:min(95vh,870px);overflow:auto;background:white;color:#17212d;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center"><h2>Signer le devis '+esc(quote.quote_number||'EDM28')+'</h2><button type="button" data-qs-close>Fermer</button></div>'
        +'<p>Montant du devis : <strong>'+Number(quote.total).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+'</strong>. Vérifiez le PDF intégral avant de signer.</p>'
        +'<iframe title="Devis original à signer" style="width:100%;min-height:230px;flex:1;border:1px solid #bbb" src="'+esc(doc.signedUrl)+'"></iframe>'
        +'<a href="'+esc(doc.signedUrl)+'" target="_blank" rel="noopener noreferrer">Ouvrir le PDF dans un nouvel onglet</a>'
        +'<p>La signature repose sur votre compte et un code email à usage unique. Elle constitue une signature électronique simple avec dossier de preuve, et non une signature qualifiée eIDAS.</p>'
        +'<label>Prénom et nom<input type="text" data-qs-name maxlength="140" autocomplete="name" style="display:block;width:100%;padding:9px"></label>'
        +'<button type="button" data-qs-send>Recevoir mon code de signature par email</button>'
        +'<label>Code à huit chiffres<input type="text" data-qs-code inputmode="numeric" autocomplete="one-time-code" maxlength="8" disabled style="display:block;width:100%;padding:9px"></label>'
        +'<p><a href="/conditions-generales" target="_blank" rel="noopener noreferrer">Lire les conditions générales de prestations EDM28</a> · <a href="/retractation" target="_blank" rel="noopener noreferrer">Droit de rétractation</a></p>'
        +'<label><input type="checkbox" data-qs-consent> J’ai consulté le devis et les conditions contractuelles, j’accepte expressément les prestations et le prix indiqués, et je demande sa signature électronique.</label>'
        +'<p>Option distincte : <label><input type="checkbox" data-qs-early> Je demande expressément de commencer les travaux avant la fin des 14 jours.</label></p>'
        +'<p><label><input type="checkbox" data-qs-waiver> Je reconnais que la perte du droit de rétractation peut s’appliquer après exécution intégrale dans les conditions prévues par la loi.</label></p>'
        +'<button type="button" data-qs-confirm disabled>Signer le devis avec obligation de paiement</button>'
        +'<p role="status" aria-live="polite" data-qs-status></p></section>';
      document.body.append(popup);
      const $ = selector=>popup.querySelector(selector);
      $('[data-qs-name]').value=name;
      let started=false,finished=false;
      return await new Promise(resolve=>{
        const close=()=>{popup.remove();busy=false;resolve(finished);};
        $('[data-qs-close]').onclick=close;
        $('[data-qs-send]').onclick=async()=>{
          const button=$('[data-qs-send]');button.disabled=true;$('[data-qs-status]').textContent='Envoi du code…';
          try{const earlyStart=$('[data-qs-early]').checked;const lossAcknowledged=$('[data-qs-waiver]').checked;
            if(earlyStart&&!lossAcknowledged)throw new Error('Confirmez distinctement les conditions du démarrage anticipé.');
            await action(client,quoteId,'start',{earlyStart,lossAcknowledged});
            $('[data-qs-early]').disabled=true;$('[data-qs-waiver]').disabled=true;started=true;$('[data-qs-code]').disabled=false;$('[data-qs-confirm]').disabled=false;$('[data-qs-status]').textContent='Code envoyé, valable 10 minutes.';}
          catch(e){$('[data-qs-status]').textContent=e.message;button.disabled=false;}
        };
        $('[data-qs-confirm]').onclick=async()=>{
          if(!started||!$('[data-qs-consent]').checked){$('[data-qs-status]').textContent='Vous devez accepter explicitement le devis.';return;}
          const code=$('[data-qs-code]').value.trim();
          if(!/^[0-9]{8}$/.test(code)){$('[data-qs-status]').textContent='Le code contient huit chiffres.';return;}
          const button=$('[data-qs-confirm]');button.disabled=true;$('[data-qs-status]').textContent='Signature et conservation des preuves en cours…';
          try{
            await action(client,quoteId,'sign',{code,name:$('[data-qs-name]').value.trim(),consent:true});
            finished=true;window.dispatchEvent(new CustomEvent('edm:quote-signed',{detail:{quoteId}}));close();
          }catch(e){$('[data-qs-status]').textContent=e.message;button.disabled=false;}
        };
      });
    }catch(e){popup?.remove();busy=false;throw e;}
  }
  window.EDMQuoteSignature={sign};
})();