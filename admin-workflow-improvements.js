(() => {
  if (window.__edmAdminWorkflowImprovementsInstalled) return;
  window.__edmAdminWorkflowImprovementsInstalled = true;

  const A = () => window.EDMAdmin;
  const statusChoices = [
    ['todo', 'À faire'],
    ['done', 'Fait'],
    ['replace', 'Remplacer']
  ];
  const workshopChecks = [
    { key: 'niveau_huile_moteur', label: 'Niveau huile moteur' },
    { key: 'niveau_liquide_refroidissement', label: 'Niveau liquide de refroidissement' },
    { key: 'niveau_liquide_frein', label: 'Niveau liquide de frein' },
    { key: 'niveau_lave_glace', label: 'Niveau lave-glace' },
    { key: 'pression_pneu_av_g', label: 'Pression pneu avant gauche', unit: 'bar' },
    { key: 'pression_pneu_av_d', label: 'Pression pneu avant droit', unit: 'bar' },
    { key: 'pression_pneu_ar_g', label: 'Pression pneu arrière gauche', unit: 'bar' },
    { key: 'pression_pneu_ar_d', label: 'Pression pneu arrière droit', unit: 'bar' },
    { key: 'essuie_glace_av', label: 'Essuie-glaces avant' },
    { key: 'essuie_glace_ar', label: 'Essuie-glace arrière' },
    { key: 'feux_position', label: 'Feux de position' },
    { key: 'feux_croisement', label: 'Feux de croisement' },
    { key: 'feux_route', label: 'Feux de route' },
    { key: 'feux_stop', label: 'Feux stop' },
    { key: 'feux_recul', label: 'Feux de recul' },
    { key: 'feux_antibrouillard_av', label: 'Antibrouillards avant' },
    { key: 'feux_antibrouillard_ar', label: 'Antibrouillard arrière' },
    { key: 'feux_plaque', label: 'Éclairage de plaque' },
    { key: 'clignotant_av_g', label: 'Clignotant avant gauche' },
    { key: 'clignotant_av_d', label: 'Clignotant avant droit' },
    { key: 'clignotant_ar_g', label: 'Clignotant arrière gauche' },
    { key: 'clignotant_ar_d', label: 'Clignotant arrière droit' }
  ];

  const esc = (value) => A()?.esc ? A().esc(value ?? '') : String(value ?? '');

  function selectHtml(key, current) {
    return `<select data-workshop-status="${key}">${statusChoices.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  }

  function checklistHtml(values = {}) {
    return `<section data-workshop-checks class="card" style="margin-top:12px;padding:12px">
      <h4>Contrôles atelier complémentaires</h4>
      <p class="muted">Renseigner chaque point : à faire, fait ou à remplacer.</p>
      <div class="grid2">${workshopChecks.map((item) => {
        const value = values?.[item.key] || {};
        const status = typeof value === 'string' ? value : value.status || 'todo';
        const measure = typeof value === 'object' ? value.measure ?? '' : '';
        return `<label>${esc(item.label)}${item.unit ? `<div class="toolbar"><input data-workshop-measure="${item.key}" type="number" min="0" step="0.1" value="${esc(measure)}" placeholder="${item.unit}" style="min-width:0"><span class="muted">${item.unit}</span></div>` : ''}${selectHtml(item.key, status)}</label>`;
      }).join('')}</div>
    </section>`;
  }

  function readChecklist(card) {
    const result = {};
    workshopChecks.forEach((item) => {
      const status = card.querySelector(`[data-workshop-status="${item.key}"]`)?.value || 'todo';
      const measureInput = card.querySelector(`[data-workshop-measure="${item.key}"]`);
      result[item.key] = {
        status,
        measure: measureInput && measureInput.value !== '' ? Number(measureInput.value) : null
      };
    });
    return result;
  }

  async function decorateOrders() {
    const app = A();
    const host = document.getElementById('repairOrderList');
    if (!app?.db || !host) return;
    const cards = [...host.querySelectorAll('[data-repair-order]')];
    if (!cards.length) return;
    const ids = cards.map((card) => card.dataset.repairOrder).filter(Boolean);
    if (!ids.length) return;
    const result = await app.db.from('repair_orders').select('id,internal_saved_at,workshop_checks').in('id', ids);
    if (result.error) return;
    const rows = new Map((result.data || []).map((row) => [row.id, row]));

    cards.forEach((card) => {
      const row = rows.get(card.dataset.repairOrder);
      if (!row) return;
      if (row.internal_saved_at) {
        card.remove();
        return;
      }
      if (!card.querySelector('[data-workshop-checks]')) {
        const saveButton = card.querySelector('[data-save-order]');
        const totals = card.querySelector('[data-order-total]')?.closest('.grid2');
        if (totals) totals.insertAdjacentHTML('beforebegin', checklistHtml(row.workshop_checks || {}));
        else if (saveButton) saveButton.insertAdjacentHTML('beforebegin', checklistHtml(row.workshop_checks || {}));
      }
      const saveButton = card.querySelector('[data-save-order]');
      if (!saveButton || saveButton.dataset.workflowBound === 'true') return;
      saveButton.dataset.workflowBound = 'true';
      saveButton.addEventListener('click', () => {
        const snapshot = readChecklist(card);
        const statusNode = document.getElementById('repairOrderStatus');
        if (!statusNode) return;
        const observer = new MutationObserver(async () => {
          const message = String(statusNode.textContent || '');
          if (!/enregistré en interne/i.test(message) || statusNode.classList.contains('error')) return;
          observer.disconnect();
          const now = new Date().toISOString();
          const updated = await app.db.from('repair_orders').update({ workshop_checks: snapshot, internal_saved_at: now, updated_at: now }).eq('id', card.dataset.repairOrder).select('id');
          if (updated.error) {
            app.status('repairOrderStatus', `Ordre enregistré, mais checklist non sauvegardée : ${updated.error.message}`, true);
            return;
          }
          await decorateOrders();
          const remaining = host.querySelectorAll('[data-repair-order]').length;
          if (!remaining) host.innerHTML = '<p class="muted">Aucun ordre de réparation à enregistrer en interne.</p>';
          await app.overview();
        });
        observer.observe(statusNode, { childList: true, subtree: true, attributes: true });
        window.setTimeout(() => observer.disconnect(), 15000);
      });
    });

    if (!host.querySelector('[data-repair-order]')) {
      host.innerHTML = '<p class="muted">Aucun ordre de réparation à enregistrer en interne.</p>';
    }
  }

  async function refreshWorkflowKpis() {
    const app = A();
    const host = document.getElementById('overviewOperationalKpis');
    if (!app?.db || !host) return;
    const [requestResult, quoteResult] = await Promise.all([
      app.db.from('service_requests').select('id,status'),
      app.db.from('quotes').select('id,service_request_id,status')
    ]);
    if (requestResult.error || quoteResult.error) return;
    const requests = requestResult.data || [];
    const quotes = quoteResult.data || [];
    const quoteRequestIds = new Set(quotes.map((quote) => quote.service_request_id).filter(Boolean));
    const activeRequests = requests.filter((request) => request.status !== 'cancelled');
    const requestsToTreat = activeRequests.filter((request) => !quoteRequestIds.has(request.id) && !['quoted','closed','completed'].includes(request.status)).length;
    const requestsProcessed = activeRequests.filter((request) => quoteRequestIds.has(request.id) || ['quoted','closed','completed'].includes(request.status)).length;
    const quotesCreated = quotes.length;
    const quotesToCreate = activeRequests.filter((request) => !quoteRequestIds.has(request.id)).length;

    host.querySelectorAll('[data-workflow-kpi]').forEach((node) => node.remove());
    const cards = [
      ['Demandes à traiter', requestsToTreat],
      ['Demandes traitées', requestsProcessed],
      ['Devis à créer', quotesToCreate],
      ['Devis créés', quotesCreated]
    ];
    host.insertAdjacentHTML('afterbegin', cards.map(([label, value]) => `<article class="card kpi" data-workflow-kpi><span>${esc(label)}</span><strong>${value}</strong></article>`).join(''));
  }

  function installOverviewWrapper() {
    const app = A();
    if (!app?.overview || app.overview.__workflowWrapped) return false;
    const original = app.overview.bind(app);
    const wrapped = async (...args) => {
      const result = await original(...args);
      await refreshWorkflowKpis();
      return result;
    };
    wrapped.__workflowWrapped = true;
    app.overview = wrapped;
    refreshWorkflowKpis().catch(() => {});
    return true;
  }

  function bind() {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const installed = installOverviewWrapper();
      if (installed || attempts > 80) window.clearInterval(timer);
    }, 100);

    const rootObserver = new MutationObserver(() => decorateOrders().catch(() => {}));
    const dashboard = document.getElementById('dashboard');
    if (dashboard) rootObserver.observe(dashboard, { childList: true, subtree: true });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-page="repair-orders"],#repairOrderRefresh')) {
        window.setTimeout(() => decorateOrders().catch(() => {}), 100);
      }
    });
    window.setTimeout(() => decorateOrders().catch(() => {}), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
