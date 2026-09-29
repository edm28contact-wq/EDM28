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

  async function publishQuote(button) {
    if (!window.EDMAdminSupplierBasket) throw new Error('Rechargez le module de panier fournisseur.');
    return window.EDMAdminSupplierBasket.publish(button);
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