(() => {
  const A = () => window.EDMAdmin;
  const n = (v) => Number(v || 0);

  async function issue(id) {
    const { data, error } = await A().db.from('invoices').update({ status: 'issued', visible_to_client: true, issued_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').gt('total', 0).not('invoice_number', 'is', null).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Facture non émissible.');
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

  function render(rows) {
    const host = A().$('invoiceActionList');
    host.innerHTML = rows.length ? rows.map((i) => {
      const balance = Math.max(0, n(i.total) - n(i.amount_paid));
      const issueButton = i.status === 'draft' ? `<button class="btn primary" data-issue="${i.id}">Émettre au client</button>` : '';
      const paymentForm = ['issued','partially_paid'].includes(i.status) && balance > 0 ? `<div class="toolbar"><input data-field="amount" type="number" min="0.01" max="${balance}" step="0.01" placeholder="Montant"><select data-field="method"><option value="card">Carte</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="check">Chèque</option></select><input data-field="reference" placeholder="Référence"><button class="btn primary" data-pay="${i.id}">Enregistrer le règlement</button></div>` : '';
      return `<article class="card" data-invoice-action="${i.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(i.status)}</span><h3>${A().esc(i.invoice_number || i.title || 'Facture')}</h3></div><strong>${A().money(i.total)}</strong></div><p>Payé : ${A().money(i.amount_paid)} · Reste : ${A().money(balance)}</p>${issueButton}${paymentForm}</article>`;
    }).join('') : '<p class="muted">Aucune facture.</p>';

    host.querySelectorAll('[data-issue]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { await issue(button.dataset.issue); A().status('invoiceActionStatus', 'Facture émise au client.'); await load(); window.EDMAdminAccounting?.load(); }
      catch (e) { A().status('invoiceActionStatus', e.message || 'Émission impossible.', true); }
      finally { button.disabled = false; }
    });

    host.querySelectorAll('[data-pay]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const invoice = rows.find((row) => row.id === button.dataset.pay); await pay(invoice, button.closest('article')); A().status('invoiceActionStatus', 'Règlement enregistré.'); await load(); window.EDMAdminAccounting?.load(); }
      catch (e) { A().status('invoiceActionStatus', e.message || 'Règlement impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = A()?.$('invoiceActionList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('invoices').select('id,user_id,invoice_number,status,title,total,amount_paid').in('status', ['draft','issued','partially_paid','paid']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function bind() {
    document.querySelector('[data-page="invoice-actions"]')?.addEventListener('click', () => load().catch((e) => A().status('invoiceActionStatus', e.message || 'Factures indisponibles.', true)));
    document.getElementById('invoiceActionRefresh')?.addEventListener('click', () => load().catch((e) => A().status('invoiceActionStatus', e.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminInvoiceActions = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();