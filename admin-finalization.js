(() => {
  const A = () => window.EDMAdmin;

  async function ensureInvoice(order, invoiceNumber, dueDays) {
    const db = A().db;
    const externalId = `repair-order/${order.id}`;
    let { data: rows, error } = await db.from('invoices').select('id').eq('external_invoice_id', externalId).limit(1);
    if (error) throw error;
    let invoiceId = rows?.[0]?.id;

    if (!invoiceId) {
      const quoteResult = await db.from('quotes').select('id,title,description,subtotal,discount,total').eq('id', order.quote_id).single();
      if (quoteResult.error) throw quoteResult.error;
      const issuedAt = new Date();
      const dueAt = new Date(issuedAt.getTime() + dueDays * 86400000);
      const created = await db.from('invoices').insert({
        user_id: order.user_id,
        vehicle_id: order.vehicle_id,
        quote_id: order.quote_id,
        external_invoice_id: externalId,
        invoice_number: invoiceNumber,
        status: 'draft',
        title: quoteResult.data.title || 'Facture EDM AUTO',
        description: quoteResult.data.description,
        subtotal: Number(quoteResult.data.subtotal || 0),
        discount: Number(quoteResult.data.discount || 0),
        total: Number(quoteResult.data.total || 0),
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        visible_to_client: false
      }).select('id').single();
      if (created.error) throw created.error;
      invoiceId = created.data.id;
    }

    const itemCount = await db.from('invoice_items').select('id', { count: 'exact', head: true }).eq('invoice_id', invoiceId);
    if (itemCount.error) throw itemCount.error;
    if (!itemCount.count) {
      const quoteItems = await db.from('quote_items').select('id,item_type,description,quantity,unit_price,total,display_order').eq('quote_id', order.quote_id).order('display_order');
      if (quoteItems.error) throw quoteItems.error;
      const items = (quoteItems.data || []).map((item) => ({
        invoice_id: invoiceId,
        item_type: ['labor','part','delivery','discount','disbursement','other'].includes(item.item_type) ? item.item_type : 'other',
        description: item.description,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.total ?? Number(item.quantity || 1) * Number(item.unit_price || 0)),
        source_quote_item_id: item.id,
        display_order: item.display_order || 0
      }));
      if (!items.length) items.push({ invoice_id: invoiceId, item_type: 'labor', description: 'Prestations selon devis accepté', quantity: 1, unit_price: Number(order.quotes?.total || 0), line_total: Number(order.quotes?.total || 0), display_order: 0 });
      const inserted = await db.from('invoice_items').insert(items);
      if (inserted.error) throw inserted.error;
    }
    return invoiceId;
  }

  async function finalize(order, root) {
    const invoiceNumber = root.querySelector('[data-field="invoiceNumber"]').value.trim();
    const dueDays = Number(root.querySelector('[data-field="dueDays"]').value || 30);
    if (!invoiceNumber) throw new Error('Numéro de facture obligatoire.');
    if (!Number.isFinite(dueDays) || dueDays < 0 || dueDays > 365) throw new Error('Échéance comprise entre 0 et 365 jours.');
    if (!['ready','signed','in_progress','completed'].includes(order.status)) throw new Error('Ordre non clôturable.');

    if (order.status !== 'completed') {
      const completed = await A().db.from('repair_orders').update({ status: 'completed' }).eq('id', order.id).in('status', ['ready','signed','in_progress']).select('id');
      if (completed.error) throw completed.error;
      if (!completed.data?.length) throw new Error('L’ordre a déjà changé de statut.');
    }

    await ensureInvoice(order, invoiceNumber, dueDays);
    const invoiced = await A().db.from('repair_orders').update({ status: 'invoiced' }).eq('id', order.id).eq('status', 'completed').select('id');
    if (invoiced.error) throw invoiced.error;
    if (!invoiced.data?.length) throw new Error('Facture créée, mais statut atelier déjà modifié.');
  }

  function render(rows) {
    const host = A().$('finalizationList');
    host.innerHTML = rows.length ? rows.map((o) => `<article class="card" data-finalization-id="${o.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(o.status)}</span><h3>${A().esc(o.order_number || 'Ordre de réparation')}</h3></div><strong>${A().money(o.quotes?.total || 0)}</strong></div><p>${A().esc(o.profiles?.email || 'Client')} · ${A().esc(o.vehicles?.plate || 'Véhicule')}</p><label>Numéro de facture<input data-field="invoiceNumber" value="FAC-${A().esc((o.order_number || o.id).replace(/[^a-z0-9-]/gi, '-'))}"></label><label>Échéance (jours)<input data-field="dueDays" type="number" min="0" max="365" value="30"></label><button class="btn primary" data-finalize="${o.id}">Clôturer et créer la facture</button></article>`).join('') : '<p class="muted">Aucun ordre à facturer.</p>';
    host.querySelectorAll('[data-finalize]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const order = rows.find((row) => row.id === button.dataset.finalize); await finalize(order, button.closest('article')); A().status('finalizationStatus', 'Intervention clôturée et facture brouillon créée.'); await load(); await A().overview(); window.EDMAdminAccounting?.load(); }
      catch (error) { A().status('finalizationStatus', error.message || 'Clôture impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = A()?.$('finalizationList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('repair_orders').select('id,user_id,vehicle_id,quote_id,order_number,status,profiles(email),vehicles(plate),quotes(total)').in('status', ['ready','signed','in_progress','completed']).order('updated_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function bind() {
    document.querySelector('[data-page="finalization"]')?.addEventListener('click', () => load().catch((error) => A().status('finalizationStatus', error.message || 'Facturation indisponible.', true)));
    document.getElementById('finalizationRefresh')?.addEventListener('click', () => load().catch((error) => A().status('finalizationStatus', error.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminFinalization = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();