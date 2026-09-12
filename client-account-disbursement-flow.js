(() => {
  if (window.__edmAccountDisbursementFlowInstalled) return;
  window.__edmAccountDisbursementFlowInstalled = true;

  const BILLING_KEY = 'edm28_disbursement_billing';
  const MODE_KEY = 'edm28_parts_purchase_mode';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function readBilling() {
    try { return JSON.parse(localStorage.getItem(BILLING_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  async function sessionUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.user || null;
  }

  function accountGate() {
    const card = document.getElementById('clientCard');
    if (!card) return;
    const connected = Boolean(window.state?.user?.id);
    card.classList.toggle('hidden', connected);

    let gate = document.getElementById('edmConnectedAccountGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'edmConnectedAccountGate';
      gate.className = 'card hidden';
      gate.innerHTML = '<div class="section-title"><div><h3>1. Compte client</h3><p id="edmConnectedAccountText">Compte connecté.</p></div><button class="btn btn-secondary" type="button" data-edm-open-account>Modifier mes informations</button></div>';
      card.insertAdjacentElement('afterend', gate);
      gate.querySelector('[data-edm-open-account]')?.addEventListener('click', () => window.showPage?.('account'));
    }
    gate.classList.toggle('hidden', !connected);
    const text = document.getElementById('edmConnectedAccountText');
    if (text && connected) {
      const user = window.state?.user || {};
      text.textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') + (user.email ? ` · ${user.email}` : '');
    }
  }

  function billingFieldsMarkup(saved = {}) {
    return `<div class="grid" style="margin-top:14px">
      <label>Adresse<input id="accountBillingAddress" autocomplete="street-address" value="${esc(saved.address || '')}"></label>
      <label>Code postal<input id="accountBillingPostal" autocomplete="postal-code" value="${esc(saved.postal_code || '')}"></label>
      <label>Ville<input id="accountBillingCity" autocomplete="address-level2" value="${esc(saved.city || '')}"></label>
      <label>Pays<input id="accountBillingCountry" autocomplete="country-name" value="${esc(saved.country || 'France')}"></label>
    </div>`;
  }

  async function renderAccountEditor() {
    const host = document.getElementById('accountPageContent');
    if (!host || !document.getElementById('account')?.classList.contains('active')) return;
    const user = await sessionUser();
    if (!user) return;

    const profileResult = await supabaseClient.from('profiles').select('first_name,last_name,phone,email').eq('id', user.id).maybeSingle();
    const profile = profileResult.data || {};
    const current = window.state?.user || {};
    const billing = readBilling();

    host.innerHTML = `
      <div class="grid">
        <div class="card">
          <h3>Informations du compte</h3>
          <p>Ces informations sont utilisées pour vos demandes. Vous pouvez les modifier à tout moment.</p>
          <div class="grid" style="margin-top:14px">
            <label>Prénom<input id="accountFirstName" autocomplete="given-name" value="${esc(profile.first_name || current.firstName || '')}"></label>
            <label>Nom<input id="accountLastName" autocomplete="family-name" value="${esc(profile.last_name || current.lastName || '')}"></label>
            <label>Téléphone<input id="accountPhone" autocomplete="tel" value="${esc(profile.phone || current.phone || '')}"></label>
            <label>Email<input id="accountEmail" type="email" autocomplete="email" value="${esc(user.email || profile.email || current.email || '')}"></label>
          </div>
          <button class="btn btn-primary" id="accountSaveProfile" type="button" style="margin-top:14px">Enregistrer mes informations</button>
          <div id="accountProfileStatus" style="margin-top:10px"></div>
        </div>
        <div class="card">
          <h3>Coordonnées pour les débours</h3>
          <p>Ces coordonnées servent lorsque EDM28 achète une pièce en votre nom et pour votre compte.</p>
          ${billingFieldsMarkup(billing)}
          <button class="btn btn-primary" id="accountSaveBilling" type="button" style="margin-top:14px">Enregistrer mes coordonnées de débours</button>
          <div id="accountBillingStatus" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Actions sur le compte</h3>
        <div class="btn-row">
          <button class="btn btn-secondary" id="accountSignOutBtn" type="button">Se déconnecter</button>
          <button class="btn btn-danger" id="accountDeleteBtn" type="button">Supprimer mon compte</button>
        </div>
      </div>`;

    document.getElementById('accountSaveProfile')?.addEventListener('click', saveProfile);
    document.getElementById('accountSaveBilling')?.addEventListener('click', saveAccountBilling);
    document.getElementById('accountSignOutBtn')?.addEventListener('click', () => window.signOutFromSupabase?.());
    document.getElementById('accountDeleteBtn')?.addEventListener('click', () => window.deleteCurrentAccount?.());
  }

  async function saveProfile() {
    const user = await sessionUser();
    if (!user) throw new Error('Connexion requise.');
    const firstName = document.getElementById('accountFirstName')?.value.trim() || '';
    const lastName = document.getElementById('accountLastName')?.value.trim() || '';
    const phone = document.getElementById('accountPhone')?.value.trim() || '';
    const email = document.getElementById('accountEmail')?.value.trim().toLowerCase() || '';
    const status = document.getElementById('accountProfileStatus');
    if (!firstName || !lastName || !phone || !email) {
      if (status) status.innerHTML = '<div class="errorbox">Prénom, nom, téléphone et email sont obligatoires.</div>';
      return;
    }
    const updated = await supabaseClient.from('profiles').update({ first_name:firstName, last_name:lastName, phone }).eq('id', user.id).select('id').maybeSingle();
    if (updated.error) throw updated.error;
    let emailMessage = '';
    if (email !== String(user.email || '').toLowerCase()) {
      const changed = await supabaseClient.auth.updateUser({ email });
      if (changed.error) throw changed.error;
      emailMessage = ' Un email de confirmation peut être nécessaire pour valider la nouvelle adresse.';
    }
    if (window.state) {
      window.state.user = { ...(window.state.user || {}), id:user.id, firstName, lastName, phone, email };
      window.saveState?.();
    }
    for (const [id, value] of [['firstName',firstName],['lastName',lastName],['phone',phone],['email',email]]) {
      const input = document.getElementById(id); if (input) input.value = value;
    }
    if (status) status.innerHTML = `<div class="okbox">Informations enregistrées.${esc(emailMessage)}</div>`;
    accountGate();
  }

  async function saveAccountBilling() {
    const billing = {
      address: document.getElementById('accountBillingAddress')?.value.trim() || '',
      postal_code: document.getElementById('accountBillingPostal')?.value.trim() || '',
      city: document.getElementById('accountBillingCity')?.value.trim() || '',
      country: document.getElementById('accountBillingCountry')?.value.trim() || 'France'
    };
    const status = document.getElementById('accountBillingStatus');
    if (!billing.address || !billing.postal_code || !billing.city || !billing.country) {
      if (status) status.innerHTML = '<div class="errorbox">Adresse, code postal, ville et pays sont obligatoires.</div>';
      return;
    }
    localStorage.setItem(BILLING_KEY, JSON.stringify(billing));
    const user = await sessionUser();
    if (user) {
      const requests = await supabaseClient.from('service_requests').select('id').eq('user_id', user.id).eq('parts_purchase_mode','edm_disbursement').neq('status','cancelled');
      if (!requests.error) {
        for (const request of requests.data || []) await supabaseClient.rpc('client_save_disbursement_billing', { p_request_id:request.id, p_billing:billing });
      }
    }
    if (status) status.innerHTML = '<div class="okbox">Coordonnées de débours enregistrées.</div>';
  }

  function enhanceDisbursementPage() {
    const section = document.getElementById('disbursements');
    if (!section) return;
    const billingPanel = document.getElementById('clientDisbursementBillingPanel');
    if (billingPanel) {
      const title = billingPanel.querySelector('h2');
      if (title) title.textContent = 'Coordonnées pour le débours';
      const identityButton = billingPanel.querySelector('[data-page-account]');
      if (identityButton) identityButton.textContent = 'Modifier mes informations dans Mon compte';
    }
    if (!document.getElementById('edmContinueRequestFromDisbursement')) {
      const intro = section.querySelector('.panel');
      const box = document.createElement('div');
      box.className = 'panel';
      box.id = 'edmContinueRequestFromDisbursement';
      box.innerHTML = '<div class="section-title"><div><h2>Continuer ma demande</h2><p>Enregistrez vos coordonnées ci-dessus, puis revenez à votre demande pour choisir vos prestations et l’envoyer à EDM28.</p></div><button class="btn btn-primary" type="button" data-edm-continue-request>Continuer ma demande</button></div>';
      intro?.insertAdjacentElement('afterend', box);
      box.querySelector('[data-edm-continue-request]')?.addEventListener('click', () => window.showPage?.('appointment'));
    }
  }

  function syncBillingInputs() {
    const saved = readBilling();
    const map = {
      disbursementBillingAddress:'address', disbursementBillingPostal:'postal_code',
      disbursementBillingCity:'city', disbursementBillingCountry:'country'
    };
    for (const [id,key] of Object.entries(map)) {
      const input = document.getElementById(id);
      if (input && !input.value && saved[key]) input.value = saved[key];
    }
  }

  function persistMode() {
    const selected = document.querySelector('input[name="partsPurchaseMode"]:checked');
    if (selected) localStorage.setItem(MODE_KEY, selected.value);
    else {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved) document.querySelector(`input[name="partsPurchaseMode"][value="${CSS.escape(saved)}"]`)?.click();
    }
  }

  function refresh() {
    accountGate();
    enhanceDisbursementPage();
    syncBillingInputs();
    persistMode();
    if (document.getElementById('account')?.classList.contains('active')) void renderAccountEditor().catch(() => {});
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-page="account"]')) setTimeout(() => void renderAccountEditor().catch(() => {}), 80);
    if (event.target.closest?.('[data-page="disbursements"]')) setTimeout(() => { enhanceDisbursementPage(); syncBillingInputs(); }, 80);
  }, true);

  document.addEventListener('change', (event) => {
    const mode = event.target.closest?.('input[name="partsPurchaseMode"]');
    if (mode?.checked) localStorage.setItem(MODE_KEY, mode.value);
  }, true);

  function install() {
    refresh();
    if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange(() => setTimeout(refresh, 0));
    const observer = new MutationObserver(() => setTimeout(refresh, 0));
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
