(() => {
  const A=()=>window.EDMAdmin;
  let loading=false;
  const when=v=>v?new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}):'';
  async function rpc(name,params){const r=await A().db.rpc(name,params);if(r.error)throw r.error;return r.data;}
  async function proof(path){
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    try{const {data,error}=await A().db.storage.from('purchase-proofs').createSignedUrl(path,120);if(error||!data?.signedUrl)throw error||new Error('Justificatif indisponible.');if(!tab)throw new Error('Autorisez l\u2019ouverture du justificatif.');tab.location.replace(data.signedUrl);}
    catch(e){tab?.close();throw e;}
  }
  async function load(){
    const page=document.getElementById('operations');if(!page||!A()?.db||loading)return;
    loading=true;
    let host=document.getElementById('reservationReview');
    if(!host){host=document.createElement('section');host.id='reservationReview';page.append(host);}
    try{
      const result=await A().db.from('booking_reservations').select('*,profiles:profiles!booking_reservations_user_id_fkey(email),vehicles(plate),quotes(quote_number,title,total,quote_parts_baskets(requires_parts,recommended_parts))').in('status',['held','review_pending']).order('created_at');
      if(result.error)throw result.error;
      const esc=A().esc;
      host.innerHTML='<h2>Rendez-vous \u00e0 valider</h2><p>V\u00e9rifiez les r\u00e9f\u00e9rences command\u00e9es et leur livraison avant de confirmer. La validation est attendue sous 24 h apr\u00e8s r\u00e9ception du justificatif.</p>'+(result.data||[]).map(r=>{
        const b=Array.isArray(r.quotes?.quote_parts_baskets)?r.quotes.quote_parts_baskets[0]:r.quotes?.quote_parts_baskets;
        return `<article class="card" data-reservation="${esc(r.id)}" style="margin:14px 0;padding:16px;border-left:4px solid #d77732;overflow-wrap:anywhere"><h3>${esc(r.quotes?.quote_number||'Devis')} - ${esc(r.vehicles?.plate||'V\u00e9hicule')}</h3><p>${esc(r.profiles?.email||'')}<br>${esc(r.quotes?.title||'')}<br><strong>${esc(when(r.starts_at))}</strong></p><p>${r.status==='held'?'En attente du justificatif, jusqu\u2019au '+esc(when(r.expires_at)):'V\u00e9rification attendue avant le '+esc(when(r.review_deadline))}</p><pre style="white-space:pre-wrap;font:inherit">${esc(b?.recommended_parts||'Aucune pi\u00e8ce de remplacement demand\u00e9e.')}</pre>${r.proof_path?'<button class="btn ghost" data-review-proof>Ouvrir le justificatif</button>':''}${r.status==='review_pending'?'<label style="display:block;margin:12px 0"><input type="checkbox" data-review-checked> J\u2019ai v\u00e9rifi\u00e9 les pi\u00e8ces et le d\u00e9lai de livraison.</label><button class="btn primary" data-review-confirm>Valider le rendez-vous et pr\u00e9parer l\u2019OR</button>':''}<button class="btn ghost" data-review-reject>Refuser et expliquer</button><p role="status" data-review-status></p></article>`;
      }).join('');
      if(!result.data?.length)host.insertAdjacentHTML('beforeend','<p>Aucune pr\u00e9-r\u00e9servation en attente.</p>');
      for(const node of host.querySelectorAll('[data-reservation]')){
        const row=result.data.find(r=>r.id===node.dataset.reservation),status=node.querySelector('[data-review-status]');
        const action=(button,fn)=>button?.addEventListener('click',async()=>{button.disabled=true;try{await fn();}catch(e){status.textContent=e.message||'Action non termin\u00e9e.';}finally{button.disabled=false;}});
        action(node.querySelector('[data-review-proof]'),()=>proof(row.proof_path));
        action(node.querySelector('[data-review-confirm]'),async()=>{
          if(!node.querySelector('[data-review-checked]').checked)throw new Error('V\u00e9rifiez les pi\u00e8ces et la livraison, puis cochez la case.');
          status.textContent='Pr\u00e9paration de l\u2019ordre de r\u00e9paration...';
          const id=await rpc('admin_prepare_reservation',{p_id:row.id});
          const order=await A().db.from('repair_orders').select('*').eq('id',id).single();if(order.error)throw order.error;
          const path=await window.EDMAdminDocumentPdf.generateFor('order',order.data);
          await rpc('admin_confirm_reservation',{p_id:row.id,p_pdf_path:path});
          status.textContent='Rendez-vous valid\u00e9. L\u2019OR est disponible pour le client ; l\u2019email est en attente d\u2019envoi.';
          await A().overview();await load();
        });
        action(node.querySelector('[data-review-reject]'),async()=>{
          const reason=prompt('Message au client : pourquoi le rendez-vous ne peut-il pas \u00eatre confirm\u00e9 ?');if(reason===null)return;
          await rpc('admin_reject_reservation',{p_id:row.id,p_reason:reason});await load();
        });
      }
    }catch(e){host.textContent=e.message||'R\u00e9servations indisponibles.';}finally{loading=false;}
  }
  function bind(){
    document.querySelector('[data-page="operations"]')?.addEventListener('click',()=>void load());
    document.getElementById('operationRefresh')?.addEventListener('click',()=>void load());
  }
  window.EDMAdminReservations={load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
