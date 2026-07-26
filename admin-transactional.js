(() => {
  const A = () => window.EDMAdmin;
  const rpc = async (name, params) => {
    const { data, error } = await A().db.rpc(name, params);
    if (error) throw error;
    return data;
  };
  const documentNumber = async (type, current) => {
    const value = String(current || '').trim();
    if (value) return value;
    return rpc('next_document_number', { p_type: type });
  };

  function invoiceItems(root) {
    const rows = [...root.querySelectorAll('[data-invoice-line]')];
    if (!rows.length) throw new Error('Ajoutez au moins une ligne facturable.');
    return rows.map((line, index) => {
      const description = line.querySelector('[data-line="description"]')?.value.trim() || '';
      const quantity = Number(line.querySelector('[data-line="quantity"]')?.value);
      const unitPrice = Number(line.querySelector('[data-line="unit_price"]')?.value);
      const vatRate = Number(line.querySelector('[data-line="vat_rate"]')?.value || 0);
      const purchaseTotal = Number(line.querySelector('[data-line="purchase_total"]')?.value || 0);
      if (!description) throw new Error(`Ligne ${index + 1} : désignation obligatoire.`);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Ligne ${index + 1} : quantité positive obligatoire.`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Ligne ${index + 1} : prix unitaire invalide.`);
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error(`Ligne ${index + 1} : taux de TVA invalide.`);
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

  async function saveInvoice(button) {
    const root = button.closest('[data-invoice-action]');
    if (!root) throw new Error('Facture introuvable dans la page.');
    const invoiceId = root.dataset.invoiceAction;
    const oldPdf = button.dataset.pdfPath || null;
    const dueValue = root.querySelector('[data-field="dueAt"]')?.value || '';
    await rpc('admin_save_draft_invoice', {
      p_invoice_id: invoiceId,
      p_title: root.querySelector('[data-field="title"]')?.value.trim() || 'Facture EDM28',
      p_description: root.querySelector('[data-field="description"]')?.value.trim() || null,
      p_due_at: dueValue ? new Date(`${dueValue}T23:59:59`).toISOString() : null,
      p_items: invoiceItems(root)
    });
    if (oldPdf) await A().db.storage.from('repair-documents').remove([oldPdf]).catch(() => {});
    A().status('invoiceActionStatus', 'Facture et lignes enregistrées dans une transaction unique. Le PDF doit être régénéré.');
    await window.EDMAdminInvoiceActions?.load();
    await A().overview();
  }

  async function run(button) {
    if (button.matches('[data-invoice-action] [data-save]')) {
      await saveInvoice(button);
      return;
    }
    if (button.dataset.action === 'quote') {
      await rpc('admin_create_quote_from_request', { p_request_id: button.dataset.id });
      A().status('requestStatus', 'Brouillon de devis créé de manière transactionnelle.');
      await window.EDMAdminRequests?.load();
      await A().overview();
      return;
    }
    if (button.dataset.prepare) {
      const root = button.closest('article');
      const startsAt = root.querySelector('[data-field="startsAt"]').value;
      if (!startsAt) throw new Error('Date et heure du rendez-vous obligatoires.');
      const orderNumber = await documentNumber('order', root.querySelector('[data-field="orderNumber"]').value);
      root.querySelector('[data-field="orderNumber"]').value = orderNumber;
      await rpc('admin_prepare_quote', {
        p_quote_id: button.dataset.prepare,
        p_starts_at: new Date(startsAt).toISOString(),
        p_duration_minutes: Number(root.querySelector('[data-field="duration"]').value || 60),
        p_order_number: orderNumber
      });
      A().status('operationStatus', 'Rendez-vous et ordre créés dans une transaction unique.');
      await window.EDMAdminOperations?.load();
      await A().overview();
      return;
    }
    if (button.dataset.finalize) {
      const root = button.closest('article');
      const invoiceNumber = await documentNumber('invoice', root.querySelector('[data-field="invoiceNumber"]').value);
      root.querySelector('[data-field="invoiceNumber"]').value = invoiceNumber;
      await rpc('admin_finalize_repair_order', {
        p_order_id: button.dataset.finalize,
        p_invoice_number: invoiceNumber,
        p_due_days: Number(root.querySelector('[data-field="dueDays"]').value || 30)
      });
      A().status('finalizationStatus', 'Contrôle vérifié, clôture et facturation réalisées dans une transaction unique.');
      await window.EDMAdminFinalization?.load();
      await A().overview();
      await window.EDMAdminAccounting?.load();
      return;
    }
    const root = button.closest('article');
    await rpc('admin_record_payment', {
      p_invoice_id: button.dataset.pay,
      p_amount: Number(root.querySelector('[data-field="amount"]').value || 0),
      p_payment_method: root.querySelector('[data-field="method"]').value,
      p_reference: root.querySelector('[data-field="reference"]').value.trim() || null
    });
    A().status('invoiceActionStatus', 'Règlement enregistré avec verrouillage du solde.');
    await window.EDMAdminInvoiceActions?.load();
    await window.EDMAdminAccounting?.load();
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-invoice-action] [data-save],[data-action="quote"],[data-prepare],[data-finalize],[data-pay]');
    if (!button || !A()?.profile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    try { await run(button); }
    catch (error) {
      const target = button.matches('[data-invoice-action] [data-save]') || button.dataset.pay ? 'invoiceActionStatus' : button.dataset.action === 'quote' ? 'requestStatus' : button.dataset.prepare ? 'operationStatus' : 'finalizationStatus';
      A().status(target, error.message || 'Opération transactionnelle impossible.', true);
    } finally { button.disabled = false; }
  }, true);
})();