(() => {
  const A = () => window.EDMAdmin;
  const checks = ['freins_avant','freins_arriere','disques','liquide_frein','flexibles','pneus','pressions','amortisseurs','rotules','silentblocs','roulements','geometrie'];
  const labels = {freins_avant:'Plaquettes avant',freins_arriere:'Plaquettes arrière',disques:'Disques',liquide_frein:'Liquide de frein',flexibles:'Flexibles',pneus:'Pneus',pressions:'Pressions',amortisseurs:'Amortisseurs',rotules:'Rotules',silentblocs:'Silentblocs',roulements:'Roulements',geometrie:'Géométrie'};
  const esc = (v) => A().esc(v ?? '');

  async function ensureReport(order) {
    const db = A().db;
    const existing = await db.from('inspection_reports').select('*').eq('repair_order_id', order.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
    const customer = order.profiles || {};
    const vehicle = order.vehicles || {};
    const quote = order.quotes || {};
    const request = order.service_requests || {};
    const payload = {
      repair_order_id: order.id, user_id: order.user_id, vehicle_id: order.vehicle_id,
      appointment_id: order.appointment_id || null,
      report_number: `CTRL-${String(order.order_number || order.id).replace(/^OR-?/i,'')}`,
      mileage: order.mileage_in ?? vehicle.mileage ?? null,
      customer_request: request.notes || '',
      customer_snapshot: { first_name: customer.first_name, last_name: customer.last_name, email: customer.email, phone: customer.phone },
      vehicle_snapshot: { plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year, energy: vehicle.energy, engine: vehicle.engine, mileage: vehicle.mileage },
      quote_snapshot: { id: quote.id, number: quote.quote_number, title: quote.title, description: quote.description, total: quote.total },
      checks: {}, status: 'draft'
    };
    const created = await db.from('inspection_reports').insert(payload).select('*').single();
    if (created.error) throw created.error;
    return created.data;
  }

  function checkEditor(report) {
    const values = report.checks || {};
    return checks.map((key) => `<div class="card" style="padding:10px;margin:8px 0"><strong>${labels[key]}</strong><div class="toolbar" data-check="${key}">${['conforme','surveiller','remplacer'].map((s) => `<button type="button" class="btn ${values[key]===s?'primary':'ghost'}" data-value="${s}">${s==='conforme'?'Conforme':s==='surveiller'?'À surveiller':'À remplacer'}</button>`).join('')}</div></div>`).join('');
  }

  function render(rows) {
    const host = A().$('interventionList');
    host.innerHTML = rows.length ? rows.map((o) => `<article class="card" data-order="${o.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${esc(o.status)}</span><h3>${esc(o.order_number || 'Intervention')}</h3><p>${esc([o.profiles?.first_name,o.profiles?.last_name].filter(Boolean).join(' ') || o.profiles?.email || 'Client')} · ${esc([o.vehicles?.brand,o.vehicles?.model,o.vehicles?.plate].filter(Boolean).join(' '))}</p></div><strong>${A().money(o.quotes?.total || 0)}</strong></div><div class="toolbar"><button class="btn primary" data-open="${o.id}">Ouvrir le dossier</button></div><div data-detail class="hidden"></div></article>`).join('') : '<p class="muted">Aucune intervention active.</p>';
    host.querySelectorAll('[data-open]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const order = rows.find((x) => x.id === button.dataset.open);
        const report = await ensureReport(order);
        const detail = button.closest('article').querySelector('[data-detail]');
        detail.classList.remove('hidden');
        detail.innerHTML = `<hr><h3>Dossier unique</h3><p><strong>Client :</strong> ${esc([order.profiles?.first_name,order.profiles?.last_name].filter(Boolean).join(' '))} · ${esc(order.profiles?.phone)} · ${esc(order.profiles?.email)}</p><p><strong>Véhicule :</strong> ${esc(order.vehicles?.brand)} ${esc(order.vehicles?.model)} · ${esc(order.vehicles?.plate)} · ${esc(order.vehicles?.mileage || '')} km</p><p><strong>Demande :</strong> ${esc(order.service_requests?.notes || 'Non renseignée')}</p><p><strong>Devis :</strong> ${esc(order.quotes?.quote_number)} · ${A().money(order.quotes?.total || 0)}</p><p><strong>Rendez-vous :</strong> ${order.appointments?.starts_at ? new Date(order.appointments.starts_at).toLocaleString('fr-FR') : 'À confirmer'}</p><h3>Fiche de contrôle mobile</h3><label>Kilométrage d'entrée<input data-mileage type="number" value="${report.mileage ?? ''}"></label><label>Technicien<input data-tech value="${esc(report.technician_name)}"></label>${checkEditor(report)}<label>Observations<textarea data-observations rows="4">${esc(report.observations)}</textarea></label><div class="toolbar"><button class="btn ghost" data-booking>Ouvrir Google Agenda</button><button class="btn primary" data-save-report>Enregistrer la fiche</button><button class="btn primary" data-complete-report>Terminer le contrôle</button></div>`;
        const state = {...(report.checks || {})};
        detail.querySelectorAll('[data-check] button').forEach((b) => b.onclick = () => { const group=b.parentElement; state[group.dataset.check]=b.dataset.value; group.querySelectorAll('button').forEach(x=>x.className=`btn ${x===b?'primary':'ghost'}`); });
        detail.querySelector('[data-booking]').onclick = async () => { const cfg=await A().db.from('business_configuration').select('booking_url').eq('id',true).single(); if(cfg.data?.booking_url) window.open(cfg.data.booking_url,'_blank','noopener'); else A().status('interventionStatus','Lien Google Agenda non configuré.',true); };
        const save = async (complete) => { const patch={mileage:Number(detail.querySelector('[data-mileage]').value)||null,technician_name:detail.querySelector('[data-tech]').value.trim()||null,observations:detail.querySelector('[data-observations]').value.trim()||null,checks:state,updated_at:new Date().toISOString()}; if(complete) Object.assign(patch,{status:'completed',completed_at:new Date().toISOString(),visible_to_client:true}); const r=await A().db.from('inspection_reports').update(patch).eq('id',report.id); if(r.error) throw r.error; A().status('interventionStatus',complete?'Contrôle terminé et visible dans le dossier client.':'Fiche de contrôle enregistrée.'); };
        detail.querySelector('[data-save-report]').onclick=()=>save(false).catch(e=>A().status('interventionStatus',e.message,true));
        detail.querySelector('[data-complete-report]').onclick=()=>save(true).catch(e=>A().status('interventionStatus',e.message,true));
      } catch(e) { A().status('interventionStatus',e.message||'Dossier indisponible.',true); }
      finally { button.disabled=false; }
    });
  }

  async function load() {
    const host=A()?.$('interventionList'); if(!host) return; host.innerHTML='<p class="muted">Chargement…</p>';
    const {data,error}=await A().db.from('repair_orders').select('id,user_id,vehicle_id,appointment_id,order_number,status,mileage_in,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quotes(id,quote_number,title,description,total),service_requests(notes,services),appointments(starts_at,ends_at,status)').in('status',['ready','signed','in_progress','completed','invoiced']).order('updated_at',{ascending:false});
    if(error) throw error; render(data||[]);
  }
  function bind(){document.querySelector('[data-page="interventions"]')?.addEventListener('click',()=>load().catch(e=>A().status('interventionStatus',e.message,true)));document.getElementById('interventionRefresh')?.addEventListener('click',()=>load().catch(e=>A().status('interventionStatus',e.message,true)));}
  window.EDMAdminInterventions={load}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();