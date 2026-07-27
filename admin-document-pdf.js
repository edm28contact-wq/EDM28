(() => {
  const A = () => window.EDMAdmin;
  const typeLabels = { quote: 'DEVIS', order: 'ORDRE DE RÉPARATION', inspection: 'FICHE DE CONTRÔLE', invoice: 'FACTURE' };
  const number = (type, row) => type === 'quote' ? row.quote_number : type === 'order' ? row.order_number : type === 'inspection' ? row.report_number : row.invoice_number;
  const tableFor = (type) => type === 'quote' ? 'quotes' : type === 'order' ? 'repair_orders' : type === 'inspection' ? 'inspection_reports' : 'invoices';

  async function business() {
    const result = await A().db.from('business_configuration').select('*').eq('id', true).single();
    if (result.error) throw result.error;
    return result.data || {};
  }

  async function one(table, id) {
    if (!id) return null;
    const result = await A().db.from(table).select('*').eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function many(table, foreignKey, id) {
    if (!id) return [];
    const result = await A().db.from(table).select('*').eq(foreignKey, id).order('display_order', { ascending: true });
    if (result.error) throw result.error;
    return result.data || [];
  }

  function serviceNames(request) {
    return (Array.isArray(request?.services) ? request.services : [])
      .map((service) => typeof service === 'string' ? service : service?.name || service?.label || service?.id)
      .filter(Boolean);
  }

  function requestSummary(request) {
    if (!request) return '';
    const parts = [];
    if (request.notes) parts.push(String(request.notes).trim());
    const names = serviceNames(request);
    if (names.length) parts.push(`Prestations demandées : ${names.join(', ')}`);
    if (request.selected_basket) parts.push(`Gamme choisie : ${String(request.selected_basket).toUpperCase()}`);
    if (request.j7_accepted === true) parts.push('Contrôle complémentaire accepté');
    if (request.refuse_control === true) parts.push('Contrôle complémentaire refusé');
    return [...new Set(parts.filter(Boolean))].join(' — ');
  }

  function combine(...values) {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].join(' — ');
  }

  async function hydrate(type, seed) {
    const base = await one(tableFor(type), seed?.id) || seed || {};
    const [profile, vehicle] = await Promise.all([
      one('profiles', base.user_id),
      one('vehicles', base.vehicle_id)
    ]);
    const common = {
      ...base,
      profiles: profile || base.profiles || base.customer_snapshot || null,
      vehicles: vehicle || base.vehicles || base.vehicle_snapshot || null
    };

    if (type === 'quote') {
      const [request, items] = await Promise.all([
        one('service_requests', base.service_request_id),
        many('quote_items', 'quote_id', base.id)
      ]);
      const summary = requestSummary(request);
      return {
        ...common,
        service_requests: request,
        quote_items: items,
        title: base.title || serviceNames(request).join(' - ') || 'Devis EDM28',
        description: combine(base.description, summary)
      };
    }

    if (type === 'order') {
      const [request, appointment, quote] = await Promise.all([
        one('service_requests', base.service_request_id),
        one('appointments', base.appointment_id),
        one('quotes', base.quote_id)
      ]);
      const summary = requestSummary(request);
      const requestedWork = serviceNames(request);
      return {
        ...common,
        service_requests: request,
        appointments: appointment,
        quotes: quote,
        customer_request: combine(summary, quote?.description),
        authorized_work: Array.isArray(base.authorized_work) && base.authorized_work.length ? base.authorized_work : requestedWork
      };
    }

    if (type === 'invoice') {
      const [items, quote] = await Promise.all([
        many('invoice_items', 'invoice_id', base.id),
        one('quotes', base.quote_id)
      ]);
      const request = quote?.service_request_id ? await one('service_requests', quote.service_request_id) : null;
      const summary = requestSummary(request);
      return {
        ...common,
        quotes: quote ? { ...quote, service_requests: request } : null,
        service_requests: request,
        invoice_items: items,
        title: base.title || quote?.title || serviceNames(request).join(' - ') || 'Facture EDM28',
        description: combine(base.description, quote?.description, summary)
      };
    }

    const order = await one('repair_orders', base.repair_order_id);
    const request = order?.service_request_id ? await one('service_requests', order.service_request_id) : null;
    const liveProfile = profile || (order?.user_id ? await one('profiles', order.user_id) : null);
    const liveVehicle = vehicle || (order?.vehicle_id ? await one('vehicles', order.vehicle_id) : null);
    return {
      ...common,
      profiles: liveProfile || base.customer_snapshot || null,
      vehicles: liveVehicle || base.vehicle_snapshot || null,
      repair_orders: order,
      service_requests: request,
      customer_request: combine(base.customer_request, requestSummary(request), order?.visible_condition)
    };
  }

  async function generate(type, row, cfg) {
    if (!window.EDMPdfLite?.buildDocument) throw new Error('Le moteur des modèles PDF EDM28 n’est pas chargé. Rechargez le back-office.');
    if (!typeLabels[type]) throw new Error('Type de document PDF inconnu.');
    const complete = await hydrate(type, row);
    const blob = window.EDMPdfLite.buildDocument(type, { cfg, row: complete });
    const path = `${complete.user_id}/${type}/${complete.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
    const saved = await A().db.from(tableFor(type)).update({ pdf_path: path }).eq('id', complete.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from('repair-documents').remove([path]);
      throw saved.error || new Error('Le document a été modifié pendant la génération.');
    }
    if (complete.pdf_path && complete.pdf_path !== path) A().db.storage.from('repair-documents').remove([complete.pdf_path]).catch(() => {});
    return path;
  }

  async function generateFor(type, row) {
    return generate(type, row, await business());
  }

  async function load() {
    const host = A()?.$('documentPdfList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const cfg = await business();
    const [quotes, orders, inspections, invoices] = await Promise.all([
      A().db.from('quotes').select('id,user_id,quote_number,status,pdf_path,created_at').in('status', ['sent','accepted','refused']).order('created_at', { ascending: false }),
      A().db.from('repair_orders').select('id,user_id,order_number,status,pdf_path,created_at').in('status', ['ready','signed','in_progress','completed','invoiced']).order('created_at', { ascending: false }),
      A().db.from('inspection_reports').select('id,user_id,report_number,status,pdf_path,created_at').in('status', ['draft','completed']).order('created_at', { ascending: false }),
      A().db.from('invoices').select('id,user_id,invoice_number,status,pdf_path,created_at').in('status', ['draft','issued','partially_paid','paid','overdue']).order('created_at', { ascending: false })
    ]);
    const failure = [quotes, orders, inspections, invoices].find((result) => result.error)?.error;
    if (failure) throw failure;
    const rows = [
      ...(quotes.data || []).map((row) => ({ type: 'quote', row })),
      ...(orders.data || []).map((row) => ({ type: 'order', row })),
      ...(inspections.data || []).map((row) => ({ type: 'inspection', row })),
      ...(invoices.data || []).map((row) => ({ type: 'invoice', row }))
    ];
    host.innerHTML = rows.map(({ type, row }) => `<article class="card" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(typeLabels[type])}</span><h3>${A().esc(number(type, row) || 'Sans numéro')}</h3><p class="muted">${A().esc(row.status)}</p></div><button class="btn primary" data-type="${type}" data-id="${row.id}">${row.pdf_path ? 'Régénérer' : 'Générer'} le modèle PDF EDM28</button></div></article>`).join('') || '<p class="muted">Aucun document disponible.</p>';
    host.querySelectorAll('[data-id]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const item = rows.find((entry) => entry.type === button.dataset.type && entry.row.id === button.dataset.id);
        await generate(item.type, item.row, cfg);
        A().status('documentPdfStatus', 'PDF EDM28 prérempli avec les informations entreprise, client, véhicule et demande.');
        await load();
      } catch (error) {
        A().status('documentPdfStatus', error.message || 'Génération impossible.', true);
      } finally {
        button.disabled = false;
      }
    });
  }

  function bind() {
    document.querySelector('[data-page="document-pdf"]')?.addEventListener('click', () => load().catch((error) => A().status('documentPdfStatus', error.message || 'Documents indisponibles.', true)));
    document.getElementById('documentPdfRefresh')?.addEventListener('click', () => load().catch((error) => A().status('documentPdfStatus', error.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminDocumentPdf = { load, generateFor };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();