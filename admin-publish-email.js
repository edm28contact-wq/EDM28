(() => {
  if (window.__edmPublishEmailInstalled) return;
  window.__edmPublishEmailInstalled = true;

  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  const today = () => new Date().toISOString().slice(0, 10);

  function setStatus(id, message, error = false) {
    A()?.status(id, message, error);
  }

  async function sendNotification(payload) {
    const session = await A().db.auth.getSession();
    if (session.error) throw session.error;
    const token = session.data?.session?.access_token;
    if (!token) throw new Error('Session administrateur introuvable.');
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.error || 'Email non envoyé.');
    return result;
  }

  function quoteItems(root) {
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
        description,
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
    if (!Number.isFinite(discount) || discount < 0 || discount > gross) throw new Error('Remise invalide.');
    const total = gross - discount;
    if (!(total > 0)) throw new Error('Le montant final doit être positif.');
    return { subtotal, total };
  }

  function validateBrakeSplit(root) {
    if (root.dataset.brakeCombo !== 'true') return;
    const rows = [...root.querySelectorAll('[data-quote-line]')];
    const priced = (pattern) => rows.some((line) => pattern.test(line.querySelector('[data-line="designation"]')?.value || '') && n(line.querySelector('[data-line="unit_price"]')?.value) > 0);
    if (!priced(/disques?/i)) throw new Error('Renseignez le prix des disques sur une ligne séparée.');
    if (!priced(/plaquettes?/i)) throw new Error('Renseignez le prix des plaquettes sur une ligne séparée.');
  }

  async function publishQuote(button) {
    const root = button.closest('[data-quote-id]');
    const quoteId = root?.dataset.quoteId;
    if (!root || !quoteId) throw new Error('Devis introuvable.');
    const validUntil = root.querySelector('[data-field="validUntil"]')?.value || null;
    if (!validUntil || validUntil < today()) throw new Error('Une date de validité future est obligatoire.');
    validateBrakeSplit(root);

    const items = quoteItems(root);
    const discount = n(root.querySelector('[data-field="discount"]')?.value);
    const totals = quoteTotals(items, discount);
    const current = await A().db.from('quotes').select('id,user_id,status,quote_number,pdf_path,profiles(email)').eq('id', quoteId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || current.data.status !== 'draft') throw new Error('Seul un devis brouillon peut être publié.');
    if (!current.data.profiles?.email) throw new Error('Le client ne possède pas d’adresse email.');

    let quoteNumber = root.querySelector('[data-field="number"]')?.value.trim() || '';
    if (!quoteNumber) {
      const next = await A().db.rpc('next_document_number', { p_type: 'quote' });
      if (next.error) throw next.error;
      quoteNumber = next.data;
      root.querySelector('[data-field="number"]').value = quoteNumber;
    }

    const removed = await A().db.from('quote_items').delete().eq('quote_id', quoteId);
    if (removed.error) throw removed.error;
    const inserted = await A().db.from('quote_items').insert(items.map((item) => ({ ...item, quote_id: quoteId })));
    if (inserted.error) throw inserted.error;

    const updated = await A().db.from('quotes').update({
      quote_number: quoteNumber,
      title: root.querySelector('[data-field="title"]')?.value.trim() || 'Devis EDM28',
      description: root.querySelector('[data-field="description"]')?.value.trim() || null,
      subtotal: totals.subtotal,
      discount,
      total: totals.total,
      valid_until: validUntil,
      status: 'sent',
      visible_to_client: true,
      pdf_path: null,
      updated_at: new Date().toISOString()
    }).eq('id', quoteId).eq('status', 'draft').select('id');
    if (updated.error || !updated.data?.length) throw updated.error || new Error('Le devis a changé pendant la publication.');

    const complete = await A().db.from('quotes').select('id,user_id,quote_number,status,title,description,subtotal,discount,total,valid_until,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quote_items(item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,total,display_order)').eq('id', quoteId).single();
    if (complete.error) throw complete.error;
    const pdfPath = await window.EDMAdminDocumentPdf?.generateFor('quote', complete.data);
    if (!pdfPath) throw new Error('Le PDF du devis n’a pas pu être généré.');

    try {
      await sendNotification({
        userId: current.data.user_id,
        templateKey: 'quote_sent',
        relatedType: 'quote',
        relatedId: quoteId,
        attachmentPath: pdfPath,
        attachmentName: `devis-${quoteNumber}.pdf`,
        values: { quote_number: quoteNumber, total: A().money(totals.total), valid_until: validUntil }
      });
    } catch (error) {
      await A().db.from('quotes').update({ status: 'draft', visible_to_client: false }).eq('id', quoteId).eq('status', 'sent');
      throw new Error(`Le devis n’a pas été publié car l’email a échoué : ${error.message}`);
    }

    if (current.data.pdf_path) A().db.storage.from('repair-documents').remove([current.data.pdf_path]).catch(() => {});
    setStatus('quoteStatus', 'Devis publié et email envoyé au client avec le PDF.');
    await window.EDMAdminQuotes?.load();
    await A().overview();
  }

  async function publishInvoice(button) {
    const root = button.closest('[data-invoice-action]');
    const invoiceId = root?.dataset.invoiceAction;
    if (!root || !invoiceId) throw new Error('Facture introuvable.');
    const current = await A().db.from('invoices').select('id,user_id,status,invoice_number,total,amount_paid,due_at,pdf_path,profiles(email)').eq('id', invoiceId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || current.data.status !== 'draft') throw new Error('Seule une facture brouillon peut être publiée.');
    if (!current.data.profiles?.email) throw new Error('Le client ne possède pas d’adresse email.');

    const full = await A().db.from('invoices').select('id,user_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,pdf_path,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),invoice_items(item_type,supplier_reference,description,quantity,unit_price,vat_rate,line_total,display_order)').eq('id', invoiceId).single();
    if (full.error) throw full.error;
    const pdfPath = current.data.pdf_path || await window.EDMAdminDocumentPdf?.generateFor('invoice', full.data);
    if (!pdfPath) throw new Error('Le PDF de la facture n’a pas pu être généré.');

    const issued = await A().db.from('invoices').update({ status: 'issued', visible_to_client: true, issued_at: new Date().toISOString(), pdf_path: pdfPath, updated_at: new Date().toISOString() }).eq('id', invoiceId).eq('status', 'draft').gt('total', 0).not('invoice_number', 'is', null).select('id');
    if (issued.error || !issued.data?.length) throw issued.error || new Error('La facture ne peut pas être publiée.');

    const balance = Math.max(0, n(current.data.total) - n(current.data.amount_paid));
    try {
      await sendNotification({
        userId: current.data.user_id,
        templateKey: 'invoice_sent',
        relatedType: 'invoice',
        relatedId: invoiceId,
        attachmentPath: pdfPath,
        attachmentName: `facture-${current.data.invoice_number || invoiceId}.pdf`,
        values: {
          invoice_number: current.data.invoice_number || '',
          total: A().money(current.data.total),
          balance: A().money(balance),
          due_date: current.data.due_at ? new Date(current.data.due_at).toLocaleDateString('fr-FR') : ''
        }
      });
    } catch (error) {
      await A().db.from('invoices').update({ status: 'draft', visible_to_client: false, issued_at: null }).eq('id', invoiceId).eq('status', 'issued');
      throw new Error(`La facture n’a pas été publiée car l’email a échoué : ${error.message}`);
    }

    setStatus('invoiceActionStatus', 'Facture publiée et email envoyé au client avec le PDF.');
    await window.EDMAdminInvoiceActions?.load();
    window.EDMAdminAccounting?.load();
    await A().overview();
  }

  document.addEventListener('click', async (event) => {
    const quoteButton = event.target.closest('[data-quote-id] [data-publish]');
    const invoiceButton = event.target.closest('[data-invoice-action] [data-issue]');
    const button = quoteButton || invoiceButton;
    if (!button || !A()?.profile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Publication et envoi…';
    try {
      if (quoteButton) await publishQuote(button);
      else await publishInvoice(button);
    } catch (error) {
      setStatus(quoteButton ? 'quoteStatus' : 'invoiceActionStatus', error.message || 'Publication impossible.', true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }, true);
})();