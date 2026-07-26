(() => {
  const A = () => window.EDMAdmin;
  const typeLabels = { quote: 'DEVIS', order: 'ORDRE DE RÉPARATION', inspection: 'FICHE DE CONTRÔLE', invoice: 'FACTURE' };
  const number = (type, row) => type === 'quote' ? row.quote_number : type === 'order' ? row.order_number : type === 'inspection' ? row.report_number : row.invoice_number;

  async function business() {
    const result = await A().db.from('business_configuration').select('*').eq('id', true).single();
    if (result.error) throw result.error;
    return result.data || {};
  }

  async function generate(type, row, cfg) {
    if (!window.EDMPdfLite?.buildDocument) throw new Error('Le moteur des modèles PDF EDM28 n’est pas chargé. Rechargez le back-office.');
    if (!typeLabels[type]) throw new Error('Type de document PDF inconnu.');
    const blob = window.EDMPdfLite.buildDocument(type, { cfg, row });
    const path = `${row.user_id}/${type}/${row.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
    const table = type === 'quote' ? 'quotes' : type === 'order' ? 'repair_orders' : type === 'inspection' ? 'inspection_reports' : 'invoices';
    const saved = await A().db.from(table).update({ pdf_path: path }).eq('id', row.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from('repair-documents').remove([path]);
      throw saved.error || new Error('Le document a été modifié pendant la génération.');
    }
    if (row.pdf_path && row.pdf_path !== path) A().db.storage.from('repair-documents').remove([row.pdf_path]).catch(() => {});
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
      A().db.from('quotes').select('id,user_id,quote_number,status,title,description,subtotal,discount,total,valid_until,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quote_items(item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,total,display_order)').in('status', ['sent','accepted','refused']).order('created_at', { ascending: false }),
      A().db.from('repair_orders').select('id,user_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),service_requests(notes),appointments(starts_at,ends_at,status)').in('status', ['ready','signed','in_progress','completed','invoiced']).order('created_at', { ascending: false }),
      A().db.from('inspection_reports').select('id,user_id,report_number,status,mileage,technician_name,customer_request,vehicle_snapshot,customer_snapshot,checks,observations,photo_paths,signature_path,completed_at,pdf_path,created_at').in('status', ['draft','completed']).order('created_at', { ascending: false }),
      A().db.from('invoices').select('id,user_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),invoice_items(item_type,supplier_reference,description,quantity,unit_price,vat_rate,line_total,display_order)').in('status', ['draft','issued','partially_paid','paid','overdue']).order('created_at', { ascending: false })
    ]);
    const failure = [quotes, orders, inspections, invoices].find((result) => result.error)?.error;
    if (failure) throw failure;
    const rows = [
      ...(quotes.data || []).map((row) => ({ type: 'quote', row })),
      ...(orders.data || []).map((row) => ({ type: 'order', row: { ...row, customer_request: row.service_requests?.notes } })),
      ...(inspections.data || []).map((row) => ({ type: 'inspection', row })),
      ...(invoices.data || []).map((row) => ({ type: 'invoice', row }))
    ];
    host.innerHTML = rows.map(({ type, row }) => `<article class="card" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(typeLabels[type])}</span><h3>${A().esc(number(type, row) || 'Sans numéro')}</h3><p class="muted">${A().esc(row.status)}</p></div><button class="btn primary" data-type="${type}" data-id="${row.id}">${row.pdf_path ? 'Régénérer' : 'Générer'} le modèle PDF EDM28</button></div></article>`).join('') || '<p class="muted">Aucun document disponible.</p>';
    host.querySelectorAll('[data-id]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const item = rows.find((entry) => entry.type === button.dataset.type && entry.row.id === button.dataset.id);
        await generate(item.type, item.row, cfg);
        A().status('documentPdfStatus', 'Modèle PDF EDM28 prérempli et stocké dans le coffre privé.');
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