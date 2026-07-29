(() => {
  if (window.__edmDocumentEditorsInstalled) return;
  window.__edmDocumentEditorsInstalled = true;

  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  const today = () => new Date().toISOString().slice(0, 10);
  const editableOrderStatuses = new Set(['draft', 'ready']);

  function status(id, message, error = false) {
    A()?.status(id, message, error);
  }

  function quoteLineValues(root) {
    const rows = [...root.querySelectorAll('[data-quote-line]')];
    if (!rows.length) throw new Error('Ajoutez au moins une ligne au devis.');
    return rows.map((line, index) => {
      const designation = line.querySelector('[data-line="designation"]')?.value.trim() || '';
      const description = line.querySelector('[data-line="description"]')?.value.trim() || designation;
      const quantity = n(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]')?.value);
      const purchaseTotal = n(line.querySelector('[data-line="purchase_total"]')?.value);
      if (!designation) throw new Error(`Ligne ${index + 1} : désignation obligatoire.`);
      if (!(quantity > 0)) throw new Error(`Ligne ${index + 1} : quantité positive obligatoire.`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Ligne ${index + 1} : prix unitaire invalide.`);
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error(`Ligne ${index + 1} : TVA invalide.`);
      if (!Number.isFinite(purchaseTotal) || purchaseTotal < 0) throw new Error(`Ligne ${index + 1} : coût d’achat invalide.`);
      return {
        item_type: line.querySelector('[data-line="type"]')?.value || 'other',
        supplier_reference: line.querySelector('[data-line="reference"]')?.value.trim() || null,
        designation,
        description: description || designation,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        purchase_total: purchaseTotal,
        display_order: index
      };
    });
  }

  function quoteTotals(items, discount) {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const vat = items.reduce((sum, item) => sum + item.quantity * item.unit_price * item.vat_rate / 100, 0);
    const gross = subtotal + vat;
    if (!Number.isFinite(discount) || discount < 0) throw new Error('La remise doit être positive ou nulle.');
    if (discount > gross) throw new Error('La remise ne peut pas dépasser le total avant remise.');
    const total = gross - discount;
    if (!(total > 0)) throw new Error('Le montant final doit être positif.');
    return { subtotal, vat, gross, total };
  }

  function sanitizeStoredQuoteItem(item) {
    return {
      item_type: item.item_type || 'other',
      supplier_reference: item.supplier_reference || null,
      designation: item.designation || item.description || 'Ligne de devis',
      description: item.description || item.designation || 'Ligne de devis',
      quantity: n(item.quantity) || 1,
      unit_price: Math.max(0, n(item.unit_price)),
      vat_rate: Math.max(0, n(item.vat_rate)),
      purchase_total: Math.max(0, n(item.purchase_total)),
      display_order: Number.isInteger(item.display_order) ? item.display_order : 0
    };
  }

  async function restoreQuoteItems(quoteId, snapshot) {
    await A().db.from('quote_items').delete().eq('quote_id', quoteId);
    if (!snapshot.length) return;
    await A().db.from('quote_items').insert(snapshot.map((item) => ({ ...sanitizeStoredQuoteItem(item), quote_id: quoteId })));
  }

  function validateBrakeSplit(root, publish) {
    if (!publish || root.dataset.brakeCombo !== 'true') return;
    const rows = [...root.querySelectorAll('[data-quote-line]')];
    const priced = (pattern) => rows.some((line) => {
      const designation = line.querySelector('[data-line="designation"]')?.value || '';
      const price = n(line.querySelector('[data-line="unit_price"]')?.value);
      return pattern.test(designation) && price > 0;
    });
    if (!priced(/disques?/i)) throw new Error('Renseignez le prix des disques sur une ligne séparée.');
    if (!priced(/plaquettes?/i)) throw new Error('Renseignez le prix des plaquettes sur une ligne séparée.');
  }

  async function saveQuote(button, publish) {
    const root = button.closest('[data-quote-id]');
    const quoteId = root?.dataset.quoteId;
    if (!root || !quoteId) throw new Error('Devis introuvable dans la page.');

    const items = quoteLineValues(root);
    const discount = n(root.querySelector('[data-field="discount"]')?.value);
    const totals = quoteTotals(items, discount);
    const validUntil = root.querySelector('[data-field="validUntil"]')?.value || null;
    validateBrakeSplit(root, publish);
    if (publish && (!validUntil || validUntil < today())) throw new Error('Une date de validité future est obligatoire.');

    const current = await A().db.from('quotes').select('id,status,quote_number,title,description,subtotal,discount,total,valid_until,pdf_path,visible_to_client').eq('id', quoteId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || current.data.status !== 'draft') throw new Error('Seul un devis brouillon peut être modifié.');

    let quoteNumber = root.querySelector('[data-field="number"]')?.value.trim() || '';
    if (!quoteNumber) {
      const next = await A().db.rpc('next_document_number', { p_type: 'quote' });
      if (next.error) throw next.error;
      quoteNumber = next.data;
      root.querySelector('[data-field="number"]').value = quoteNumber;
    }

    const snapshot = await A().db.from('quote_items').select('item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,purchase_total,display_order').eq('quote_id', quoteId).order('display_order');
    if (snapshot.error) throw snapshot.error;

    const removed = await A().db.from('quote_items').delete().eq('quote_id', quoteId);
    if (removed.error) throw removed.error;
    const inserted = await A().db.from('quote_items').insert(items.map((item) => ({ ...item, quote_id: quoteId })));
    if (inserted.error) {
      await restoreQuoteItems(quoteId, snapshot.data || []);
      throw inserted.error;
    }

    const patch = {
      quote_number: quoteNumber,
      title: root.querySelector('[data-field="title"]')?.value.trim() || 'Devis EDM28',
      description: root.querySelector('[data-field="description"]')?.value.trim() || null,
      subtotal: totals.subtotal,
      discount,
      total: totals.total,
      valid_until: validUntil,
      pdf_path: null,
      updated_at: new Date().toISOString()
    };
    if (publish) Object.assign(patch, { status: 'sent', visible_to_client: true });

    const updated = await A().db.from('quotes').update(patch).eq('id', quoteId).eq('status', 'draft').select('id');
    if (updated.error || !updated.data?.length) {
      await restoreQuoteItems(quoteId, snapshot.data || []);
      throw updated.error || new Error('Le devis a changé pendant l’enregistrement.');
    }

    if (current.data.pdf_path) A().db.storage.from('repair-documents').remove([current.data.pdf_path]).catch(() => {});
    status('quoteStatus', publish ? 'Devis enregistré et publié au client.' : 'Devis enregistré. Le PDF doit être régénéré.');
    await window.EDMAdminQuotes?.load();
    await A().overview();
  }

  function invoiceLineHtml(item = {}) {
    return `<div class="card" data-invoice-line data-source-id="${A().esc(item.source_quote_item_id || '')}" style="padding:12px;margin:10px 0">
      <div class="grid2">
        <label>Type<select data-line="type"><option value="labor" ${item.item_type === 'labor' ? 'selected' : ''}>Main-d’œuvre</option><option value="part" ${item.item_type === 'part' ? 'selected' : ''}>Pièce</option><option value="delivery" ${item.item_type === 'delivery' ? 'selected' : ''}>Livraison</option><option value="other" ${!['labor','part','delivery'].includes(item.item_type) ? 'selected' : ''}>Autre</option></select></label>
        <label>Référence<input data-line="reference" value="${A().esc(item.supplier_reference || '')}"></label>
        <label>Désignation<input data-line="description" value="${A().esc(item.description || '')}"></label>
        <label>Quantité<input data-line="quantity" type="number" min="0.01" step="0.01" value="${n(item.quantity) || 1}"></label>
        <label>Prix unitaire HT<input data-line="unit_price" type="number" min="0" step="0.01" value="${n(item.unit_price)}"></label>
        <label>TVA %<input data-line="vat_rate" type="number" min="0" max="100" step="0.1" value="${n(item.vat_rate)}"></label>
        <label>Coût d’achat interne<input data-line="purchase_total" type="number" min="0" step="0.01" value="${n(item.purchase_total)}"></label>
      </div>
      <div class="top"><span class="muted" data-line-total></span><button type="button" class="btn ghost" data-remove-line>Supprimer</button></div>
    </div>`;
  }

  function invoiceTemplate(kind) {
    if (kind === 'disc') return { item_type: 'part', description: 'Disques de frein', quantity: 2, unit_price: 0, vat_rate: 0 };
    if (kind === 'pad') return { item_type: 'part', description: 'Plaquettes de frein', quantity: 1, unit_price: 0, vat_rate: 0 };
    if (kind === 'part') return { item_type: 'part', description: 'Pièce', quantity: 1, unit_price: 0, vat_rate: 0 };
    return { item_type: 'labor', description: 'Main-d’œuvre', quantity: 1, unit_price: 0, vat_rate: 0 };
  }

  function invoiceValues(root) {
    const rows = [...root.querySelectorAll('[data-invoice-line]')];
    if (!rows.length) throw new Error('Ajoutez au moins une ligne facturable.');
    return rows.map((line, index) => {
      const description = line.querySelector('[data-line="description"]')?.value.trim() || '';
      const quantity = n(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]')?.value);
      const purchaseTotal = n(line.querySelector('[data-line="purchase_total"]')?.value);
      if (!description) throw new Error(`Ligne ${index + 1} : désignation obligatoire.`);
      if (!(quantity > 0)) throw new Error(`Ligne ${index + 1} : quantité positive obligatoire.`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Ligne ${index + 1} : prix unitaire invalide.`);
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error(`Ligne ${index + 1} : TVA invalide.`);
      if (!Number.isFinite(purchaseTotal) || purchaseTotal < 0) throw new Error(`Ligne ${index + 1} : coût d’achat invalide.`);
      return {
        item_type: line.querySelector('[data-line="type"]')?.value || 'other',
        supplier_reference: line.querySelector('[data-line="reference"]')?.value.trim() || null,
        description,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        purchase_total: purchaseTotal,
        source_quote_item_id: line.dataset.sourceId || null,
        display_order: index
      };
    });
  }

  function recalculateInvoice(root) {
    const lines = [...root.querySelectorAll('[data-invoice-line]')].map((line) => ({
      quantity: n(line.querySelector('[data-line="quantity"]')?.value),
      unit_price: n(line.querySelector('[data-line="unit_price"]')?.value),
      vat_rate: n(line.querySelector('[data-line="vat_rate"]')?.value)
    }));
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
    const vat = lines.reduce((sum, line) => sum + line.quantity * line.unit_price * line.vat_rate / 100, 0);
    const discount = Math.max(0, n(root.querySelector('[data-doc-discount]')?.value));
    const total = Math.max(0, subtotal + vat - discount);
    const subtotalNode = root.querySelector('[data-total="subtotal"]');
    const vatNode = root.querySelector('[data-total="vat"]');
    const totalNode = root.querySelector('[data-total="total"]');
    if (subtotalNode) subtotalNode.textContent = A().money(subtotal);
    if (vatNode) vatNode.textContent = A().money(vat);
    if (totalNode) totalNode.textContent = A().money(total);
    const headingTotal = root.querySelector(':scope > .top > strong');
    if (headingTotal) headingTotal.textContent = A().money(total);
    root.querySelectorAll('[data-invoice-line]').forEach((line) => {
      const quantity = n(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]')?.value);
      const node = line.querySelector('[data-line-total]');
      if (node) node.textContent = `Total TTC ligne : ${A().money(quantity * unitPrice * (1 + vatRate / 100))}`;
    });
  }

  async function saveInvoice(button) {
    const root = button.closest('[data-invoice-action]');
    const invoiceId = root?.dataset.invoiceAction;
    if (!root || !invoiceId) throw new Error('Facture introuvable dans la page.');
    const current = await A().db.from('invoices').select('id,status,pdf_path').eq('id', invoiceId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || current.data.status !== 'draft') throw new Error('Seule une facture brouillon peut être modifiée.');

    const items = invoiceValues(root);
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const vat = items.reduce((sum, item) => sum + item.quantity * item.unit_price * item.vat_rate / 100, 0);
    const discount = n(root.querySelector('[data-doc-discount]')?.value);
    const gross = subtotal + vat;
    if (!Number.isFinite(discount) || discount < 0 || discount > gross) throw new Error('Remise de facture invalide.');
    const total = gross - discount;
    if (!(total > 0)) throw new Error('Le total de la facture doit être positif.');

    const dueValue = root.querySelector('[data-field="dueAt"]')?.value || '';
    const saved = await A().db.rpc('admin_save_draft_invoice', {
      p_invoice_id: invoiceId,
      p_title: root.querySelector('[data-field="title"]')?.value.trim() || 'Facture EDM28',
      p_description: root.querySelector('[data-field="description"]')?.value.trim() || null,
      p_due_at: dueValue ? new Date(`${dueValue}T23:59:59`).toISOString() : null,
      p_items: items
    });
    if (saved.error) throw saved.error;

    const adjusted = await A().db.from('invoices').update({ discount, total, pdf_path: null, updated_at: new Date().toISOString() }).eq('id', invoiceId).eq('status', 'draft').select('id');
    if (adjusted.error || !adjusted.data?.length) throw adjusted.error || new Error('La facture a changé pendant l’enregistrement.');
    if (current.data.pdf_path) A().db.storage.from('repair-documents').remove([current.data.pdf_path]).catch(() => {});
    status('invoiceActionStatus', 'Facture enregistrée avec la remise. Le PDF doit être régénéré avant publication.');
    await window.EDMAdminInvoiceActions?.load();
    await A().overview();
  }

  async function enhanceInvoiceCards() {
    const host = document.getElementById('invoiceActionList');
    if (!host || !A()?.db) return;
    const cards = [...host.querySelectorAll('[data-invoice-action]')].filter((card) => !card.dataset.documentEditorEnhanced && card.querySelector('[data-save]'));
    if (!cards.length) return;
    cards.forEach((card) => {
      card.dataset.documentEditorEnhanced = '1';
      const add = card.querySelector('[data-add-line]');
      if (add) {
        add.insertAdjacentHTML('beforebegin', '<div class="toolbar" data-doc-add-toolbar><button type="button" class="btn ghost" data-doc-add="labor">Ajouter main-d’œuvre</button><button type="button" class="btn ghost" data-doc-add="part">Ajouter une pièce</button><button type="button" class="btn ghost" data-doc-add="disc">Ajouter des disques</button><button type="button" class="btn ghost" data-doc-add="pad">Ajouter des plaquettes</button></div>');
        add.remove();
      }
      const totals = card.querySelector('[data-total="total"]')?.closest('.grid2');
      if (totals && !card.querySelector('[data-doc-discount]')) totals.insertAdjacentHTML('beforeend', '<label>Remise (€)<input data-doc-discount type="number" min="0" step="0.01" value="0.00"></label>');
      const issue = card.querySelector('[data-issue]');
      if (issue) issue.textContent = 'Publier au client';
      recalculateInvoice(card);
    });
    const ids = cards.map((card) => card.dataset.invoiceAction);
    const discounts = await A().db.from('invoices').select('id,discount').in('id', ids);
    if (!discounts.error) {
      (discounts.data || []).forEach((row) => {
        const input = host.querySelector(`[data-invoice-action="${row.id}"] [data-doc-discount]`);
        if (input) input.value = n(row.discount).toFixed(2);
      });
      cards.forEach(recalculateInvoice);
    }
  }

  function orderLineHtml(item = {}, locked = false) {
    const disabled = locked ? ' disabled' : '';
    return `<div class="card" data-order-line style="padding:12px;margin:10px 0">
      <div class="grid2">
        <label>Type<select data-line="type"${disabled}><option value="labor" ${item.item_type === 'labor' ? 'selected' : ''}>Main-d’œuvre</option><option value="part" ${item.item_type === 'part' ? 'selected' : ''}>Pièce</option><option value="delivery" ${item.item_type === 'delivery' ? 'selected' : ''}>Livraison</option><option value="other" ${!['labor','part','delivery'].includes(item.item_type) ? 'selected' : ''}>Autre</option></select></label>
        <label>Référence<input data-line="reference" value="${A().esc(item.supplier_reference || '')}"${disabled}></label>
        <label>Désignation<input data-line="designation" value="${A().esc(item.designation || item.name || item.description || '')}"${disabled}></label>
        <label>Description<input data-line="description" value="${A().esc(item.description || item.name || '')}"${disabled}></label>
        <label>Quantité<input data-line="quantity" type="number" min="0.01" step="0.01" value="${n(item.quantity) || 1}"${disabled}></label>
        <label>Prix unitaire HT<input data-line="unit_price" type="number" min="0" step="0.01" value="${n(item.unit_price)}"${disabled}></label>
        <label>TVA %<input data-line="vat_rate" type="number" min="0" max="100" step="0.1" value="${n(item.vat_rate)}"${disabled}></label>
        <label>Coût d’achat interne<input data-line="purchase_total" type="number" min="0" step="0.01" value="${n(item.purchase_total)}"${disabled}></label>
      </div>
      <div class="top"><span class="muted" data-line-total></span>${locked ? '' : '<button type="button" class="btn ghost" data-remove-order-line>Supprimer</button>'}</div>
    </div>`;
  }

  function orderTemplate(kind) {
    if (kind === 'disc') return { item_type: 'part', designation: 'Disques de frein', description: 'Disques de frein', quantity: 2 };
    if (kind === 'pad') return { item_type: 'part', designation: 'Plaquettes de frein', description: 'Plaquettes de frein', quantity: 1 };
    if (kind === 'part') return { item_type: 'part', designation: 'Pièce', description: 'Pièce', quantity: 1 };
    return { item_type: 'labor', designation: 'Main-d’œuvre', description: 'Main-d’œuvre', quantity: 1 };
  }

  function orderValues(root) {
    const rows = [...root.querySelectorAll('[data-order-line]')];
    if (!rows.length) throw new Error('Ajoutez au moins une ligne à l’ordre de réparation.');
    return rows.map((line, index) => {
      const designation = line.querySelector('[data-line="designation"]')?.value.trim() || '';
      const description = line.querySelector('[data-line="description"]')?.value.trim() || designation;
      const quantity = n(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]')?.value);
      const purchaseTotal = n(line.querySelector('[data-line="purchase_total"]')?.value);
      if (!designation) throw new Error(`Ligne ${index + 1} : désignation obligatoire.`);
      if (!(quantity > 0)) throw new Error(`Ligne ${index + 1} : quantité positive obligatoire.`);
      if (unitPrice < 0 || vatRate < 0 || vatRate > 100 || purchaseTotal < 0) throw new Error(`Ligne ${index + 1} : montant invalide.`);
      const total = quantity * unitPrice;
      return {
        id: `work-${index + 1}`,
        name: designation,
        item_type: line.querySelector('[data-line="type"]')?.value || 'other',
        supplier_reference: line.querySelector('[data-line="reference"]')?.value.trim() || null,
        designation,
        description,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        purchase_total: purchaseTotal,
        total,
        display_order: index
      };
    });
  }

  function recalculateOrder(root) {
    const rows = [...root.querySelectorAll('[data-order-line]')];
    let subtotal = 0;
    let vat = 0;
    rows.forEach((line) => {
      const quantity = n(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]')?.value);
      subtotal += quantity * unitPrice;
      vat += quantity * unitPrice * vatRate / 100;
      const node = line.querySelector('[data-line-total]');
      if (node) node.textContent = `Total TTC ligne : ${A().money(quantity * unitPrice * (1 + vatRate / 100))}`;
    });
    const discount = Math.max(0, n(root.querySelector('[data-order-discount]')?.value));
    const total = Math.max(0, subtotal + vat - discount);
    root.querySelector('[data-order-subtotal]').textContent = A().money(subtotal);
    root.querySelector('[data-order-vat]').textContent = A().money(vat);
    root.querySelector('[data-order-total]').textContent = A().money(total);
    const heading = root.querySelector(':scope > .top > strong');
    if (heading) heading.textContent = A().money(total);
  }

  async function saveOrder(button) {
    const root = button.closest('[data-repair-order]');
    const orderId = root?.dataset.repairOrder;
    if (!root || !orderId) throw new Error('Ordre de réparation introuvable.');
    const current = await A().db.from('repair_orders').select('id,status,pdf_path').eq('id', orderId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || !editableOrderStatuses.has(current.data.status)) throw new Error('Cet ordre est verrouillé car l’intervention a commencé.');

    const items = orderValues(root);
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const vat = items.reduce((sum, item) => sum + item.total * item.vat_rate / 100, 0);
    const discount = n(root.querySelector('[data-order-discount]')?.value);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal + vat) throw new Error('Remise de l’ordre invalide.');
    const authorizedWork = [...items];
    if (discount > 0) authorizedWork.push({ id: 'discount', name: `Remise : -${A().money(discount)}`, item_type: 'discount', designation: 'Remise', description: 'Remise commerciale', quantity: 1, unit_price: discount, vat_rate: 0, total: -discount, display_order: items.length });

    let orderNumber = root.querySelector('[data-order-number]')?.value.trim() || '';
    if (!orderNumber) {
      const next = await A().db.rpc('next_document_number', { p_type: 'order' });
      if (next.error) throw next.error;
      orderNumber = next.data;
      root.querySelector('[data-order-number]').value = orderNumber;
    }

    const patch = {
      order_number: orderNumber,
      mileage_in: root.querySelector('[data-order-mileage]')?.value ? Number(root.querySelector('[data-order-mileage]').value) : null,
      visible_condition: root.querySelector('[data-order-condition]')?.value.trim() || null,
      customer_items: root.querySelector('[data-order-items]')?.value.trim() || null,
      authorized_work: authorizedWork,
      visible_to_client: false,
      pdf_path: null,
      status: current.data.status === 'draft' ? 'ready' : current.data.status,
      updated_at: new Date().toISOString()
    };
    const updated = await A().db.from('repair_orders').update(patch).eq('id', orderId).in('status', ['draft', 'ready']).select('id');
    if (updated.error || !updated.data?.length) throw updated.error || new Error('L’ordre a changé pendant l’enregistrement.');
    if (current.data.pdf_path) A().db.storage.from('repair-documents').remove([current.data.pdf_path]).catch(() => {});
    status('repairOrderStatus', 'Ordre de réparation enregistré en interne. Il n’est pas publié au client.');
    await loadOrders();
    await A().overview();
  }

  function renderOrders(orders, quoteItems) {
    const host = document.getElementById('repairOrderList');
    host.innerHTML = orders.length ? orders.map((order) => {
      const editable = editableOrderStatuses.has(order.status);
      const locked = editable ? '' : ' disabled';
      const stored = Array.isArray(order.authorized_work) ? order.authorized_work : [];
      const storedLines = stored.filter((item) => item && item.item_type !== 'discount' && typeof item === 'object');
      const fromQuote = quoteItems.filter((item) => item.quote_id === order.quote_id);
      const lines = storedLines.some((item) => item.quantity != null || item.unit_price != null) ? storedLines : fromQuote.length ? fromQuote : stored.map((item) => ({ item_type: 'labor', designation: item?.name || item?.id || String(item), description: item?.name || item?.id || String(item), quantity: 1, unit_price: 0, vat_rate: 0 }));
      const discountItem = stored.find((item) => item?.item_type === 'discount');
      const discount = Math.max(0, n(discountItem?.unit_price || (n(discountItem?.total) < 0 ? -n(discountItem.total) : 0)));
      const client = [order.profiles?.first_name, order.profiles?.last_name].filter(Boolean).join(' ') || order.profiles?.email || 'Client';
      const vehicle = [order.vehicles?.brand, order.vehicles?.model, order.vehicles?.plate].filter(Boolean).join(' · ') || 'Véhicule';
      return `<article class="card" data-repair-order="${order.id}" style="margin:12px 0">
        <div class="top"><div><span class="pill">${A().esc(order.status)}</span><h3>${A().esc(order.order_number || 'Ordre de réparation')}</h3><p class="muted">Document interne · non publié au client</p></div><strong>${A().money(order.quotes?.total || 0)}</strong></div>
        <div class="grid2"><p><strong>Client :</strong><br>${A().esc(client)}<br>${A().esc(order.profiles?.phone || '')}<br>${A().esc(order.profiles?.email || '')}</p><p><strong>Véhicule :</strong><br>${A().esc(vehicle)}<br>${A().esc(order.vehicles?.mileage || '')} km</p></div>
        <div class="grid2"><label>Numéro d’ordre<input data-order-number value="${A().esc(order.order_number || '')}"${locked}></label><label>Kilométrage d’entrée<input data-order-mileage type="number" min="0" value="${order.mileage_in ?? order.vehicles?.mileage ?? ''}"${locked}></label></div>
        <label>État visible du véhicule<textarea data-order-condition rows="2"${locked}>${A().esc(order.visible_condition || '')}</textarea></label>
        <label>Objets laissés par le client<textarea data-order-items rows="2"${locked}>${A().esc(order.customer_items || '')}</textarea></label>
        <h4>Travaux et pièces autorisés</h4><div data-order-lines>${lines.map((item) => orderLineHtml(item, !editable)).join('')}</div>
        ${editable ? '<div class="toolbar"><button type="button" class="btn ghost" data-add-order="labor">Ajouter main-d’œuvre</button><button type="button" class="btn ghost" data-add-order="part">Ajouter une pièce</button><button type="button" class="btn ghost" data-add-order="disc">Ajouter des disques</button><button type="button" class="btn ghost" data-add-order="pad">Ajouter des plaquettes</button></div>' : ''}
        <div class="grid2" style="margin-top:12px"><p>Total HT : <strong data-order-subtotal>0,00 €</strong></p><p>TVA : <strong data-order-vat>0,00 €</strong></p><label>Remise (€)<input data-order-discount type="number" min="0" step="0.01" value="${discount.toFixed(2)}"${locked}></label><p>Total TTC : <strong data-order-total>0,00 €</strong></p></div>
        ${editable ? `<button type="button" class="btn primary" data-save-order="${order.id}">Enregistrer l’ordre en interne</button>` : '<p class="muted">Ordre verrouillé après démarrage de l’intervention.</p>'}
      </article>`;
    }).join('') : '<p class="muted">Aucun ordre de réparation.</p>';
    host.querySelectorAll('[data-repair-order]').forEach(recalculateOrder);
  }

  async function loadOrders() {
    const host = document.getElementById('repairOrderList');
    if (!host || !A()?.db) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const result = await A().db.from('repair_orders').select('id,user_id,vehicle_id,quote_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,pdf_path,visible_to_client,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,mileage),quotes(quote_number,title,total)').neq('status', 'cancelled').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    const orders = result.data || [];
    const visibleIds = orders.filter((order) => order.visible_to_client).map((order) => order.id);
    if (visibleIds.length) {
      const hidden = await A().db.from('repair_orders').update({ visible_to_client: false }).in('id', visibleIds);
      if (hidden.error) throw hidden.error;
      orders.forEach((order) => { order.visible_to_client = false; });
    }
    const quoteIds = [...new Set(orders.map((order) => order.quote_id).filter(Boolean))];
    const itemsResult = quoteIds.length ? await A().db.from('quote_items').select('id,quote_id,item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,purchase_total,display_order').in('quote_id', quoteIds).order('display_order') : { data: [], error: null };
    if (itemsResult.error) throw itemsResult.error;
    renderOrders(orders, itemsResult.data || []);
  }

  function installOrderPage() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard || document.getElementById('repair-orders')) return;
    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.dataset.page = 'repair-orders';
    button.textContent = 'Ordres de réparation';
    const before = nav.querySelector('[data-page="interventions"]') || nav.querySelector('[data-page="clients"]');
    nav.insertBefore(button, before);
    const section = document.createElement('section');
    section.id = 'repair-orders';
    section.className = 'page';
    section.innerHTML = '<div class="card"><div class="top"><div><h2>Ordres de réparation</h2><p class="muted">Préparer et modifier les travaux autorisés. Ces documents restent internes et ne sont pas publiés au client.</p></div><button id="repairOrderRefresh" class="btn ghost">Actualiser</button></div><div id="repairOrderStatus" class="status hidden"></div><div id="repairOrderList"></div></div>';
    dashboard.appendChild(section);
    button.addEventListener('click', () => { A().page('repair-orders'); loadOrders().catch((error) => status('repairOrderStatus', error.message || 'Ordres indisponibles.', true)); });
    section.querySelector('#repairOrderRefresh').addEventListener('click', () => loadOrders().catch((error) => status('repairOrderStatus', error.message || 'Actualisation impossible.', true)));
  }

  document.addEventListener('input', (event) => {
    const invoice = event.target.closest('[data-invoice-action]');
    if (invoice && (event.target.matches('[data-line]') || event.target.matches('[data-doc-discount]'))) recalculateInvoice(invoice);
    const order = event.target.closest('[data-repair-order]');
    if (order && (event.target.matches('[data-line]') || event.target.matches('[data-order-discount]'))) recalculateOrder(order);
  });

  document.addEventListener('click', async (event) => {
    const addInvoice = event.target.closest('[data-doc-add]');
    if (addInvoice) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = addInvoice.closest('[data-invoice-action]');
      root.querySelector('[data-lines]').insertAdjacentHTML('beforeend', invoiceLineHtml(invoiceTemplate(addInvoice.dataset.docAdd)));
      recalculateInvoice(root);
      return;
    }
    const removeInvoice = event.target.closest('[data-invoice-action] [data-remove-line]');
    if (removeInvoice) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = removeInvoice.closest('[data-invoice-action]');
      removeInvoice.closest('[data-invoice-line]').remove();
      recalculateInvoice(root);
      return;
    }
    const addOrder = event.target.closest('[data-add-order]');
    if (addOrder) {
      event.preventDefault();
      const root = addOrder.closest('[data-repair-order]');
      root.querySelector('[data-order-lines]').insertAdjacentHTML('beforeend', orderLineHtml(orderTemplate(addOrder.dataset.addOrder), false));
      recalculateOrder(root);
      return;
    }
    const removeOrder = event.target.closest('[data-remove-order-line]');
    if (removeOrder) {
      event.preventDefault();
      const root = removeOrder.closest('[data-repair-order]');
      removeOrder.closest('[data-order-line]').remove();
      recalculateOrder(root);
      return;
    }

    const quoteButton = event.target.closest('[data-quote-id] [data-save],[data-quote-id] [data-publish]');
    const invoiceButton = event.target.closest('[data-invoice-action] [data-save]');
    const orderButton = event.target.closest('[data-repair-order] [data-save-order]');
    const button = quoteButton || invoiceButton || orderButton;
    if (!button || !A()?.profile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Enregistrement…';
    try {
      if (quoteButton) await saveQuote(button, Boolean(button.dataset.publish));
      else if (invoiceButton) await saveInvoice(button);
      else await saveOrder(button);
    } catch (error) {
      const target = quoteButton ? 'quoteStatus' : invoiceButton ? 'invoiceActionStatus' : 'repairOrderStatus';
      status(target, error.message || 'Enregistrement impossible.', true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }, true);

  function boot() {
    installOrderPage();
    const invoiceHost = document.getElementById('invoiceActionList');
    if (invoiceHost) {
      const observer = new MutationObserver(() => { queueMicrotask(() => enhanceInvoiceCards().catch((error) => status('invoiceActionStatus', error.message, true))); });
      observer.observe(invoiceHost, { childList: true, subtree: true });
      enhanceInvoiceCards().catch(() => {});
    }
    window.EDMAdminRepairOrders = { load: loadOrders };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();