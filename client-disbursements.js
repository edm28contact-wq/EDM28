(() => {
  if (window.__edmClientDisbursementsInstalled) return;
  window.__edmClientDisbursementsInstalled = true;

  const BILLING_KEY = 'edm28_disbursement_billing';
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const dateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
  };

  const statusLabels = {
    draft: 'Brouillon', awaiting_mandate: 'Mandat à accepter', authorized: 'Mandat accepté',
    awaiting_reapproval: 'Nouvelle autorisation requise', client_direct: 'Achat direct client',
    purchased: 'Achat à contrôler', eligible: 'Débours justifié', reimbursed: 'Débours régularisé',
    rejected: 'Refusé', cancelled: 'Annulé'
  };

  function billingMarkup() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(BILLING_KEY) || '{}'); } catch (_) {}
    return `<div class="panel" id="clientDisbursementBillingPanel">
      <div class="section-title"><div><span class="pill orange">Coordonnées débours</span><h2 style="margin-top:12px">Informations pour l’achat en votre nom</h2><p>Le justificatif fournisseur doit pouvoir être établi au nom du client. Vérifiez votre identité dans « Mon compte » puis renseignez votre adresse de facturation.</p></div></div>
      <div class="grid" style="margin-top:14px">
        <label>Adresse<input id="disbursementBillingAddress" autocomplete="street-address" value="${esc(saved.address || '')}" placeholder="12 rue Exemple"></label>
        <label>Code postal<input id="disbursementBillingPostal" autocomplete="postal-code" value="${esc(saved.postal_code || '')}" placeholder="28000"></label>
        <label>Ville<input id="disbursementBillingCity" autocomplete="address-level2" value="${esc(saved.city || '')}" placeholder="Chartres"></label>
        <label>Pays<input id="disbursementBillingCountry" autocomplete="country-name" value="${esc(saved.country || 'France')}"></label>
      </div>
      <div class="btn-row"><button id="saveDisbursementBilling" class="btn btn-primary" type="button">Enregistrer mes coordonnées</button><button class="btn btn-secondary" type="button" data-page-account>Vérifier mon identité</button></div>
      <div id="disbursementBillingStatus" style="margin-top:10px"></div>
    </div>`;
  }

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const main = document.querySelector('main.main');
    if (!nav || !main) return null;
    let button = nav.querySelector('[data-page="disbursements"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = 'disbursements';
      button.textContent = '🧾 Débours & pièces';
      nav.insertBefore(button, nav.querySelector('[data-page="history"]') || null);
      button.addEventListener('click', () => {
        if (typeof showPage === 'function') showPage('disbursements');
        void load().catch(renderError);
      });
    }
    let section = document.getElementById('disbursements');
    if (!section) {
      section = document.createElement('section');
      section.id = 'disbursements';
      section.className = 'page';
      section.innerHTML = `
        <div class="panel">
          <div class="section-title"><div><span class="pill orange">Pièces & débours</span><h2 style="margin-top:12px">Paiement avant commande</h2><p>Avec le débours, EDM28 achète la pièce en votre nom et pour votre compte. Après acceptation du mandat, vous versez une provision avant toute commande. Le montant définitif du débours reste celui du justificatif fournisseur, sans marge ni commission. Tout trop-perçu doit être remboursé.</p></div></div>
          <div class="grid-3" style="margin-top:16px">
            <article class="card"><h3>1 · Mandat</h3><p>Vous autorisez EDM28 à acheter la pièce dans la limite indiquée.</p></article>
            <article class="card"><h3>2 · Paiement</h3><p>Le statut passe de « À payer » à « Payé » uniquement après confirmation sécurisée du paiement en ligne.</p></article>
            <article class="card"><h3>3 · Commande</h3><p>EDM28 ne commande la pièce qu’après le paiement. Le justificatif réel permet ensuite de régulariser le montant exact.</p></article>
          </div>
        </div>
        ${billingMarkup()}
        <div class="panel">
          <div class="section-title"><div><h2>Mes débours</h2><p>Mandats, paiements, achats et justificatifs associés à vos demandes.</p></div><button id="clientDisbursementRefresh" class="btn btn-ghost" type="button">Actualiser</button></div>
          <div id="clientDisbursementStatus"></div><div id="clientDisbursementList"></div>
        </div>`;
      main.insertBefore(section, document.getElementById('history') || null);
      section.querySelector('#clientDisbursementRefresh')?.addEventListener('click', () => void load().catch(renderError));
      section.querySelector('#saveDisbursementBilling')?.addEventListener('click', () => void saveBilling().catch(renderError));
      section.querySelector('[data-page-account]')?.addEventListener('click', () => document.querySelector('[data-page="account"]')?.click());
    }
    return section;
  }

  function renderError(error) {
    const host = document.getElementById('clientDisbursementStatus');
    if (host) host.innerHTML = `<div class="errorbox">${esc(error?.message || 'Débours indisponibles.')}</div>`;
  }

  async function session() {
    const result = await supabaseClient.auth.getSession();
    if (result.error) throw result.error;
    return result.data?.session || null;
  }

  async function currentUser() {
    const current = await session();
    return current?.user || null;
  }

  function readBilling() {
    return {
      address: document.getElementById('disbursementBillingAddress')?.value.trim() || '',
      postal_code: document.getElementById('disbursementBillingPostal')?.value.trim() || '',
      city: document.getElementById('disbursementBillingCity')?.value.trim() || '',
      country: document.getElementById('disbursementBillingCountry')?.value.trim() || 'France'
    };
  }

  async function saveBilling() {
    const billing = readBilling();
    if (!billing.address || !billing.postal_code || !billing.city || !billing.country) throw new Error('Adresse, code postal, ville et pays sont obligatoires.');
    localStorage.setItem(BILLING_KEY, JSON.stringify(billing));
    const user = await currentUser();
    if (!user) throw new Error('Connectez-vous pour enregistrer ces coordonnées.');
    const requests = await supabaseClient.from('service_requests').select('id,status').eq('user_id', user.id).eq('parts_purchase_mode', 'edm_disbursement').neq('status', 'cancelled').order('created_at', { ascending: false });
    if (requests.error) throw requests.error;
    for (const request of requests.data || []) {
      const result = await supabaseClient.rpc('client_save_disbursement_billing', { p_request_id: request.id, p_billing: billing });
      if (result.error) throw result.error;
    }
    const host = document.getElementById('disbursementBillingStatus');
    if (host) host.innerHTML = '<div class="okbox">Coordonnées enregistrées.</div>';
  }

  async function choose(id, choice) {
    const result = await supabaseClient.rpc('client_choose_disbursement', { p_disbursement_id: id, p_choice: choice });
    if (result.error) throw result.error;
    return result.data;
  }

  async function api(path, body) {
    const current = await session();
    if (!current?.access_token) throw new Error('Connexion requise.');
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.access_token}` }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.error || 'Opération impossible.');
    return result;
  }

  async function syncPayment(id, sessionId = '') {
    return api('/api/disbursement-payment-status', { disbursementId: id, sessionId });
  }

  async function startPayment(id) {
    const result = await api('/api/disbursement-payment-create', { disbursementId: id });
    if (result.alreadyPaid) return load();
    if (!result.checkoutUrl) throw new Error('Lien de paiement absent.');
    window.location.assign(result.checkoutUrl);
  }

  async function openProof(path) {
    if (!path) return;
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  function mandateActions(row) {
    const reapproval = row.status === 'awaiting_reapproval';
    const limit = reapproval ? row.requested_limit : row.authorized_limit;
    return `<div class="notice" style="margin-top:12px"><strong>${reapproval ? 'Nouvelle autorisation demandée' : 'Mandat de débours'}</strong><p style="margin:8px 0">${esc(row.mandate_text || 'Mandat de débours EDM28.')}</p><p><strong>Plafond à autoriser : ${money(limit)}</strong></p><label style="display:flex;grid-template-columns:auto 1fr;align-items:flex-start;gap:10px;font-weight:700"><input data-mandate-check="${row.id}" type="checkbox" style="width:20px;min-height:20px;margin-top:3px"><span>J’ai lu le mandat et j’accepte le paiement de la provision avant toute commande.</span></label><div class="btn-row"><button class="btn btn-primary" type="button" data-accept-mandate="${row.id}" disabled>${reapproval ? 'Autoriser le nouveau plafond' : 'Accepter le mandat'}</button>${reapproval ? '' : `<button class="btn btn-secondary" type="button" data-client-direct="${row.id}">Je commande et paie moi-même</button>`}</div></div>`;
  }

  function paymentBox(row) {
    if (!row.prepayment_required || row.status === 'client_direct') return '';
    const required = Number(row.authorized_limit || 0);
    const paid = Number(row.prepaid_amount || 0);
    const due = Math.max(0, required - paid);
    if (row.payment_status === 'paid') return `<div class="okbox" style="margin-top:12px"><strong>Payé · ${money(paid)}</strong><br>Paiement confirmé. EDM28 peut maintenant commander la pièce dans la limite du mandat.</div>`;
    if (row.status !== 'authorized') return `<div class="notice" style="margin-top:12px"><strong>Statut du débours : À payer</strong><br>Le paiement sera disponible après acceptation du mandat.</div>`;
    return `<div class="errorbox" style="margin-top:12px"><strong>À payer · ${money(due)}</strong><br>Aucune pièce ne sera commandée avant confirmation du paiement.<div class="btn-row"><button class="btn btn-primary" type="button" data-pay-disbursement="${row.id}">Payer le débours en ligne</button><button class="btn btn-secondary" type="button" data-sync-payment="${row.id}">Vérifier mon paiement</button></div></div>`;
  }

  function card(row) {
    const item = row.quote_items || {};
    const quote = row.quotes || {};
    const vehicle = row.vehicles || {};
    const label = item.designation || item.description || row.description || 'Pièce';
    const vehicleLabel = [vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(' · ') || 'Véhicule';
    const proof = row.proof_path ? `<button class="btn btn-ghost" type="button" data-proof="${esc(row.proof_path)}">Voir le justificatif fournisseur</button>` : '';
    const mandate = ['awaiting_mandate','awaiting_reapproval'].includes(row.status) ? mandateActions(row) : '';
    const actual = row.amount != null ? money(row.amount) : 'En attente de l’achat';
    const settlement = row.amount != null && Number(row.prepaid_amount || 0) > Number(row.amount || 0) + 0.005 ? `<div class="notice" style="margin-top:12px"><strong>Régularisation en cours.</strong><br>Provision versée : ${money(row.prepaid_amount)} · débours réel : ${money(row.amount)}. Le trop-perçu doit être remboursé.</div>` : '';
    return `<article class="card" data-client-disbursement="${row.id}" style="margin:12px 0"><div class="section-title"><div><span class="pill orange">${esc(statusLabels[row.status] || row.status)}</span><h3 style="margin-top:10px">${esc(label)}</h3><p>${esc(quote.quote_number || 'Devis')} · ${esc(vehicleLabel)}</p></div><strong>${row.payment_status === 'paid' ? 'Payé' : row.prepayment_required ? 'À payer' : actual}</strong></div><div class="summary"><div class="summary-line"><span>Plafond autorisé</span><strong>${money(row.authorized_limit || 0)}</strong></div><div class="summary-line"><span>Provision payée</span><strong>${money(row.prepaid_amount || 0)}</strong></div><div class="summary-line"><span>Débours réel</span><strong>${actual}</strong></div><div class="summary-line"><span>Marge EDM28 sur le débours</span><strong>${row.no_margin ? '0 €' : 'Non conforme'}</strong></div></div>${mandate}${paymentBox(row)}${settlement}${row.status === 'client_direct' ? '<div class="okbox" style="margin-top:12px">Achat direct choisi : vous commandez et payez la pièce vous-même.</div>' : ''}${proof ? `<div class="btn-row">${proof}</div>` : ''}</article>`;
  }

  function bindActions(section) {
    section.querySelectorAll('[data-mandate-check]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const button = section.querySelector(`[data-accept-mandate="${CSS.escape(checkbox.dataset.mandateCheck)}"]`);
      if (button) button.disabled = !checkbox.checked;
    }));
    section.querySelectorAll('[data-accept-mandate]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true; try { await choose(button.dataset.acceptMandate, 'edm_disbursement'); await load(); } catch (error) { renderError(error); } finally { button.disabled = false; }
    }));
    section.querySelectorAll('[data-client-direct]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Confirmer que vous commandez et payez cette pièce vous-même ?')) return;
      button.disabled = true; try { await choose(button.dataset.clientDirect, 'client_direct'); await load(); } catch (error) { renderError(error); } finally { button.disabled = false; }
    }));
    section.querySelectorAll('[data-pay-disbursement]').forEach((button) => button.addEventListener('click', () => { button.disabled = true; void startPayment(button.dataset.payDisbursement).catch((error) => { button.disabled = false; renderError(error); }); }));
    section.querySelectorAll('[data-sync-payment]').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; try { await syncPayment(button.dataset.syncPayment); await load(false); } catch (error) { renderError(error); } finally { button.disabled = false; } }));
    section.querySelectorAll('[data-proof]').forEach((button) => button.addEventListener('click', () => void openProof(button.dataset.proof).catch(renderError)));
  }

  async function load(sync = true) {
    const section = ensureUi();
    const host = document.getElementById('clientDisbursementList');
    const status = document.getElementById('clientDisbursementStatus');
    if (!section || !host) return;
    const user = await currentUser();
    if (!user) { host.innerHTML = '<div class="notice">Connectez-vous pour consulter vos débours.</div>'; return; }
    if (status) status.innerHTML = '';
    host.innerHTML = '<div class="notice">Chargement…</div>';
    let result = await supabaseClient.from('disbursements').select('id,user_id,vehicle_id,service_request_id,quote_id,invoice_id,quote_item_id,supplier,description,amount,mandate_signed,supplier_invoice_in_customer_name,no_margin,proof_path,status,reimbursed_at,authorized_limit,requested_limit,client_choice,mandate_text,mandate_accepted_at,purchase_recorded_at,prepayment_required,payment_status,prepaid_amount,payment_currency,paid_at,created_at,quotes(quote_number,status),quote_items(designation,description,supplier_reference,purchase_mode),vehicles(plate,brand,model)').eq('user_id', user.id).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    if (sync) {
      for (const row of result.data || []) {
        if (row.prepayment_required && ['authorized','awaiting_reapproval'].includes(row.status) && row.payment_status !== 'paid') await syncPayment(row.id).catch(() => null);
      }
      result = await supabaseClient.from('disbursements').select('id,user_id,vehicle_id,service_request_id,quote_id,invoice_id,quote_item_id,supplier,description,amount,mandate_signed,supplier_invoice_in_customer_name,no_margin,proof_path,status,reimbursed_at,authorized_limit,requested_limit,client_choice,mandate_text,mandate_accepted_at,purchase_recorded_at,prepayment_required,payment_status,prepaid_amount,payment_currency,paid_at,created_at,quotes(quote_number,status),quote_items(designation,description,supplier_reference,purchase_mode),vehicles(plate,brand,model)').eq('user_id', user.id).order('created_at', { ascending: false });
      if (result.error) throw result.error;
    }
    host.innerHTML = (result.data || []).map(card).join('') || '<div class="empty">Aucun débours actif. Vos coordonnées peuvent être enregistrées dès maintenant ; le paiement apparaîtra après validation du devis et du mandat.</div>';
    bindActions(section);
  }

  async function handlePaymentReturn() {
    const params = new URLSearchParams(location.search);
    const state = params.get('disbursement_payment');
    if (!state) return;
    if (typeof showPage === 'function') showPage('disbursements');
    history.replaceState({}, '', location.pathname + location.hash);
    if (state === 'success') {
      const host = document.getElementById('clientDisbursementStatus');
      if (host) host.innerHTML = '<div class="notice">Paiement reçu par Stripe. Vérification en cours…</div>';
      await load(true);
    } else {
      const host = document.getElementById('clientDisbursementStatus');
      if (host) host.innerHTML = '<div class="notice">Paiement annulé. Aucune commande de pièce ne sera effectuée.</div>';
    }
  }

  function install() {
    ensureUi();
    if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, current) => {
      if (current?.user && document.getElementById('disbursements')?.classList.contains('active')) void load().catch(renderError);
    });
    window.setTimeout(() => void handlePaymentReturn().catch(renderError), 0);
  }

  window.EDMClientDisbursements = { load, saveBilling };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
