(() => {
  const A = () => window.EDMAdmin;
  const typeLabels = { quote: 'DEVIS', order: 'ORDRE DE RÉPARATION', inspection: 'FICHE DE CONTRÔLE', invoice: 'FACTURE' };
  const money = (v) => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const date = (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '—';
  const text = (value) => String(value ?? '').trim();
  const line = (textValue, bold = false, size = 10, gap = 0, indent = 0) => ({ text: textValue, bold, size, gap, indent });
  const number = (type, r) => type === 'quote' ? r.quote_number : type === 'order' ? r.order_number : type === 'inspection' ? r.report_number : r.invoice_number;
  const customerName = (r) => [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(' ') || r.profiles?.email || 'Client';
  const vehicleName = (r) => [r.vehicles?.brand, r.vehicles?.model, r.vehicles?.year, r.vehicles?.plate].filter(Boolean).join(' · ') || 'Véhicule';

  async function business() {
    const result = await A().db.from('business_configuration').select('*').eq('id', true).single();
    if (result.error) throw result.error;
    return result.data || {};
  }

  function header(cfg, type, row) {
    const address = [cfg.address_line1, cfg.address_line2, [cfg.postal_code, cfg.city].filter(Boolean).join(' '), cfg.country].filter(Boolean).join(' · ');
    return [
      line(cfg.business_name || 'EDM28', true, 18, 0),
      line(cfg.legal_name || '', false, 9),
      line(address, false, 9),
      line([cfg.phone, cfg.email, cfg.website].filter(Boolean).join(' · '), false, 9),
      line([cfg.siret ? `SIRET ${cfg.siret}` : '', cfg.vat_number ? `TVA ${cfg.vat_number}` : cfg.vat_status || ''].filter(Boolean).join(' · '), false, 9),
      line(typeLabels[type], true, 16, 16),
      line(`Numéro : ${number(type, row) || 'Non attribué'} · Date : ${date(row.issued_at || row.completed_at || row.created_at || new Date())}`, true, 10)
    ];
  }

  function customerVehicle(row) {
    return [
      line('CLIENT', true, 12, 14),
      line(customerName(row)),
      line([row.profiles?.phone, row.profiles?.email].filter(Boolean).join(' · ')),
      line('VÉHICULE', true, 12, 12),
      line(vehicleName(row)),
      line([row.vehicles?.energy, row.vehicles?.engine, row.vehicles?.mileage ? `${Number(row.vehicles.mileage).toLocaleString('fr-FR')} km` : ''].filter(Boolean).join(' · '))
    ];
  }

  function tableLines(items, totalField = 'total') {
    const rows = [line('DÉTAIL', true, 12, 14)];
    (items || []).forEach((item, index) => {
      const qty = Number(item.quantity || 1);
      const unit = Number(item.unit_price || 0);
      const rate = Number(item.vat_rate || 0);
      const total = Number(item[totalField] ?? item.line_total ?? qty * unit);
      rows.push(line(`${index + 1}. ${text(item.designation || item.description || 'Ligne')}`, true));
      if (item.supplier_reference) rows.push(line(`Référence : ${item.supplier_reference}`, false, 9, 0, 2));
      if (item.description && item.description !== item.designation) rows.push(line(item.description, false, 9, 0, 2));
      rows.push(line(`Quantité ${qty} · PU HT ${money(unit)} · TVA ${rate}% · Total HT ${money(total)}`, false, 9, 0, 2));
    });
    return rows;
  }

  function totals(row, items) {
    const subtotal = Number(row.subtotal ?? (items || []).reduce((sum, x) => sum + Number(x.total ?? x.line_total ?? 0), 0));
    const vat = (items || []).reduce((sum, x) => sum + Number(x.total ?? x.line_total ?? 0) * Number(x.vat_rate || 0) / 100, 0);
    return [
      line('TOTAUX', true, 12, 14),
      line(`Total HT : ${money(subtotal)}`),
      line(`TVA : ${money(vat)}`),
      line(`Remise : ${money(row.discount || 0)}`),
      line(`Total TTC : ${money(row.total || subtotal + vat)}`, true, 12)
    ];
  }

  function footer(cfg) {
    return [
      line('CONDITIONS', true, 12, 16),
      line(cfg.payment_terms || 'Conditions de paiement non renseignées.'),
      line(cfg.late_penalty_text || ''),
      line(cfg.recovery_fee_text || ''),
      line(cfg.iban ? `IBAN : ${cfg.iban}${cfg.bic ? ` · BIC : ${cfg.bic}` : ''}` : ''),
      line('Document généré depuis le back-office EDM28.', false, 8, 16)
    ].filter((x) => x.text);
  }

  function quoteContent(cfg, row) {
    return [...header(cfg, 'quote', row), ...customerVehicle(row), line(row.title || 'Devis', true, 12, 14), line(row.description || ''), ...tableLines(row.quote_items), ...totals(row, row.quote_items), line(`Valable jusqu’au : ${date(row.valid_until)}`, true, 10, 12), ...footer(cfg)];
  }

  function orderContent(cfg, row) {
    const works = Array.isArray(row.authorized_work) ? row.authorized_work : [];
    const out = [...header(cfg, 'order', row), ...customerVehicle(row)];
    if (row.mileage_in != null) out.push(line(`Kilométrage d’entrée : ${Number(row.mileage_in).toLocaleString('fr-FR')} km`, true, 10, 14));
    if (row.visible_condition) out.push(line(`État visible : ${row.visible_condition}`));
    if (row.customer_items) out.push(line(`Objets laissés dans le véhicule : ${row.customer_items}`));
    out.push(line('TRAVAUX AUTORISÉS', true, 12, 14));
    works.forEach((work, index) => out.push(line(`${index + 1}. ${work.name || work.id || work}`)));
    out.push(line('Signature client : ______________________________', false, 10, 24));
    return [...out, ...footer(cfg)];
  }

  function inspectionContent(cfg, row) {
    const c = row.customer_snapshot || {};
    const v = row.vehicle_snapshot || {};
    const customer = { ...row, profiles: c, vehicles: v };
    const labels = { conforme: 'Conforme', surveiller: 'À surveiller', remplacer: 'À remplacer' };
    const out = [...header(cfg, 'inspection', row), ...customerVehicle(customer)];
    out.push(line(`Kilométrage : ${row.mileage ? `${Number(row.mileage).toLocaleString('fr-FR')} km` : '—'}`, true, 10, 14));
    out.push(line(`Technicien : ${row.technician_name || '—'}`));
    out.push(line(`Demande client : ${row.customer_request || '—'}`));
    out.push(line('RÉSULTATS DU CONTRÔLE', true, 12, 14));
    Object.entries(row.checks || {}).forEach(([key, value]) => out.push(line(`${key.replaceAll('_', ' ')} : ${labels[value] || value}`)));
    if (row.observations) out.push(line('OBSERVATIONS', true, 12, 14), line(row.observations));
    if (Array.isArray(row.photo_paths) && row.photo_paths.length) out.push(line(`${row.photo_paths.length} photo(s) associée(s) au dossier.`, false, 9, 12));
    out.push(line('Signature : ______________________________', false, 10, 24));
    return [...out, ...footer(cfg)];
  }

  function invoiceContent(cfg, row) {
    const remaining = Math.max(0, Number(row.total || 0) - Number(row.amount_paid || 0));
    return [...header(cfg, 'invoice', row), ...customerVehicle(row), line(row.title || 'Facture', true, 12, 14), line(row.description || ''), ...tableLines(row.invoice_items, 'line_total'), ...totals(row, row.invoice_items), line(`Réglé : ${money(row.amount_paid || 0)} · Reste à payer : ${money(remaining)}`, true, 10, 12), line(`Échéance : ${date(row.due_at)}`), ...footer(cfg)];
  }

  async function generate(type, row, cfg) {
    const builders = { quote: quoteContent, order: orderContent, inspection: inspectionContent, invoice: invoiceContent };
    const path = `${row.user_id}/${type}/${row.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, EDMPdfLite.build(builders[type](cfg, row)), { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
    const table = type === 'quote' ? 'quotes' : type === 'order' ? 'repair_orders' : type === 'inspection' ? 'inspection_reports' : 'invoices';
    const saved = await A().db.from(table).update({ pdf_path: path }).eq('id', row.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from('repair-documents').remove([path]);
      throw saved.error || new Error('Le document a été modifié pendant la génération.');
    }
  }

  async function load() {
    const host = A()?.$('documentPdfList'); if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const cfg = await business();
    const [quotes, orders, inspections, invoices] = await Promise.all([
      A().db.from('quotes').select('id,user_id,quote_number,status,title,description,subtotal,discount,total,valid_until,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quote_items(item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,total,display_order)').in('status', ['sent','accepted','refused']).order('created_at', { ascending: false }),
      A().db.from('repair_orders').select('id,user_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage)').in('status', ['ready','signed','in_progress','completed','invoiced']).order('created_at', { ascending: false }),
      A().db.from('inspection_reports').select('id,user_id,report_number,status,mileage,technician_name,customer_request,vehicle_snapshot,customer_snapshot,checks,observations,photo_paths,completed_at,pdf_path,created_at').in('status', ['draft','completed']).order('created_at', { ascending: false }),
      A().db.from('invoices').select('id,user_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),invoice_items(item_type,supplier_reference,description,quantity,unit_price,vat_rate,line_total,display_order)').in('status', ['draft','issued','partially_paid','paid','overdue']).order('created_at', { ascending: false })
    ]);
    const failure = [quotes, orders, inspections, invoices].find((r) => r.error)?.error;
    if (failure) throw failure;
    const rows = [
      ...(quotes.data || []).map((row) => ({ type: 'quote', row })),
      ...(orders.data || []).map((row) => ({ type: 'order', row })),
      ...(inspections.data || []).map((row) => ({ type: 'inspection', row })),
      ...(invoices.data || []).map((row) => ({ type: 'invoice', row }))
    ];
    host.innerHTML = rows.map(({ type, row }) => `<article class="card" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(typeLabels[type])}</span><h3>${A().esc(number(type, row) || 'Sans numéro')}</h3><p class="muted">${A().esc(row.status)}</p></div><button class="btn primary" data-type="${type}" data-id="${row.id}">${row.pdf_path ? 'Régénérer' : 'Générer'} le PDF complet</button></div></article>`).join('') || '<p class="muted">Aucun document disponible.</p>';
    host.querySelectorAll('[data-id]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const item = rows.find((x) => x.type === button.dataset.type && x.row.id === button.dataset.id);
        await generate(item.type, item.row, cfg);
        A().status('documentPdfStatus', 'PDF complet généré et stocké dans le coffre privé.');
        await load();
      } catch (error) {
        A().status('documentPdfStatus', error.message || 'Génération impossible.', true);
      } finally { button.disabled = false; }
    });
  }

  function bind() {
    document.querySelector('[data-page="document-pdf"]')?.addEventListener('click', () => load().catch((e) => A().status('documentPdfStatus', e.message || 'Documents indisponibles.', true)));
    document.getElementById('documentPdfRefresh')?.addEventListener('click', () => load().catch((e) => A().status('documentPdfStatus', e.message || 'Actualisation impossible.', true)));
  }
  window.EDMAdminDocumentPdf = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();