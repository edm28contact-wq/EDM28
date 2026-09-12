(() => {
  if (window.__edmAccountDisbursementFlowInstalled) return;
  window.__edmAccountDisbursementFlowInstalled = true;

  const BILLING_KEY = 'edm28_disbursement_billing';
  const MODE_KEY = 'edm28_parts_purchase_mode';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let accountRenderedFor = '';

  const appUser = () => {
    try { return typeof state !== 'undefined' ? state?.user || null : null; }
    catch (_) { return null; }
  };

  function updateAppUser(next) {
    try {
      if (typeof state === 'undefined') return;
      state.user = { ...(state.user || {}), ...next };
      if (typeof saveState === 'function') saveState();
    } catch (_) {}
  }

  function readBilling() {
    try { return JSON.parse(localStorage.getItem(BILLING_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  async function sessionUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function accountGate() {
    const card = document.getElementById('clientCard');
    if (!card) return;
    const user = appUser();
    const connected = Boolean(user?.id);
    card.classList.toggle('hidden', connected);

    let gate = document.getElementById('edmConnectedAccountGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'edmConnectedAccountGate';
      gate.className = 'card hidden';
      gate.innerHTML = '<div class="section-title"><div><h3>1. Compte client</h3><p id="edmConnectedAccountText">Compte connecté.</p></div><button class="btn btn-secondary" type="button" data-edm-open-account>Modifier mes informations</button></div>';
      card.insertAdjacentElement('afterend', gate);
      gate.querySelector('[data-edm-open-account]')?.addEventListener('click', () => {
        if (typeof window.showPage === 'function') window.showPage('account');
        else if (typeof showPage === 'function') showPage('account');
        setTimeout(() => void renderAccountEditor(true).catch(showAccountError), 40);
      });
    }
    gate.classList.toggle('hidden', !connected);
    const text = document.getElementById('edmConnectedAccountText');
    if (text && connected) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Compte connecté';
      text.textContent = name + (user.email ? ` · ${user.email}` : '');
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

  async function renderAccountEditor(force = false) {
    const host = document.getElementById('accountPageContent');
    if (!host || !document.getElementById('account')?.classList.contains('active')) return;
    const user = await sessionUser();
    if (!user) return;
    if (!force && accountRenderedFor === user.id && document.getElementById('accountSaveProfile')) return;

    const profileResult = await supabaseClient.from('profiles').select('first_name,last_name,phone,email').eq('id', user.id).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data || {};
    const current = appUser() || {};
    const billing = readBilling();
    accountRenderedFor = user.id;

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
          <p>Ces coordonnées servent lorsque EDM28 achète une pièce en votre nom et pour votre compte. Elles sont conservées pour vos prochaines demandes.</p>
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

    document.getElementById('accountSaveProfile')?.addEventListener('click', () => void saveProfile().catch(showAccountError));
    document.getElementById('accountSaveBilling')?.addEventListener('click', () => void saveAccountBilling().catch(showBillingError));
    document.getElementById('accountSignOutBtn')?.addEventListener('click', () => {
      if (typeof signOutFromSupabase === 'function') void signOutFromSupabase();
    });
    document.getElementById('accountDeleteBtn')?.addEventListener('click', () => {
      if (typeof deleteCurrentAccount === 'function') void deleteCurrentAccount();
    });
  }

  function showAccountError(error) {
    const status = document.getElementById('accountProfileStatus');
    if (status) status.innerHTML = `<div class="errorbox">${esc(error?.message || 'Enregistrement impossible.')}</div>`;
  }

  function showBillingError(error) {
    const status = document.getElementById('accountBillingStatus');
    if (status) status.innerHTML = `<div class="errorbox">${esc(error?.message || 'Enregistrement impossible.')}</div>`;
  }

  async function saveProfile() {
    const user = await sessionUser();
    if (!user) throw new Error('Connexion requise.');
    const firstName = document.getElementById('accountFirstName')?.value.trim() || '';
    const lastName = document.getElementById('accountLastName')?.value.trim() || '';
    const phone = document.getElementById('accountPhone')?.value.trim() || '';
    const email = document.getElementById('accountEmail')?.value.trim().toLowerCase() || '';
    if (!firstName || !lastName || !phone || !email) throw new Error('Prénom, nom, téléphone et email sont obligatoires.');

    const updated = await supabaseClient.from('profiles').update({ first_name:firstName, last_name:lastName, phone }).eq('id', user.id).select('id').maybeSingle();
    if (updated.error) throw updated.error;
    let emailMessage = '';
    if (email !== String(user.email || '').toLowerCase()) {
      const changed = await supabaseClient.auth.updateUser({ email });
      if (changed.error) throw changed.error;
      emailMessage = ' Un email de confirmation peut être nécessaire pour valider la nouvelle adresse.';
    }

    updateAppUser({ id:user.id, firstName, lastName, phone, email });
    for (const [id, value] of [['firstName',firstName],['lastName',lastName],['phone',phone],['email',email]]) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }
    const status = document.getElementById('accountProfileStatus');
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
    if (!billing.address || !billing.postal_code || !billing.city || !billing.country) throw new Error('Adresse, code postal, ville et pays sont obligatoires.');
    localStorage.setItem(BILLING_KEY, JSON.stringify(billing));

    const user = await sessionUser();
    if (user) {
      const requests = await supabaseClient.from('service_requests').select('id').eq('user_id', user.id).eq('parts_purchase_mode','edm_disbursement').neq('status','cancelled');
      if (requests.error) throw requests.error;
      for (const request of requests.data || []) {
        const result = await supabaseClient.rpc('client_save_disbursement_billing', { p_request_id:request.id, p_billing:billing });
        if (result.error) throw result.error;
      }
    }
    const status = document.getElementById('accountBillingStatus');
    if (status) status.innerHTML = '<div class="okbox">Coordonnées de débours enregistrées.</div>';
    syncBillingInputs();
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
      const box = document.createElement('div');
      box.className = 'panel';
      box.id = 'edmContinueRequestFromDisbursement';
      box.innerHTML = '<div class="section-title"><div><h2>Continuer ma demande</h2><p>Enregistrez vos coordonnées de débours, puis revenez à votre demande pour choisir vos prestations et l’envoyer à EDM28.</p></div><button class="btn btn-primary" type="button" data-edm-continue-request>Continuer ma demande</button></div>';
      billingPanel?.insertAdjacentElement('afterend', box);
      box.querySelector('[data-edm-continue-request]')?.addEventListener('click', () => {
        if (typeof window.showPage === 'function') window.showPage('appointment');
        else if (typeof showPage === 'function') showPage('appointment');
        setTimeout(() => document.getElementById('servicesArea')?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
      });
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
    if (selected) {
      localStorage.setItem(MODE_KEY, selected.value);
      return;
    }
    const saved = localStorage.getItem(MODE_KEY);
    if (!saved) return;
    const input = document.querySelector(`input[name="partsPurchaseMode"][value="${CSS.escape(saved)}"]`);
    if (input) input.checked = true;
  }

  function refresh() {
    accountGate();
    enhanceDisbursementPage();
    syncBillingInputs();
    persistMode();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-page="account"]')) setTimeout(() => void renderAccountEditor(true).catch(showAccountError), 80);
    if (event.target.closest?.('[data-page="disbursements"]')) setTimeout(() => { enhanceDisbursementPage(); syncBillingInputs(); }, 80);
  }, true);

  document.addEventListener('change', (event) => {
    const mode = event.target.closest?.('input[name="partsPurchaseMode"]');
    if (mode?.checked) localStorage.setItem(MODE_KEY, mode.value);
  }, true);

  function install() {
    refresh();

    if (typeof window.hydrateUserFromSupabase === 'function' && !window.hydrateUserFromSupabase.__edmAccountFlowWrapped) {
      const originalHydrate = window.hydrateUserFromSupabase;
      const wrappedHydrate = async (...args) => {
        const result = await originalHydrate(...args);
        accountRenderedFor = '';
        refresh();
        return result;
      };
      wrappedHydrate.__edmAccountFlowWrapped = true;
      window.hydrateUserFromSupabase = wrappedHydrate;
    }

    if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange(() => {
      accountRenderedFor = '';
      setTimeout(refresh, 0);
      setTimeout(refresh, 250);
    });

    const observer = new MutationObserver(() => setTimeout(refresh, 0));
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
