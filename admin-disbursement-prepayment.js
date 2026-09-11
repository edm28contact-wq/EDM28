(() => {
  if (window.__edmAdminDisbursementPrepaymentInstalled) return;
  window.__edmAdminDisbursementPrepaymentInstalled = true;

  const A = () => window.EDMAdmin;
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  let rows = new Map();
  let refreshing = false;

  async function session() {
    const result = await A()?.db?.auth?.getSession();
    if (result?.error) throw result.error;
    return result?.data?.session || null;
  }

  async function api(path, body) {
    const current = await session();
    if (!current?.access_token) throw new Error('Connexion administrateur requise.');
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.access_token}` },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.error || 'Opération impossible.');
    return result;
  }

  async function sync(id) {
    return api('/api/disbursement-payment-status', { disbursementId: id });
  }

  async function refund(id) {
    return api('/api/disbursement-payment-refund', { disbursementId: id });
  }

  function banner(row) {
    if (!row.prepayment_required || row.status === 'client_direct') return '<div class="status ok" data-prepayment-banner>Paiement préalable non requis pour ce dossier.</div>';
    if (row.payment_status === 'paid') {
      const surplus = Math.max(0, Number(row.prepaid_amount || 0) - Number(row.amount || 0));
      const needsRefund = ['eligible','reimbursed'].includes(row.status) && row.amount != null && surplus > 0.005;
      return `<div class="status ok" data-prepayment-banner><strong>Payé · ${money(row.prepaid_amount)}</strong><br>Le paiement a été confirmé côté serveur. ${needsRefund ? `Trop-perçu à rembourser : ${money(surplus)}.<br><button type="button" class="btn ghost" data-refund-prepayment="${row.id}" style="margin-top:8px">Rembourser le trop-perçu</button>` : 'La commande est autorisée dans la limite du mandat.'}</div>`;
    }
    return `<div class="status" data-prepayment-banner style="border-color:#f79009"><strong>À payer · aucune commande autorisée</strong><br>Provision reçue : ${money(row.prepaid_amount)} / plafond ${money(row.authorized_limit)}. Le client doit payer en ligne avant l’achat.</div>`;
  }

  function applyRow(row) {
    const card = document.querySelector(`[data-disbursement-id="${CSS.escape(row.id)}"]`);
    if (!card) return;
    card.querySelector('[data-prepayment-banner]')?.remove();
    card.insertAdjacentHTML('afterbegin', banner(row));
    const purchase = card.querySelector('[data-record-purchase]');
    if (purchase) {
      const allowed = !row.prepayment_required || row.payment_status === 'paid';
      purchase.disabled = !allowed;
      purchase.title = allowed ? '' : 'Paiement client obligatoire avant toute commande.';
      purchase.closest('.card')?.querySelectorAll('input,select').forEach((field) => {
        if (!field.matches('[data-new-limit]')) field.disabled = !allowed;
      });
    }
  }

  async function refresh() {
    if (refreshing || !A()?.db || !document.getElementById('disbursementList')) return;
    refreshing = true;
    try {
      const result = await A().db.from('disbursements').select('id,status,prepayment_required,payment_status,prepaid_amount,authorized_limit,amount,paid_at').order('created_at', { ascending: false });
      if (result.error) throw result.error;
      rows = new Map((result.data || []).map((row) => [row.id, row]));
      for (const row of rows.values()) {
        if (row.prepayment_required && row.payment_status !== 'paid' && ['authorized','awaiting_reapproval'].includes(row.status)) {
          await sync(row.id).catch(() => null);
        }
      }
      const refreshed = await A().db.from('disbursements').select('id,status,prepayment_required,payment_status,prepaid_amount,authorized_limit,amount,paid_at').order('created_at', { ascending: false });
      if (!refreshed.error) rows = new Map((refreshed.data || []).map((row) => [row.id, row]));
      rows.forEach(applyRow);
    } catch (error) {
      A()?.status?.('disbursementStatus', error.message || 'Statut des paiements indisponible.', true);
    } finally {
      refreshing = false;
    }
  }

  document.addEventListener('click', (event) => {
    const purchase = event.target.closest?.('[data-record-purchase]');
    if (purchase) {
      const card = purchase.closest('[data-disbursement-id]');
      const row = card ? rows.get(card.dataset.disbursementId) : null;
      if (row?.prepayment_required && row.payment_status !== 'paid') {
        event.preventDefault();
        event.stopImmediatePropagation();
        A()?.status?.('disbursementStatus', 'Achat bloqué : le débours est encore à payer.', true);
        return;
      }
    }
    const button = event.target.closest?.('[data-refund-prepayment]');
    if (button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!confirm('Rembourser maintenant le trop-perçu au client via Stripe ?')) return;
      button.disabled = true;
      void refund(button.dataset.refundPrepayment)
        .then(() => refresh())
        .catch((error) => A()?.status?.('disbursementStatus', error.message || 'Remboursement impossible.', true))
        .finally(() => { button.disabled = false; });
    }
  }, true);

  const observer = new MutationObserver(() => window.setTimeout(refresh, 0));
  function install() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) observer.observe(dashboard, { childList: true, subtree: true });
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="disbursements"],#disbursementRefresh')) window.setTimeout(refresh, 120);
    });
    window.setTimeout(refresh, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
