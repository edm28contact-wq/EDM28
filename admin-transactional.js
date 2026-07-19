(() => {
  const A = () => window.EDMAdmin;
  const rpc = async (name, params) => {
    const { data, error } = await A().db.rpc(name, params);
    if (error) throw error;
    return data;
  };

  async function run(button) {
    if (button.dataset.action === 'quote') {
      await rpc('admin_create_quote_from_request', { p_request_id: button.dataset.id });
      A().status('requestStatus', 'Brouillon de devis créé de manière transactionnelle.');
      await window.EDMAdminRequests?.load();
      await A().overview();
      return;
    }
    if (button.dataset.prepare) {
      const root = button.closest('article');
      await rpc('admin_prepare_accepted_quote', {
        p_quote_id: button.dataset.prepare,
        p_starts_at: new Date(root.querySelector('[data-field="startsAt"]').value).toISOString(),
        p_duration_minutes: Number(root.querySelector('[data-field="duration"]').value || 60),
        p_order_number: root.querySelector('[data-field="orderNumber"]').value.trim()
      });
      A().status('operationStatus', 'Rendez-vous et ordre créés dans une transaction unique.');
      await window.EDMAdminOperations?.load();
      await A().overview();
      return;
    }
    if (button.dataset.finalize) {
      const root = button.closest('article');
      await rpc('admin_finalize_repair_order', {
        p_order_id: button.dataset.finalize,
        p_invoice_number: root.querySelector('[data-field="invoiceNumber"]').value.trim(),
        p_due_days: Number(root.querySelector('[data-field="dueDays"]').value || 30)
      });
      A().status('finalizationStatus', 'Clôture et facturation réalisées dans une transaction unique.');
      await window.EDMAdminFinalization?.load();
      await A().overview();
      await window.EDMAdminAccounting?.load();
      return;
    }
    const root = button.closest('article');
    await rpc('admin_record_invoice_payment', {
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
    const button = event.target.closest('[data-action="quote"],[data-prepare],[data-finalize],[data-pay]');
    if (!button || !A()?.profile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    try { await run(button); }
    catch (error) {
      const target = button.dataset.action === 'quote' ? 'requestStatus' : button.dataset.prepare ? 'operationStatus' : button.dataset.finalize ? 'finalizationStatus' : 'invoiceActionStatus';
      A().status(target, error.message || 'Opération transactionnelle impossible.', true);
    } finally { button.disabled = false; }
  }, true);
})();
