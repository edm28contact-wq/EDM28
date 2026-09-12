(() => {
  if (window.__edmAdminWorkflowAdjustmentsInstalled) return;
  window.__edmAdminWorkflowAdjustmentsInstalled = true;

  const A = () => window.EDMAdmin;
  const ORDER_PAGE_COPY = 'Préparer les OR non publiés. Dès qu’un OR est validé et publié au client, il disparaît automatiquement de cette file.';
  let quoteModeCache = new Map();
  let repairOrderFilterRunning = false;
  let quoteModeLoading = false;

  function installStyle() {
    if (document.getElementById('edm-admin-workflow-adjustments-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-admin-workflow-adjustments-style';
    style.textContent = `
      .edm-parts-mode-note{margin:10px 0;padding:12px;border:1px solid #d0d5dd;border-radius:12px;background:#f8fafc}
      .edm-parts-mode-note strong{display:block;margin-bottom:4px}
      [data-repair-order][data-published-hidden="1"]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  async function loadQuoteModes() {
    if (quoteModeLoading || !A()?.db) return;
    const cards = [...document.querySelectorAll('#quoteList [data-quote-id]')];
    if (!cards.length) return;
    quoteModeLoading = true;
    try {
      const quoteIds = cards.map((card) => card.dataset.quoteId).filter(Boolean);
      const quoteResult = await A().db.from('quotes').select('id,service_request_id').in('id', quoteIds);
      if (quoteResult.error) return;
      const requestIds = [...new Set((quoteResult.data || []).map((row) => row.service_request_id).filter(Boolean))];
      const requestResult = requestIds.length
        ? await A().db.from('service_requests').select('id,parts_purchase_mode').in('id', requestIds)
        : { data: [], error: null };
      if (requestResult.error) return;
      const requestModes = new Map((requestResult.data || []).map((row) => [row.id, row.parts_purchase_mode || '']));
      quoteModeCache = new Map((quoteResult.data || []).map((row) => [row.id, requestModes.get(row.service_request_id) || '']));
      cards.forEach((card) => decorateQuoteCard(card));
    } finally {
      quoteModeLoading = false;
    }
  }

  function allPartReferencesPresent(card) {
    const partRows = [...card.querySelectorAll('[data-quote-line]')].filter((line) => line.querySelector('[data-line="type"]')?.value === 'part');
    if (!partRows.length) return true;
    return partRows.every((line) => Boolean(line.querySelector('[data-line="reference"]')?.value.trim()));
  }

  function modeHtml(mode) {
    if (mode === 'client_direct') {
      return '<strong>Achat direct par le client</strong>EDM28 doit renseigner la référence de chaque pièce dans le devis. Le client achète lui-même les références indiquées. Si le client achète une autre référence, la responsabilité d’EDM28 ne peut pas être engagée pour cette erreur d’achat.';
    }
    if (mode === 'edm_disbursement') {
      return '<strong>Débours EDM28</strong>EDM28 achète au nom et pour le compte du client dans la limite autorisée. Le client rembourse exactement le justificatif fournisseur, sans marge ni commission.';
    }
    return '<strong>Mode d’achat des pièces non renseigné</strong>Cette ancienne demande ne contient pas encore le nouveau choix achat direct / débours.';
  }

  function decorateQuoteCard(card) {
    const quoteId = card.dataset.quoteId;
    const mode = quoteModeCache.get(quoteId) || '';
    card.dataset.partsPurchaseMode = mode;
    let note = card.querySelector('[data-parts-mode-note]');
    if (!note) {
      note = document.createElement('div');
      note.dataset.partsModeNote = '1';
      note.className = 'edm-parts-mode-note';
      const top = card.querySelector(':scope > .top');
      if (top) top.insertAdjacentElement('afterend', note);
      else card.prepend(note);
    }
    const desired = modeHtml(mode);
    if (note.innerHTML !== desired) note.innerHTML = desired;
    updatePublishEligibility(card);
  }

  function updatePublishEligibility(card) {
    const publish = card.querySelector('[data-publish]');
    if (!publish) return;
    const mode = card.dataset.partsPurchaseMode || '';
    const missingReference = mode === 'client_direct' && !allPartReferencesPresent(card);
    publish.disabled = missingReference;
    publish.title = missingReference ? 'Renseignez la référence de chaque pièce avant publication.' : '';
    let warning = card.querySelector('[data-parts-ref-warning]');
    if (missingReference && !warning) {
      warning = document.createElement('p');
      warning.dataset.partsRefWarning = '1';
      warning.className = 'status error';
      warning.textContent = 'Achat direct client : renseignez la référence de chaque pièce avant de publier le devis.';
      publish.parentElement?.insertAdjacentElement('beforebegin', warning);
    }
    if (!missingReference) warning?.remove();
  }

  function simplifyInterventionEditor() {
    document.querySelectorAll('#interventionList [data-control="geometrie"]').forEach((row) => row.remove());
    document.querySelectorAll('#interventionList [data-control-measure]').forEach((input) => {
      const label = input.closest('label');
      if (label) label.remove();
      else input.remove();
    });
    document.querySelectorAll('#interventionList h3').forEach((heading) => {
      if (/mesures et contrôles/i.test(heading.textContent || '')) heading.textContent = 'Contrôles';
    });
  }

  async function hidePublishedRepairOrders() {
    if (repairOrderFilterRunning || !A()?.db) return;
    const host = document.getElementById('repairOrderList');
    if (!host) return;
    const cards = [...host.querySelectorAll('[data-repair-order]')];
    if (!cards.length) return;
    repairOrderFilterRunning = true;
    try {
      const ids = cards.map((card) => card.dataset.repairOrder).filter(Boolean);
      const result = await A().db.from('repair_orders').select('id,visible_to_client,pdf_path').in('id', ids);
      if (result.error) return;
      const published = new Set((result.data || []).filter((row) => row.visible_to_client && row.pdf_path).map((row) => row.id));
      cards.forEach((card) => {
        const next = published.has(card.dataset.repairOrder) ? '1' : '0';
        if (card.dataset.publishedHidden !== next) card.dataset.publishedHidden = next;
      });
      const visibleCards = cards.filter((card) => card.dataset.publishedHidden !== '1');
      let empty = host.querySelector('[data-edm-empty-orders]');
      if (!visibleCards.length) {
        if (!empty) {
          empty = document.createElement('p');
          empty.dataset.edmEmptyOrders = '1';
          empty.className = 'muted';
          empty.textContent = 'Aucun OR à préparer. Les OR validés et publiés sont retirés automatiquement de cette file.';
          host.appendChild(empty);
        }
      } else {
        empty?.remove();
      }
    } finally {
      repairOrderFilterRunning = false;
    }
  }

  function normalizeOrderPageCopy() {
    const section = document.getElementById('repair-orders');
    const paragraph = section?.querySelector('.top .muted');
    if (paragraph && paragraph.textContent !== ORDER_PAGE_COPY) paragraph.textContent = ORDER_PAGE_COPY;
  }

  function normalizeAll() {
    loadQuoteModes().catch(() => {});
    simplifyInterventionEditor();
    hidePublishedRepairOrders().catch(() => {});
    normalizeOrderPageCopy();
  }

  function observe() {
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        normalizeAll();
      });
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function installEvents() {
    document.addEventListener('input', (event) => {
      const card = event.target.closest?.('#quoteList [data-quote-id]');
      if (card && (event.target.matches('[data-line="reference"]') || event.target.matches('[data-line="type"]'))) updatePublishEligibility(card);
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="quotes"],#quoteRefresh')) setTimeout(() => loadQuoteModes().catch(() => {}), 100);
      if (event.target.closest?.('[data-page="repair-orders"],#repairOrderRefresh')) setTimeout(() => hidePublishedRepairOrders().catch(() => {}), 150);
      if (event.target.closest?.('[data-page="interventions"],#interventionRefresh,[data-open]')) setTimeout(simplifyInterventionEditor, 120);
    });
  }

  function install() {
    installStyle();
    installEvents();
    observe();
    normalizeAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();