(() => {
  const A = () => window.EDMAdmin;
  const future = (v) => v && new Date(v) > new Date();

  async function prepare(q, root) {
    const startsAt = root.querySelector('[data-field="startsAt"]').value;
    const duration = Number(root.querySelector('[data-field="duration"]').value || 60);
    let orderNumber = root.querySelector('[data-field="orderNumber"]').value.trim();
    if (!future(startsAt)) throw new Error('Une date future est obligatoire.');
    if (!Number.isFinite(duration) || duration < 15 || duration > 480) throw new Error('Durée comprise entre 15 et 480 minutes.');
    if (!orderNumber) {
      const next = await A().db.rpc('next_document_number', { p_type: 'order' });
      if (next.error) throw next.error;
      orderNumber = next.data;
    }

    const externalId = `quote/${q.id}`;
    let { data: appointments, error } = await A().db.from('appointments').select('id').eq('external_appointment_id', externalId).limit(1);
    if (error) throw error;
    let appointmentId = appointments?.[0]?.id;
    if (!appointmentId) {
      const end = new Date(new Date(startsAt).getTime() + duration * 60000).toISOString();
      const created = await A().db.from('appointments').insert({
        user_id: q.user_id, vehicle_id: q.vehicle_id, service_request_id: q.service_request_id,
        external_appointment_id: externalId, starts_at: new Date(startsAt).toISOString(), ends_at: end,
        status: 'confirmed', notes: `Intervention liée au devis ${q.quote_number || q.id}`, visible_to_client: true
      }).select('id').single();
      if (created.error) throw created.error;
      appointmentId = created.data.id;
    }

    const existing = await A().db.from('repair_orders').select('id').eq('quote_id', q.id).limit(1);
    if (existing.error) throw existing.error;
    if (!existing.data?.length) {
      const request = await A().db.from('service_requests').select('services').eq('id', q.service_request_id).maybeSingle();
      if (request.error) throw request.error;
      const created = await A().db.from('repair_orders').insert({
        user_id: q.user_id, vehicle_id: q.vehicle_id, service_request_id: q.service_request_id,
        quote_id: q.id, appointment_id: appointmentId, order_number: orderNumber, status: 'ready',
        authorized_work: Array.isArray(request.data?.services) ? request.data.services : [], visible_to_client: true
      });
      if (created.error) throw created.error;
    }
  }

  function render(rows) {
    const host = A().$('operationList');
    host.innerHTML = rows.length ? rows.map((q) => `<article class="card" data-operation-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">Devis accepté</span><h3>${A().esc(q.quote_number || 'Devis')}</h3></div><strong>${A().money(q.total)}</strong></div><p>${A().esc(q.profiles?.email || 'Client')} · ${A().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Date et heure<input data-field="startsAt" type="datetime-local"></label><label>Durée (minutes)<input data-field="duration" type="number" min="15" max="480" step="15" value="60"></label><label>Numéro d’ordre<input data-field="orderNumber" placeholder="Généré automatiquement"></label><button class="btn primary" data-prepare="${q.id}">Planifier et préparer l’ordre</button></article>`).join('') : '<p class="muted">Aucun devis accepté à préparer.</p>';
    host.querySelectorAll('[data-prepare]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const q = rows.find((row) => row.id === button.dataset.prepare); await prepare(q, button.closest('article')); A().status('operationStatus', 'Rendez-vous confirmé et ordre de réparation préparé.'); await load(); await A().overview(); }
      catch (e) { A().status('operationStatus', e.message || 'Préparation impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = A()?.$('operationList'); if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('quotes').select('id,user_id,vehicle_id,service_request_id,quote_number,total,status,profiles(email),vehicles(plate)').eq('status', 'accepted').order('updated_at', { ascending: false });
    if (error) throw error;
    const { data: orders, error: orderError } = await A().db.from('repair_orders').select('quote_id');
    if (orderError) throw orderError;
    const done = new Set((orders || []).map((o) => o.quote_id));
    render((data || []).filter((q) => !done.has(q.id)));
  }
  function bind(){document.querySelector('[data-page="operations"]')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Atelier indisponible.',true)));document.getElementById('operationRefresh')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Actualisation impossible.',true)));}
  window.EDMAdminOperations={load}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();