(() => {
  if (window.__edmPublishedPaymentsInstalled) return;
  window.__edmPublishedPaymentsInstalled = true;

  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  let rows = [];

  function date(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('fr-FR');
  }

  function balance(invoice) {
    return Math.max(0, n(invoice.total) - n(invoice.amount_paid));
  }

  function clientName(invoice) {
    const profile = invoice.profiles || {};
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Client';
  }

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard) return null;

    let button = nav.querySelector('[data-page="collections"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'btn ghost';
      button.dataset.page = 'collections';
      button.textContent = 'Encaissement';
      const invoiceButton = nav.querySelector('[data-page="invoice-actions"]');
      if (invoiceButton?.nextSibling) nav.insertBefore(button, invoiceButton.nextSibling);
      else nav.appendChild(button);
      button.addEventListener('click', () => {
        A()?.page('collections');
        load().catch((error) => A()?.status('collectionStatus', error.message || 'Encaissements indisponibles.', true));
      });
    }

    let section = document.getElementById('collections');
    if (!section) {
      section = document.createElement('section');
      section.id = 'collections';
      section.className = 'page';
      section.innerHTML = `<div class="card">
        <div class="top">
          <div><h2>Encaissement</h2><p class="muted">Factures publiées restant à encaisser, regroupées par client.</p></div>
          <button id="collectionRefresh" class="btn ghost" type="button">Actualiser</button>
        </div>
        <div id="collectionKpis" class="grid"></div>
        <div id="collectionStatus" class="status hidden"></div>
        <div id="collectionList" style="margin-top:14px"></div>
      </div>`;
      const invoiceSection = document.getElementById('invoice-actions');
      if (invoiceSection?.nextSibling) dashboard.insertBefore(section, invoiceSection.nextSibling);
      else dashboard.appendChild(section);
      section.querySelector('#collectionRefresh').addEventListener('click', () => load().catch((error) => A()?.status('collectionStatus', error.message || 'Actualisation impossible.', true)));
    }
    return section;
  }

  function groupByClient(invoices) {
    const groups = new Map();
    invoices.forEach((invoice) => {
      const key = invoice.user_id || `unknown-${invoice.id}`;
      if (!groups.has(key)) groups.set(key, { key, profile: invoice.profiles || {}, invoices: [] });
      groups.get(key).invoices.push(invoice);
    });
    return [...groups.values()].sort((left, right) => {
      const a = [left.profile.first_name, left.profile.last_name, left.profile.email].filter(Boolean).join(' ');
      const b = [right.profile.first_name, right.profile.last_name, right.profile.email].filter(Boolean).join(' ');
      return a.localeCompare(b, 'fr');
    });
  }

  function invoiceHtml(invoice) {
    const remaining = balance(invoice);
    const overdue = invoice.due_at && new Date(invoice.due_at) < new Date();
    return `<article class="card" data-collection-invoice="${A().esc(invoice.id)}" style="padding:12px;margin:10px 0">
      <div class="top">
        <div><strong>${A().esc(invoice.invoice_number || invoice.title || 'Facture')}</strong><p class="muted">Émise le ${A().esc(date(invoice.issued_at || invoice.created_at))} · Échéance ${A().esc(date(invoice.due_at))}</p></div>
        <span class="pill">${overdue ? 'Échue' : 'À encaisser'}</span>
      </div>
      <div class="grid2">
        <p>Total : <strong>${A().money(invoice.total)}</strong></p>
        <p>Déjà encaissé : <strong>${A().money(invoice.amount_paid)}</strong></p>
        <p>Reste : <strong>${A().money(remaining)}</strong></p>
      </div>
      <div class="grid2">
        <label>Montant encaissé<input data-pay-amount type="number" min="0.01" max="${remaining}" step="0.01" value="${remaining.toFixed(2)}"></label>
        <label>Mode de paiement<select data-pay-method><option value="card">Carte</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="check">Chèque</option></select></label>
        <label>Référence<input data-pay-reference placeholder="Référence facultative"></label>
      </div>
      <button class="btn primary" type="button" data-save-payment>Enregistrer le règlement</button>
    </article>`;
  }

  function render() {
    const section = ensureUi();
    const host = section?.querySelector('#collectionList');
    const kpis = section?.querySelector('#collectionKpis');
    if (!host || !kpis) return;

    const groups = groupByClient(rows);
    const outstanding = rows.reduce((sum, invoice) => sum + balance(invoice), 0);
    const overdue = rows.filter((invoice) => invoice.due_at && new Date(invoice.due_at) < new Date()).reduce((sum, invoice) => sum + balance(invoice), 0);
    kpis.innerHTML = [
      ['Clients à encaisser', groups.length],
      ['Factures ouvertes', rows.length],
      ['Total à encaisser', A().money(outstanding)],
      ['Dont échu', A().money(overdue)]
    ].map(([label, value]) => `<article class="card kpi"><span>${A().esc(label)}</span><strong>${A().esc(value)}</strong></article>`).join('');

    host.innerHTML = groups.length ? groups.map((group) => {
      const due = group.invoices.reduce((sum, invoice) => sum + balance(invoice), 0);
      const sample = group.invoices[0];
      const profile = group.profile || {};
      return `<article class="card" data-collection-client="${A().esc(group.key)}" style="margin:12px 0">
        <div class="top">
          <div><h3>${A().esc(clientName(sample))}</h3><p class="muted">${A().esc(profile.email || 'Email non renseigné')} · ${A().esc(profile.phone || 'Téléphone non renseigné')} · ${group.invoices.length} facture(s)</p></div>
          <strong>${A().money(due)}</strong>
        </div>
        ${group.invoices.map(invoiceHtml).join('')}
      </article>`;
    }).join('') : '<p class="muted">Aucune facture publiée en attente de règlement.</p>';

    host.querySelectorAll('[data-save-payment]').forEach((button) => button.addEventListener('click', async () => {
      const card = button.closest('[data-collection-invoice]');
      const invoice = rows.find((item) => item.id === card?.dataset.collectionInvoice);
      if (!invoice) return;
      const remaining = balance(invoice);
      const amount = n(card.querySelector('[data-pay-amount]')?.value);
      if (!(amount > 0) || amount > remaining) return A().status('collectionStatus', 'Montant invalide ou supérieur au solde.', true);
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
        A().status('collectionStatus', `Règlement enregistré pour ${clientName(invoice)}.`);
        await load();
        window.EDMAdminAccounting?.load().catch(() => {});
        await A().overview();
      } catch (error) {
        A().status('collectionStatus', error.message || 'Règlement impossible.', true);
      } finally {
        button.disabled = false;
      }
    }));
  }

  async function load() {
    const section = ensureUi();
    const host = section?.querySelector('#collectionList');
    if (!host || !A()?.db) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const result = await A().db.from('invoices')
      .select('id,user_id,invoice_number,status,title,total,amount_paid,due_at,issued_at,created_at,profiles(first_name,last_name,email,phone)')
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    rows = (result.data || []).filter((invoice) => balance(invoice) > 0.005);
    render();
  }

  function install() {
    ensureUi();
  }

  window.EDMAdminCollections = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
