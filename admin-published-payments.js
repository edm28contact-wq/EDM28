(() => {
  if (window.__edmPublishedPaymentsInstalled) return;
  window.__edmPublishedPaymentsInstalled = true;

  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);

  function ensurePanel() {
    const page = document.getElementById('accounting');
    if (!page || document.getElementById('publishedPaymentPanel')) return document.getElementById('publishedPaymentPanel');
    const panel = document.createElement('div');
    panel.id = 'publishedPaymentPanel';
    panel.className = 'card';
    panel.style.marginTop = '14px';
    panel.innerHTML = '<div class="top"><div><h2>Encaissements à enregistrer</h2><p class="muted">Les factures publiées quittent l’écran de préparation. Leur règlement reste géré ici.</p></div></div><div id="publishedPaymentList"></div><div id="publishedPaymentStatus" class="status hidden"></div>';
    page.appendChild(panel);
    return panel;
  }

  function state(invoice) {
    const total = n(invoice.total);
    const paid = n(invoice.amount_paid);
    if (invoice.status === 'paid' || paid >= total) return 'paid';
    if (invoice.due_at && new Date(invoice.due_at) < new Date()) return 'overdue';
    return 'unpaid';
  }

  function render() {
    const mod = window.EDMAdminAccounting;
    const panel = ensurePanel();
    const host = panel?.querySelector('#publishedPaymentList');
    if (!host || !mod) return;

    const rows = (mod.rows || []).filter((invoice) => ['issued', 'partially_paid', 'overdue'].includes(invoice.status) && state(invoice) !== 'paid');
    host.innerHTML = rows.length ? rows.map((invoice) => {
      const balance = Math.max(0, n(invoice.total) - n(invoice.amount_paid));
      return `<article class="card" data-published-payment="${A().esc(invoice.id)}" style="padding:12px;margin:10px 0">
        <div class="top"><div><strong>${A().esc(invoice.invoice_number || invoice.title || 'Facture')}</strong><p class="muted">Reste à encaisser : ${A().money(balance)}</p></div><span class="pill">${A().esc(invoice.status)}</span></div>
        <div class="grid2">
          <label>Montant<input data-pay-amount type="number" min="0.01" max="${balance}" step="0.01" value="${balance.toFixed(2)}"></label>
          <label>Mode<select data-pay-method><option value="card">Carte</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="check">Chèque</option></select></label>
          <label>Référence<input data-pay-reference placeholder="Référence facultative"></label>
        </div>
        <button class="btn primary" type="button" data-save-payment>Enregistrer le règlement</button>
      </article>`;
    }).join('') : '<p class="muted">Aucune facture publiée en attente de règlement.</p>';

    host.querySelectorAll('[data-save-payment]').forEach((button) => button.onclick = async () => {
      const card = button.closest('[data-published-payment]');
      const invoice = rows.find((row) => row.id === card?.dataset.publishedPayment);
      if (!invoice) return;
      const balance = Math.max(0, n(invoice.total) - n(invoice.amount_paid));
      const amount = n(card.querySelector('[data-pay-amount]')?.value);
      if (!(amount > 0) || amount > balance) return A().status('publishedPaymentStatus', 'Montant invalide ou supérieur au solde.', true);
      button.disabled = true;
      try {
        const inserted = await A().db.from('payments').insert({
          invoice_id: invoice.id,
          user_id: invoice.user_id,
          amount,
          payment_method: card.querySelector('[data-pay-method]')?.value || 'card',
          reference: card.querySelector('[data-pay-reference]')?.value.trim() || null
        });
        if (inserted.error) throw inserted.error;
        A().status('publishedPaymentStatus', 'Règlement enregistré.');
        await window.EDMAdminAccounting?.load();
        render();
        await A().overview();
      } catch (error) {
        A().status('publishedPaymentStatus', error.message || 'Règlement impossible.', true);
      } finally {
        button.disabled = false;
      }
    });
  }

  function install() {
    const bind = () => {
      const mod = window.EDMAdminAccounting;
      if (!mod?.load || mod.__publishedPaymentsWrapped) return false;
      const originalLoad = mod.load.bind(mod);
      mod.load = async (...args) => {
        const result = await originalLoad(...args);
        render();
        return result;
      };
      mod.__publishedPaymentsWrapped = true;
      document.querySelector('[data-page="accounting"]')?.addEventListener('click', () => window.setTimeout(render, 0));
      render();
      return true;
    };
    if (bind()) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (bind() || tries >= 40) window.clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
