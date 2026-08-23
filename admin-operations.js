(() => {
  const A = () => window.EDMAdmin;
  const future = (v) => v && new Date(v) > new Date();
  const localInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

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

  async function publishPreparedOrder(orderId) {
    if (!orderId) throw new Error('Ordre de réparation introuvable après préparation.');
    const current = await A().db.from('repair_orders')
      .select('id,user_id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,pdf_path,visible_to_client,mileage_in,visible_condition,customer_items,authorized_work')
      .eq('id', orderId)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new Error('Ordre de réparation introuvable après préparation.');

    let pdfPath = current.data.pdf_path || '';
    if (!pdfPath) {
      pdfPath = await window.EDMAdminDocumentPdf?.generateFor('order', current.data);
      if (!pdfPath) throw new Error('Le PDF de l’ordre de réparation n’a pas pu être généré.');
    }

    const visible = await A().db.from('repair_orders')
      .update({ visible_to_client: true, pdf_path: pdfPath, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'ready')
      .select('id');
    if (visible.error || !visible.data?.length) throw visible.error || new Error('Publication de l’OR impossible.');
    return pdfPath;
  }

  function render(rows) {
    const host = A().$('operationList');
    host.innerHTML = rows.length ? rows.map((q) => {
      const pending = q.pending_order || null;
      const startsAt = pending?.appointments?.starts_at || '';
      const orderNumber = pending?.order_number || '';
      const action = pending
        ? `<button class="btn primary" data-publish-ready="${pending.id}">Finaliser et publier l’OR</button>`
        : `<button class="btn primary" data-prepare="${q.id}">Planifier et préparer l’ordre</button>`;
      const note = pending
        ? '<p class="muted">Le rendez-vous est déjà réservé. Finalisez ici la préparation et publiez l’OR au client.</p>'
        : `<p class="muted">Temps bloqué : ${Number(q.labor_duration_minutes || 0) + 30} minutes, marge comprise.</p>`;
      return `<article class="card" data-operation-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">Devis accepté</span><h3>${A().esc(q.quote_number || 'Devis')}</h3></div><strong>${A().money(q.total)}</strong></div><p>${A().esc(q.profiles?.email || 'Client')} · ${A().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Date et heure<input data-field="startsAt" type="datetime-local" value="${A().esc(localInput(startsAt))}"${pending ? ' readonly' : ''}></label><label>Durée du devis<input data-field="duration" type="number" min="15" max="480" step="15" value="${Number(q.labor_duration_minutes || 0)}" readonly></label>${note}<label>Numéro d’ordre<input data-field="orderNumber" placeholder="Généré automatiquement" value="${A().esc(orderNumber)}"${pending ? ' readonly' : ''}></label>${action}</article>`;
    }).join('') : '<p class="muted">Aucun devis accepté à préparer.</p>';

    host.querySelectorAll('[data-prepare]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const q = rows.find((row) => row.id === button.dataset.prepare);
        const prepared = await prepare(q, button.closest('article'));
        await publishPreparedOrder(prepared?.repair_order_id);
        A().status('operationStatus', 'Rendez-vous confirmé, ordre de réparation préparé et PDF publié au client.');
        await load();
        await A().overview();
      } catch (e) {
        A().status('operationStatus', e.message || 'Préparation impossible.', true);
      } finally {
        button.disabled = false;
      }
    });

    host.querySelectorAll('[data-publish-ready]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        await publishPreparedOrder(button.dataset.publishReady);
        A().status('operationStatus', 'Ordre de réparation finalisé et PDF publié au client.');
        await load();
        await A().overview();
      } catch (e) {
        A().status('operationStatus', e.message || 'Publication de l’OR impossible.', true);
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
    const { data: orders, error: orderError } = await A().db.from('repair_orders')
      .select('id,quote_id,order_number,status,visible_to_client,pdf_path,appointments(starts_at,ends_at,status)')
      .neq('status', 'cancelled');
    if (orderError) throw orderError;

    const orderByQuote = new Map();
    (orders || []).forEach((order) => {
      if (!orderByQuote.has(order.quote_id)) orderByQuote.set(order.quote_id, order);
    });

    const pendingRows = (data || []).filter((q) => {
      if (Number(q.labor_duration_minutes || 0) < 15) return false;
      const order = orderByQuote.get(q.id);
      if (!order) return true;
      if (order.status !== 'ready') return false;
      return !order.visible_to_client || !order.pdf_path;
    }).map((q) => ({ ...q, pending_order: orderByQuote.get(q.id) || null }));

    render(pendingRows);
  }

  function bind(){document.querySelector('[data-page="operations"]')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Atelier indisponible.',true)));document.getElementById('operationRefresh')?.addEventListener('click',()=>load().catch(e=>A().status('operationStatus',e.message||'Actualisation impossible.',true)));}
  window.EDMAdminOperations={load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
