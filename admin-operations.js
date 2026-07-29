(() => {
  const A = () => window.EDMAdmin;
  const future = (v) => v && new Date(v) > new Date();

  async function prepare(q, root) {
    const startsAt = root.querySelector('[data-field="startsAt"]').value;
    const duration = Number(q.labor_duration_minutes || root.querySelector('[data-field="duration"]').value || 0);
    let orderNumber = root.querySelector('[data-field="orderNumber"]').value.trim();
    if (!future(startsAt)) throw new Error('Une date future est obligatoire.');
    if (!Number.isFinite(duration) || duration < 15 || duration > 480) throw new Error('La durée du devis doit être comprise entre 15 et 480 minutes.');
    if (!orderNumber) {
      const next = await A().db.rpc('next_document_number', { p_type: 'order' });
      if (next.error) throw next.error;
      orderNumber = next.data;
    }
    const result = await A().db.rpc('admin_prepare_quote', {
      p_quote_id: q.id,
      p_starts_at: new Date(startsAt).toISOString(),
      p_duration_minutes: duration,
      p_order_number: orderNumber
    });
    if (result.error) throw result.error;
    return result.data;
  }

  function render(rows) {
    const host = A().$('operationList');
    host.innerHTML = rows.length ? rows.map((q) => `<article class="card" data-operation-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">Devis accepté</span><h3>${A().esc(q.quote_number || 'Devis')}</h3></div><strong>${A().money(q.total)}</strong></div><p>${A().esc(q.profiles?.email || 'Client')} · ${A().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Date et heure<input data-field="startsAt" type="datetime-local"></label><label>Durée du devis<input data-field="duration" type="number" min="15" max="480" step="15" value="${Number(q.labor_duration_minutes || 0)}" readonly></label><p class="muted">Temps bloqué : ${Number(q.labor_duration_minutes || 0) + 30} minutes, marge comprise.</p><label>Numéro d’ordre<input data-field="orderNumber" placeholder="Généré automatiquement"></label><button class="btn primary" data-prepare="${q.id}">Planifier et préparer l’ordre</button></article>`).join('') : '<p class="muted">Aucun devis accepté à préparer.</p>';
    host.querySelectorAll('[data-prepare]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const q = rows.find((row) => row.id === button.dataset.prepare);
        await prepare(q, button.closest('article'));
        A().status('operationStatus', 'Rendez-vous confirmé et ordre de réparation préparé.');
        await load();
        await A().overview();
      } catch (e) {
        A().status('operationStatus', e.message || 'Préparation impossible.', true);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function load() {
    const host = A()?.$('operationList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('quotes').select('id,user_id,vehicle_id,service_request_id,quote_number,total,status,labor_duration_minutes,profiles(email),vehicles(plate)').eq('status', 'accepted').order('updated_at', { ascending: false });
    if (error) throw error;
    const { data: orders, error: orderError } = await A().db.from('repair_orders').select('quote_id').neq('status','cancelled');
    if (orderError) throw orderError;
    const done = new Set((orders || []).map((o) => o.quote_id));
    render((data || []).filter((q) => !done.has(q.id) && Number(q.labor_duration_minutes || 0) >= 15));
  }

  function bind(){document.querySelector('[data-page="operations"]')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Atelier indisponible.',true)));document.getElementById('operationRefresh')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Actualisation impossible.',true)));}
  window.EDMAdminOperations={load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();