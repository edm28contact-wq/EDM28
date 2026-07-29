(() => {
  const A = () => window.EDMAdmin;
  const n = (v) => Number(v || 0);
  const money = (v) => A().money(n(v));
  const nearly = (a, b) => Math.abs(n(a) - n(b)) < 0.005;

  function invoiceLine(item = {}, locked = false) {
    const disabled = locked ? ' disabled' : '';
    return `<div class="card" data-invoice-line data-source-id="${A().esc(item.source_quote_item_id || '')}" style="padding:12px;margin:10px 0">
      <div class="grid2">
        <label>Type<select data-line="type"${disabled}>
          <option value="labor" ${item.item_type === 'labor' ? 'selected' : ''}>Main-d’œuvre</option>
          <option value="part" ${item.item_type === 'part' ? 'selected' : ''}>Pièce</option>
          <option value="delivery" ${item.item_type === 'delivery' ? 'selected' : ''}>Livraison</option>
          <option value="discount" ${item.item_type === 'discount' ? 'selected' : ''}>Remise</option>
          <option value="other" ${!['labor','part','delivery','discount'].includes(item.item_type) ? 'selected' : ''}>Autre</option>
        </select></label>
        <label>Référence<input data-line="reference" value="${A().esc(item.supplier_reference || '')}"${disabled}></label>
        <label>Désignation<input data-line="description" value="${A().esc(item.description || '')}"${disabled}></label>
        <label>Quantité<input data-line="quantity" type="number" min="0.01" step="0.01" value="${n(item.quantity) || 1}"${disabled}></label>
        <label>Prix unitaire HT<input data-line="unit_price" type="number" min="0" step="0.01" value="${n(item.unit_price)}"${disabled}></label>
        <label>TVA %<input data-line="vat_rate" type="number" min="0" max="100" step="0.1" value="${n(item.vat_rate)}"${disabled}></label>
        <label>Coût d’achat interne<input data-line="purchase_total" type="number" min="0" step="0.01" value="${n(item.purchase_total)}"${disabled}></label>
      </div>
      <div class="top"><span class="muted" data-line-total></span>${locked ? '' : '<button type="button" class="btn ghost" data-remove-line>Supprimer</button>'}</div>
    </div>`;
  }

  function readLines(root) {
    return [...root.querySelectorAll('[data-invoice-line]')].map((line, index) => {
      const quantity = n(line.querySelector('[data-line="quantity"]').value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]').value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]').value);
      const lineTotal = quantity * unitPrice;
      const purchaseTotal = n(line.querySelector('[data-line="purchase_total"]').value);
      return {
        item_type: line.querySelector('[data-line="type"]').value,
        supplier_reference: line.querySelector('[data-line="reference"]').value.trim() || null,
        description: line.querySelector('[data-line="description"]').value.trim(),
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        line_total: lineTotal,
        purchase_total: purchaseTotal,
        margin_amount: lineTotal - purchaseTotal,
        source_quote_item_id: line.dataset.sourceId || null,
        display_order: index
      };
    }).filter((line) => line.description && line.quantity > 0 && line.unit_price >= 0);
  }

  function totals(lines) {
    const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);
    const vat = lines.reduce((sum, line) => sum + line.line_total * n(line.vat_rate) / 100, 0);
    return { subtotal, vat, total: subtotal + vat };
  }

  function recalculate(root) {
    const lines = readLines(root);
    const result = totals(lines);
    root.querySelector('[data-total="subtotal"]').textContent = money(result.subtotal);
    root.querySelector('[data-total="vat"]').textContent = money(result.vat);
    root.querySelector('[data-total="total"]').textContent = money(result.total);
    root.querySelectorAll('[data-invoice-line]').forEach((line) => {
      const quantity = n(line.querySelector('[data-line="quantity"]').value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]').value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]').value);
      line.querySelector('[data-line-total]').textContent = `Total TTC ligne : ${money(quantity * unitPrice * (1 + vatRate / 100))}`;
    });
  }

  function compare(quoteItems, invoiceItems) {
    const actualBySource = new Map(invoiceItems.filter((item) => item.source_quote_item_id).map((item) => [item.source_quote_item_id, item]));
    const quoteById = new Map(quoteItems.map((item) => [item.id, item]));
    const rows = [];
    quoteItems.forEach((quoted) => {
      const actual = actualBySource.get(quoted.id);
      if (!actual) {
        rows.push({ quoted, actual: null, state: 'removed', label: 'Non réalisé' });
        return;
      }
      const changed = !nearly(quoted.quantity, actual.quantity) || !nearly(quoted.unit_price, actual.unit_price) || !nearly(quoted.vat_rate, actual.vat_rate) || String(quoted.description || quoted.designation || '') !== String(actual.description || '');
      rows.push({ quoted, actual, state: changed ? 'changed' : 'same', label: changed ? 'Modifié' : 'Identique' });
    });
    invoiceItems.filter((item) => !item.source_quote_item_id || !quoteById.has(item.source_quote_item_id)).forEach((actual) => rows.push({ quoted: null, actual, state: 'added', label: 'Ajouté' }));
    return rows;
  }

  function comparisonHtml(rows) {
    const varianceCount = rows.filter((row) => row.state !== 'same').length;
    const body = rows.map((row) => {
      const quotedTotal = row.quoted ? n(row.quoted.quantity) * n(row.quoted.unit_price) * (1 + n(row.quoted.vat_rate) / 100) : 0;
      const actualTotal = row.actual ? n(row.actual.quantity) * n(row.actual.unit_price) * (1 + n(row.actual.vat_rate) / 100) : 0;
      return `<tr><td>${A().esc(row.quoted?.designation || row.quoted?.description || '—')}</td><td>${row.quoted ? money(quotedTotal) : '—'}</td><td>${A().esc(row.actual?.description || '—')}</td><td>${row.actual ? money(actualTotal) : '—'}</td><td><span class="pill">${A().esc(row.label)}</span></td></tr>`;
    }).join('');
    return `<div class="tablewrap"><table class="table"><thead><tr><th>Prévu au devis</th><th>Montant prévu</th><th>Réel facturé</th><th>Montant réel</th><th>Écart</th></tr></thead><tbody>${body || '<tr><td colspan="5">Aucune ligne à comparer.</td></tr>'}</tbody></table></div>
      <p class="${varianceCount ? 'status error' : 'status ok'}">${varianceCount ? `${varianceCount} écart(s) à vérifier avant émission.` : 'Aucun écart entre le devis et la facture.'}</p>`;
  }

  async function saveDraft(invoice, root) {
    if (invoice.status !== 'draft') throw new Error('Seule une facture brouillon peut être modifiée.');
    const lines = readLines(root);
    if (!lines.length) throw new Error('Ajoutez au moins une ligne facturable.');
    const result = totals(lines);
    if (!(result.total > 0)) throw new Error('Le total de la facture doit être positif.');
    const oldPdf = invoice.pdf_path;
    const updated = await A().db.from('invoices').update({
      title: root.querySelector('[data-field="title"]').value.trim() || 'Facture EDM28',
      description: root.querySelector('[data-field="description"]').value.trim() || null,
      subtotal: result.subtotal,
      discount: 0,
      total: result.total,
      due_at: root.querySelector('[data-field="dueAt"]').value ? new Date(`${root.querySelector('[data-field="dueAt"]').value}T23:59:59`).toISOString() : null,
      pdf_path: null,
      updated_at: new Date().toISOString()
    }).eq('id', invoice.id).eq('status', 'draft').select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) throw new Error('La facture a déjà changé de statut.');
    const removed = await A().db.from('invoice_items').delete().eq('invoice_id', invoice.id);
    if (removed.error) throw removed.error;
    const inserted = await A().db.from('invoice_items').insert(lines.map((line) => ({ ...line, invoice_id: invoice.id })));
    if (inserted.error) throw inserted.error;
    if (oldPdf) A().db.storage.from('repair-documents').remove([oldPdf]).catch(() => {});
  }

  async function issue(invoice, root) {
    if (invoice.status !== 'draft') throw new Error('Facture déjà émise.');
    if (!invoice.pdf_path) throw new Error('Générez le PDF actualisé avant d’émettre la facture.');
    const varianceCount = Number(root.dataset.varianceCount || 0);
    if (varianceCount && !root.querySelector('[data-confirm-variance]').checked) throw new Error('Confirmez la vérification des écarts avec le devis.');
    const required = ['business_name','legal_name','siret','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text'];
    const business = await A().db.from('business_configuration').select('*').eq('id', true).single();
    if (business.error) throw business.error;
    const missing = required.filter((key) => !String(business.data?.[key] || '').trim());
    if (missing.length) throw new Error(`${missing.length} information(s) entreprise obligatoire(s) manquante(s).`);
    const updated = await A().db.from('invoices').update({ status: 'issued', visible_to_client: true, issued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', invoice.id).eq('status', 'draft').gt('total', 0).not('invoice_number', 'is', null).not('pdf_path', 'is', null).select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) throw new Error('Facture non émissible.');
  }

  async function pay(invoice, root) {
    const amount = n(root.querySelector('[data-field="amount"]').value);
    const paymentMethod = root.querySelector('[data-field="method"]').value;
    const reference = root.querySelector('[data-field="reference"]').value.trim() || null;
    const balance = Math.max(0, n(invoice.total) - n(invoice.amount_paid));
    if (!(amount > 0) || amount > balance) throw new Error('Montant invalide ou supérieur au solde.');
    const { error } = await A().db.from('payments').insert({ invoice_id: invoice.id, user_id: invoice.user_id, amount, payment_method: paymentMethod, reference });
    if (error) throw error;
  }

  function bindDraft(root) {
    const lines = root.querySelector('[data-lines]');
    root.querySelector('[data-add-line]').onclick = () => {
      lines.insertAdjacentHTML('beforeend', invoiceLine({ item_type: 'labor', quantity: 1, vat_rate: 0 }, false));
      bindDraft(root);
      recalculate(root);
    };
    root.querySelectorAll('[data-remove-line]').forEach((button) => button.onclick = () => { button.closest('[data-invoice-line]').remove(); recalculate(root); });
    root.querySelectorAll('[data-line]').forEach((input) => input.oninput = () => recalculate(root));
    recalculate(root);
  }

  function render(rows) {
    const host = A().$('invoiceActionList');
    host.innerHTML = rows.length ? rows.map((invoice) => {
      const balance = Math.max(0, n(invoice.total) - n(invoice.amount_paid));
      const draft = invoice.status === 'draft';
      const comparison = compare(invoice.quote_items || [], invoice.invoice_items || []);
      const varianceCount = comparison.filter((row) => row.state !== 'same').length;
      const clientName = [invoice.profiles?.first_name, invoice.profiles?.last_name].filter(Boolean).join(' ') || invoice.profiles?.email || 'Client';
      const vehicleName = [invoice.vehicles?.brand, invoice.vehicles?.model, invoice.vehicles?.plate].filter(Boolean).join(' · ') || 'Véhicule';
      const paymentForm = ['issued','partially_paid'].includes(invoice.status) && balance > 0 ? `<div class="toolbar"><input data-field="amount" type="number" min="0.01" max="${balance}" step="0.01" placeholder="Montant"><select data-field="method"><option value="card">Carte</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="check">Chèque</option></select><input data-field="reference" placeholder="Référence"><button class="btn primary" data-pay="${invoice.id}">Enregistrer le règlement</button></div>` : '';
      const draftActions = draft ? `<div class="toolbar"><button class="btn ghost" data-save="${invoice.id}">Enregistrer les modifications</button><button class="btn ghost" data-open-pdf>Ouvrir le module PDF</button><button class="btn primary" data-issue="${invoice.id}">Émettre au client</button></div>` : '';
      return `<article class="card" data-invoice-action="${invoice.id}" data-variance-count="${varianceCount}" style="margin:12px 0">
        <div class="top"><div><span class="pill">${A().esc(invoice.status)}</span><h3>${A().esc(invoice.invoice_number || invoice.title || 'Facture')}</h3></div><strong>${money(invoice.total)}</strong></div>
        <div class="grid2"><p><strong>Client :</strong><br>${A().esc(clientName)}<br>${A().esc(invoice.profiles?.phone || '')}<br>${A().esc(invoice.profiles?.email || '')}</p><p><strong>Véhicule :</strong><br>${A().esc(vehicleName)}<br>${A().esc(invoice.vehicles?.energy || '')} · ${A().esc(invoice.vehicles?.mileage || '')} km</p></div>
        <p><strong>Devis lié :</strong> ${A().esc(invoice.quotes?.quote_number || '—')} · ${money(invoice.quotes?.total || 0)}</p>
        ${draft ? `<div class="grid2"><label>Titre<input data-field="title" value="${A().esc(invoice.title || 'Facture EDM28')}"></label><label>Échéance<input data-field="dueAt" type="date" value="${invoice.due_at ? new Date(invoice.due_at).toISOString().slice(0,10) : ''}"></label></div><label>Description<textarea data-field="description" rows="3">${A().esc(invoice.description || '')}</textarea></label>` : `<p>${A().esc(invoice.description || '')}</p>`}
        <h4>Comparaison devis / facture réelle</h4>${comparisonHtml(comparison)}
        <h4>Lignes de facture</h4><div data-lines>${(invoice.invoice_items || []).map((item) => invoiceLine(item, !draft)).join('')}</div>
        ${draft ? '<button type="button" class="btn ghost" data-add-line>Ajouter une ligne</button>' : ''}
        <div class="grid2" style="margin-top:12px"><p>Total HT : <strong data-total="subtotal">${money(invoice.subtotal)}</strong></p><p>TVA : <strong data-total="vat">—</strong></p><p>Total TTC : <strong data-total="total">${money(invoice.total)}</strong></p><p>Payé : <strong>${money(invoice.amount_paid)}</strong> · Reste : <strong>${money(balance)}</strong></p></div>
        ${draft && varianceCount ? '<label><input type="checkbox" data-confirm-variance> J’ai vérifié et validé les écarts avec le devis accepté.</label>' : ''}
        ${invoice.pdf_path ? '<p class="status ok">PDF actualisé disponible.</p>' : draft ? '<p class="status error">PDF à générer avant émission.</p>' : ''}
        ${draftActions}${paymentForm}
      </article>`;
    }).join('') : '<p class="muted">Aucune facture.</p>';

    rows.filter((invoice) => invoice.status === 'draft').forEach((invoice) => bindDraft(host.querySelector(`[data-invoice-action="${invoice.id}"]`)));
    host.querySelectorAll('[data-open-pdf]').forEach((button) => button.onclick = () => A().page('document-pdf'));
    host.querySelectorAll('[data-save]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const invoice = rows.find((row) => row.id === button.dataset.save); await saveDraft(invoice, button.closest('article')); A().status('invoiceActionStatus', 'Facture enregistrée. Le PDF précédent a été invalidé.'); await load(); }
      catch (error) { A().status('invoiceActionStatus', error.message || 'Enregistrement impossible.', true); }
      finally { button.disabled = false; }
    });
    host.querySelectorAll('[data-issue]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const invoice = rows.find((row) => row.id === button.dataset.issue); await issue(invoice, button.closest('article')); A().status('invoiceActionStatus', 'Facture émise et visible par le client.'); await load(); window.EDMAdminAccounting?.load(); }
      catch (error) { A().status('invoiceActionStatus', error.message || 'Émission impossible.', true); }
      finally { button.disabled = false; }
    });
    host.querySelectorAll('[data-pay]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const invoice = rows.find((row) => row.id === button.dataset.pay); await pay(invoice, button.closest('article')); A().status('invoiceActionStatus', 'Règlement enregistré.'); await load(); window.EDMAdminAccounting?.load(); }
      catch (error) { A().status('invoiceActionStatus', error.message || 'Règlement impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = A()?.$('invoiceActionList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const invoicesResult = await A().db.from('invoices').select('id,user_id,vehicle_id,quote_id,repair_order_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,due_at,pdf_path,visible_to_client,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quotes(quote_number,total)').in('status', ['draft','issued','partially_paid','paid','overdue']).order('created_at', { ascending: false });
    if (invoicesResult.error) throw invoicesResult.error;
    const invoices = invoicesResult.data || [];
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const quoteIds = [...new Set(invoices.map((invoice) => invoice.quote_id).filter(Boolean))];
    const invoiceItemsResult = invoiceIds.length ? await A().db.from('invoice_items').select('id,invoice_id,item_type,description,quantity,unit_price,line_total,source_quote_item_id,supplier_reference,purchase_total,margin_amount,vat_rate,display_order').in('invoice_id', invoiceIds).order('display_order') : { data: [], error: null };
    const quoteItemsResult = quoteIds.length ? await A().db.from('quote_items').select('id,quote_id,item_type,designation,description,quantity,unit_price,total,supplier_reference,purchase_total,vat_rate,display_order').in('quote_id', quoteIds).order('display_order') : { data: [], error: null };
    if (invoiceItemsResult.error) throw invoiceItemsResult.error;
    if (quoteItemsResult.error) throw quoteItemsResult.error;
    const invoiceItems = invoiceItemsResult.data || [];
    const quoteItems = quoteItemsResult.data || [];
    invoices.forEach((invoice) => {
      invoice.invoice_items = invoiceItems.filter((item) => item.invoice_id === invoice.id);
      invoice.quote_items = quoteItems.filter((item) => item.quote_id === invoice.quote_id);
    });
    render(invoices);
  }

  function bind() {
    document.querySelector('[data-page="invoice-actions"]')?.addEventListener('click', () => load().catch((error) => A().status('invoiceActionStatus', error.message || 'Factures indisponibles.', true)));
    document.getElementById('invoiceActionRefresh')?.addEventListener('click', () => load().catch((error) => A().status('invoiceActionStatus', error.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminInvoiceActions = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();