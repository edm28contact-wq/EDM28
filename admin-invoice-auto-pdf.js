(() => {
  if (window.__edmInvoiceAutoPdfInstalled) return;
  window.__edmInvoiceAutoPdfInstalled = true;

  const A = () => window.EDMAdmin;
  let pendingInvoiceId = '';
  let running = false;

  async function generate(invoiceId) {
    if (!invoiceId || running || !A()?.db) return;
    running = true;
    try {
      const result = await A().db.from('invoices')
        .select('id,user_id,vehicle_id,quote_id,repair_order_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,pdf_path,created_at')
        .eq('id', invoiceId)
        .single();
      if (result.error) throw result.error;
      if (result.data.status !== 'draft') return;
      const pdfPath = await window.EDMAdminDocumentPdf?.generateFor('invoice', result.data);
      if (!pdfPath) throw new Error('Le PDF de facture n’a pas pu être généré.');
      A().status('invoiceActionStatus', 'Facture enregistrée et PDF régénéré automatiquement.');
      await window.EDMAdminInvoiceActions?.load();
    } catch (error) {
      A()?.status('invoiceActionStatus', `Facture enregistrée, mais PDF non généré : ${error.message || error}`, true);
    } finally {
      pendingInvoiceId = '';
      running = false;
    }
  }

  function install() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-invoice-action] [data-save]');
      if (!button) return;
      pendingInvoiceId = button.closest('[data-invoice-action]')?.dataset.invoiceAction || '';
    }, true);

    const status = document.getElementById('invoiceActionStatus');
    if (!status) return;
    const observer = new MutationObserver(() => {
      if (!pendingInvoiceId || running || status.classList.contains('error')) return;
      const text = String(status.textContent || '');
      if (/Facture enregistrée/i.test(text)) window.setTimeout(() => generate(pendingInvoiceId), 0);
    });
    observer.observe(status, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();