(() => {
  if (window.__edmWorkflowAdjustmentsInstalled) return;
  window.__edmWorkflowAdjustmentsInstalled = true;

  const MODE_KEY = 'edm28_parts_purchase_mode';
  const DISBURSEMENT_LEAD = 'EDM28 ne vend pas de pièces. Un débours est une avance faite par EDM28 au nom et pour le compte du client, remboursée exactement sur justificatif, sans marge ni commission.';
  const BOOKING_LEAD = 'Le devis se consulte et se valide dans « Statut de ma demande ». Après acceptation, cette page sert uniquement à choisir votre rendez-vous.';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function installStyles() {
    if (document.getElementById('edm-workflow-adjustments-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-workflow-adjustments-style';
    style.textContent = `
      .edm-status-step.current,.edm-status-step.current .edm-status-label{color:#050505!important}
      [data-prepare-slot].edm-slot-selected{background:var(--green)!important;border-color:var(--green)!important;color:#fff!important;box-shadow:0 0 0 3px rgba(22,163,74,.18)!important}
      .edm-parts-choice{margin-top:18px;padding:16px;border:1px solid var(--border);border-radius:18px;background:#fff}
      .edm-parts-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
      .edm-parts-option{display:block;border:1px solid var(--border);border-radius:16px;padding:14px;cursor:pointer;background:#fff}
      .edm-parts-option:has(input:checked){border-color:var(--green);box-shadow:0 0 0 3px rgba(22,163,74,.12)}
      .edm-parts-option input{width:auto;min-height:0;margin-right:8px}
      @media(max-width:700px){.edm-parts-choice-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensurePartsChoice() {
    const basket = document.getElementById('basketList');
    if (!basket || document.getElementById('edmPartsPurchaseChoice')) return;
    const saved = localStorage.getItem(MODE_KEY) || '';
    const wrap = document.createElement('section');
    wrap.id = 'edmPartsPurchaseChoice';
    wrap.className = 'edm-parts-choice';
    wrap.innerHTML = `
      <h3>Comment souhaitez-vous acheter les pièces ?</h3>
      <p class="small">EDM28 ne vend pas de pièces automobiles et ne réalise aucune marge ni commission sur leur prix. Choisissez le fonctionnement souhaité pour cette demande.</p>
      <div class="edm-parts-choice-grid">
        <label class="edm-parts-option">
          <div><input type="radio" name="partsPurchaseMode" value="client_direct" ${saved === 'client_direct' ? 'checked' : ''}><strong>Sans débours · j’achète les pièces</strong></div>
          <p>EDM28 prépare le devis avec les références des pièces à acheter. Vous commandez et payez directement les pièces. Si vous achetez une autre référence que celle indiquée sur le devis, notamment une pièce incompatible ou différente, la responsabilité d’EDM28 ne peut pas être engagée pour cette erreur d’achat.</p>
        </label>
        <label class="edm-parts-option">
          <div><input type="radio" name="partsPurchaseMode" value="edm_disbursement" ${saved === 'edm_disbursement' ? 'checked' : ''}><strong>Avec débours · EDM28 se charge de l’achat</strong></div>
          <p>Un débours est une somme avancée par EDM28 en votre nom et pour votre compte. Vous autorisez un plafond avant l’achat, EDM28 achète la pièce pour votre compte, puis vous remboursez exactement le montant du justificatif fournisseur, sans marge ni commission.</p>
        </label>
      </div>
      <div class="notice" style="margin-top:12px"><strong>Débours :</strong> ce n’est pas une vente de pièce par EDM28. C’est une avance de fonds faite pour votre compte, remboursée au montant exact du justificatif.</div>`;
    basket.insertAdjacentElement('afterend', wrap);
    wrap.querySelectorAll('input[name="partsPurchaseMode"]').forEach((input) => input.addEventListener('change', () => {
      localStorage.setItem(MODE_KEY, input.value);
    }));
  }

  function normalizeDisbursementPage() {
    const section = document.getElementById('disbursements');
    if (!section) return;
    const intro = section.querySelector('.panel');
    const lead = intro?.querySelector('.section-title p');
    if (lead && lead.textContent !== DISBURSEMENT_LEAD) lead.textContent = DISBURSEMENT_LEAD;
    intro?.querySelectorAll('.grid-3 article').forEach((card) => {
      if (/vente de pièce/i.test(card.textContent || '')) card.remove();
    });
    const grid = intro?.querySelector('.grid-3');
    if (grid && grid.style.gridTemplateColumns !== 'repeat(2, minmax(0px, 1fr))') grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  }

  function normalizeBookingPage() {
    const booking = document.getElementById('booking');
    if (!booking) return;
    const subtitle = booking.querySelector('.section-title p');
    if (subtitle && subtitle.textContent !== BOOKING_LEAD) subtitle.textContent = BOOKING_LEAD;
    const accept = document.getElementById('prepareAcceptQuote');
    const refuse = document.getElementById('prepareRefuseQuote');
    if ((accept || refuse) && document.getElementById('prepareRdvContent')) {
      document.getElementById('prepareRdvContent').innerHTML = `<div class="card"><span class="pill orange">Devis disponible</span><h3 style="margin-top:12px">Validez d’abord votre devis</h3><p>Le devis a été déplacé dans « Statut de ma demande ». Acceptez-le ou refusez-le depuis cette page. Après acceptation, revenez ici pour choisir votre rendez-vous.</p><button class="btn btn-primary" type="button" data-go-request-status>Ouvrir le statut de ma demande</button></div>`;
    }
  }

  function navigate(page) {
    if (typeof window.__edmNavigate === 'function') return window.__edmNavigate(page);
    document.querySelector(`[data-page="${page}"]`)?.click();
  }

  function markSelectedSlot(target) {
    const button = target.closest?.('[data-prepare-slot]');
    if (!button) return;
    document.querySelectorAll('[data-prepare-slot]').forEach((node) => node.classList.toggle('edm-slot-selected', node === button));
  }

  function rememberHistoryState() {
    const openVehicles = [...document.querySelectorAll('#history [data-vehicle-details]:not(.hidden),#history [data-archive-vehicle-details]:not(.hidden)')]
      .map((node) => node.getAttribute('data-vehicle-details') || node.closest('[data-archive-vehicle]')?.dataset.archiveVehicle)
      .filter(Boolean);
    const openEntries = [...document.querySelectorAll('#history [data-service-details]:not(.hidden),#history [data-archive-order-details]:not(.hidden)')]
      .map((node) => node.getAttribute('data-service-details') || node.closest('[data-archive-order]')?.dataset.archiveOrder)
      .filter(Boolean);
    sessionStorage.setItem('edm28_history_open', JSON.stringify({ vehicles:openVehicles, entries:openEntries }));
  }

  function keepFullHistoryVisible() {
    const vehicleHistory = document.querySelector('#historyList [data-vehicle-history]');
    if (vehicleHistory) vehicleHistory.hidden = false;
  }

  function restoreHistoryState() {
    keepFullHistoryVisible();
    let savedState;
    try { savedState = JSON.parse(sessionStorage.getItem('edm28_history_open') || '{}'); } catch (_) { savedState = {}; }
    (savedState.vehicles || []).forEach((id) => {
      document.querySelector(`#history [data-vehicle-details="${CSS.escape(id)}"]`)?.classList.remove('hidden');
      document.querySelector(`#history [data-archive-vehicle="${CSS.escape(id)}"] [data-archive-vehicle-details]`)?.classList.remove('hidden');
    });
    (savedState.entries || []).forEach((id) => {
      document.querySelector(`#history [data-service-details="${CSS.escape(id)}"]`)?.classList.remove('hidden');
      document.querySelector(`#history [data-archive-order="${CSS.escape(id)}"] [data-archive-order-details]`)?.classList.remove('hidden');
    });
  }

  async function refreshGarageFromDb() {
    if (typeof supabaseClient === 'undefined' || typeof state === 'undefined') return;
    const session = await supabaseClient.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;
    const result = await supabaseClient.from('vehicles').select('id,plate,plate_normalized,brand,model,year,energy,mileage').eq('user_id', user.id).order('updated_at', { ascending:false });
    if (result.error) throw result.error;
    state.vehicles = (result.data || []).map((row) => ({ id:row.id, plate:row.plate, plateNormalized:row.plate_normalized, brand:row.brand || '', model:row.model || '', year:row.year || '', energy:row.energy || '', mileage:row.mileage || '' }));
    if (typeof renderSavedVehicles === 'function') renderSavedVehicles();
    if (typeof renderGarage === 'function') renderGarage();
  }

  async function signedOpen(path) {
    const result = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 180);
    if (result.error || !result.data?.signedUrl) throw result.error || new Error('OR indisponible.');
    window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function annotateRequestStatus() {
    const statusPage = document.getElementById('request-status');
    const host = document.getElementById('requestStatusList');
    if (!host || !statusPage?.classList.contains('active') || typeof supabaseClient === 'undefined') return;
    const session = await supabaseClient.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;
    const [ordersResult, invoicesResult, quotesResult] = await Promise.all([
      supabaseClient.from('repair_orders').select('id,service_request_id,order_number,pdf_path,status,visible_to_client,appointment_id').eq('user_id', user.id).eq('visible_to_client', true).not('pdf_path','is',null),
      supabaseClient.from('invoices').select('repair_order_id,status,visible_to_client').eq('user_id', user.id).eq('visible_to_client', true),
      supabaseClient.from('quotes').select('id,service_request_id,status').eq('user_id', user.id).eq('visible_to_client', true)
    ]);
    if (ordersResult.error || invoicesResult.error || quotesResult.error) return;
    const invoicedOrders = new Set((invoicesResult.data || []).filter((x) => ['issued','partially_paid','paid','overdue'].includes(x.status)).map((x) => x.repair_order_id));
    const acceptedRequests = new Set((quotesResult.data || []).filter((x) => x.status === 'accepted').map((x) => x.service_request_id));
    for (const card of host.querySelectorAll('[data-status-request]')) {
      const requestId = card.dataset.statusRequest;
      const actions = card.querySelector('.btn-row');
      if (!actions) continue;
      const order = (ordersResult.data || []).find((x) => x.service_request_id === requestId && !invoicedOrders.has(x.id));
      if (order && !actions.querySelector('[data-temp-order-doc]')) {
        actions.insertAdjacentHTML('beforeend', `<button class="btn btn-ghost" type="button" data-temp-order-doc="${esc(order.pdf_path)}">Ouvrir l’OR ${esc(order.order_number || '')}</button>`);
      }
      if (acceptedRequests.has(requestId) && !order?.appointment_id && !actions.querySelector('[data-go-booking]')) {
        actions.insertAdjacentHTML('beforeend', '<button class="btn btn-primary" type="button" data-go-booking>Préparer mon RDV</button>');
      }
    }
  }

  function installEvents() {
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-go-request-status]')) navigate('request-status');
      if (event.target.closest?.('[data-go-booking]')) navigate('booking');
      const order = event.target.closest?.('[data-temp-order-doc]');
      if (order) signedOpen(order.dataset.tempOrderDoc).catch(() => {});
      if (event.target.closest?.('[data-vehicle-doc],[data-archive-doc]')) rememberHistoryState();
      if (event.target.closest?.('[data-page="garage"]')) setTimeout(() => refreshGarageFromDb().catch(() => {}), 80);
      if (event.target.closest?.('[data-page="history"]')) setTimeout(restoreHistoryState, 180);
      if (event.target.closest?.('[data-page="request-status"]')) setTimeout(() => annotateRequestStatus().catch(() => {}), 180);
      if (event.target.closest?.('[data-prepare-slot]')) setTimeout(() => markSelectedSlot(event.target), 0);

      const accepted = event.target.closest?.('[data-status-quote][data-response="accepted"]');
      if (accepted) {
        const quoteId = accepted.dataset.statusQuote;
        window.setTimeout(async () => {
          const result = await supabaseClient.from('quotes').select('status').eq('id', quoteId).maybeSingle();
          if (result.data?.status === 'accepted') navigate('booking');
        }, 700);
      }
    }, true);

    window.addEventListener('pageshow', () => {
      if (document.getElementById('garage')?.classList.contains('active')) refreshGarageFromDb().catch(() => {});
      if (document.getElementById('history')?.classList.contains('active')) setTimeout(restoreHistoryState, 100);
      if (document.getElementById('request-status')?.classList.contains('active')) setTimeout(() => annotateRequestStatus().catch(() => {}), 100);
    });
  }

  function normalizeAll() {
    ensurePartsChoice();
    normalizeDisbursementPage();
    normalizeBookingPage();
    keepFullHistoryVisible();
    restoreHistoryState();
    annotateRequestStatus().catch(() => {});
  }

  function install() {
    installStyles();
    ensurePartsChoice();
    installEvents();
    const observer = new MutationObserver(() => window.setTimeout(normalizeAll, 0));
    observer.observe(document.body, { childList:true, subtree:true });
    normalizeAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();