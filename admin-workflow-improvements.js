(() => {
  if (window.__edmAdminWorkflowImprovementsInstalled) return;
  window.__edmAdminWorkflowImprovementsInstalled = true;

  const A = () => window.EDMAdmin;
  const esc = (value) => A()?.esc ? A().esc(value ?? '') : String(value ?? '');

  const serviceStatuses = [
    ['a_faire', 'À faire'],
    ['fait', 'Fait'],
    ['remplacer', 'Remplacer']
  ];
  const levelStatuses = [
    ['a_faire', 'À faire'],
    ['fait', 'Fait']
  ];
  const conformStatuses = [
    ['conforme', 'Conforme'],
    ['non_conforme', 'Non conforme']
  ];

  const levelControls = [
    ['niveau_huile_moteur', 'Niveau huile moteur'],
    ['niveau_liquide_refroidissement', 'Niveau liquide de refroidissement'],
    ['niveau_lave_glace', 'Niveau lave-glace']
  ];

  const conformityControls = [
    ['essuie_glace_av', 'Essuie-glaces avant'],
    ['essuie_glace_ar', 'Essuie-glace arrière'],
    ['klaxon', 'Klaxon'],
    ['feu_position_av_g', 'Feu de position avant gauche'],
    ['feu_position_av_d', 'Feu de position avant droit'],
    ['feu_position_ar_g', 'Feu de position arrière gauche'],
    ['feu_position_ar_d', 'Feu de position arrière droit'],
    ['feu_croisement_g', 'Feu de croisement gauche'],
    ['feu_croisement_d', 'Feu de croisement droit'],
    ['feu_route_g', 'Feu de route gauche'],
    ['feu_route_d', 'Feu de route droit'],
    ['feu_stop_g', 'Feu stop gauche'],
    ['feu_stop_d', 'Feu stop droit'],
    ['feu_stop_central', 'Troisième feu stop'],
    ['feu_recul_g', 'Feu de recul gauche'],
    ['feu_recul_d', 'Feu de recul droit'],
    ['antibrouillard_av_g', 'Antibrouillard avant gauche'],
    ['antibrouillard_av_d', 'Antibrouillard avant droit'],
    ['antibrouillard_ar', 'Antibrouillard arrière'],
    ['eclairage_plaque_g', 'Éclairage de plaque gauche'],
    ['eclairage_plaque_d', 'Éclairage de plaque droit'],
    ['clignotant_av_g', 'Clignotant avant gauche'],
    ['clignotant_av_d', 'Clignotant avant droit'],
    ['clignotant_ar_g', 'Clignotant arrière gauche'],
    ['clignotant_ar_d', 'Clignotant arrière droit'],
    ['repetiteur_g', 'Répétiteur latéral gauche'],
    ['repetiteur_d', 'Répétiteur latéral droit'],
    ['feux_detresse', 'Feux de détresse']
  ];

  let activeServicesPromise = null;

  async function activeServices() {
    if (!activeServicesPromise) {
      activeServicesPromise = A().db.from('site_services').select('external_service_id,name').eq('active', true).then(({ data, error }) => {
        if (error) throw error;
        return new Map((data || []).filter((row) => row.external_service_id).map((row) => [row.external_service_id, row.name]));
      }).catch(() => new Map());
    }
    return activeServicesPromise;
  }

  function statusButtons(current, choices) {
    return choices.map(([value, label]) => `<button type="button" class="btn ${current === value ? 'primary' : 'ghost'}" data-control-status="${value}">${esc(label)}</button>`).join('');
  }

  function controlCard(key, label, current, choices) {
    return `<article class="card" data-control="${esc(key)}" data-status="${esc(current)}" style="padding:12px;margin:8px 0">
      <strong>${esc(label)}</strong>
      <div class="toolbar" style="margin-top:8px">${statusButtons(current, choices)}</div>
      <input data-control-note type="hidden" value="">
    </article>`;
  }

  function normalizeStatus(value, choices, fallback = '') {
    const allowed = new Set(choices.map(([status]) => status));
    if (allowed.has(value)) return value;
    if (choices === levelStatuses) {
      if (value === 'conforme') return 'fait';
      if (value === 'non_conforme' || value === 'surveiller' || value === 'remplacer') return 'a_faire';
    }
    if (choices === conformStatuses) {
      if (value === 'surveiller' || value === 'remplacer') return 'non_conforme';
    }
    return fallback;
  }

  function reconfigureExistingControl(detail, key, label, choices, checks) {
    const row = detail.querySelector(`[data-control="${key}"]`);
    if (!row) return;
    if (label) {
      const title = row.querySelector('strong');
      if (title) title.textContent = label;
    }
    const stored = checks?.[key];
    const raw = row.dataset.status || (typeof stored === 'string' ? stored : stored?.status) || '';
    const current = normalizeStatus(raw, choices, '');
    row.dataset.status = current || 'non_controle';
    const toolbar = row.querySelector('.toolbar');
    if (toolbar) toolbar.innerHTML = statusButtons(current, choices);
  }

  function bindStatusButtons(root) {
    root.querySelectorAll('[data-control-status]').forEach((button) => {
      if (button.dataset.workflowBound === 'true') return;
      button.dataset.workflowBound = 'true';
      button.addEventListener('click', () => {
        const row = button.closest('[data-control]');
        row.dataset.status = button.dataset.controlStatus;
        row.querySelectorAll('[data-control-status]').forEach((choice) => {
          choice.className = `btn ${choice === button ? 'primary' : 'ghost'}`;
        });
      });
    });
  }

  async function enhanceInterventions() {
    const app = A();
    const host = document.getElementById('interventionList');
    if (!app?.db || !host) return;
    const opened = [...host.querySelectorAll('[data-order]')].filter((card) => {
      const detail = card.querySelector('[data-detail]');
      return detail && !detail.classList.contains('hidden') && !detail.dataset.workflowEnhanced;
    });
    if (!opened.length) return;

    const ids = opened.map((card) => card.dataset.order).filter(Boolean);
    const [ordersResult, reportsResult, servicesMap] = await Promise.all([
      app.db.from('repair_orders').select('id,service_request_id,service_requests(services)').in('id', ids),
      app.db.from('inspection_reports').select('repair_order_id,checks').in('repair_order_id', ids),
      activeServices()
    ]);
    if (ordersResult.error || reportsResult.error) return;
    const orders = new Map((ordersResult.data || []).map((row) => [row.id, row]));
    const reports = new Map((reportsResult.data || []).map((row) => [row.repair_order_id, row]));

    opened.forEach((card) => {
      const order = orders.get(card.dataset.order);
      const report = reports.get(card.dataset.order);
      const detail = card.querySelector('[data-detail]');
      if (!order || !detail) return;
      const checks = report?.checks || {};
      const requested = Array.isArray(order.service_requests?.services) ? order.service_requests.services : [];
      const offered = requested.filter((service) => servicesMap.has(String(service?.id || '')));

      if (offered.length && !detail.querySelector('[data-edm-service-progress]')) {
        const measureHeading = [...detail.querySelectorAll('h3')].find((node) => /mesures et contrôles/i.test(node.textContent || ''));
        const section = document.createElement('section');
        section.dataset.edmServiceProgress = 'true';
        section.innerHTML = `<h3>Prestations EDM28</h3><p class="muted">À faire / Fait / Remplacer uniquement pour les prestations EDM28 demandées.</p>${offered.map((service) => {
          const key = `service_${String(service.id).replace(/[^a-z0-9_-]/gi, '_')}`;
          const stored = checks[key];
          const raw = typeof stored === 'string' ? stored : stored?.status || 'a_faire';
          const current = normalizeStatus(raw, serviceStatuses, 'a_faire');
          return controlCard(key, service.name || servicesMap.get(String(service.id)) || service.id, current, serviceStatuses);
        }).join('')}`;
        if (measureHeading) measureHeading.insertAdjacentElement('beforebegin', section);
        else detail.prepend(section);
      }

      reconfigureExistingControl(detail, 'liquide_frein', 'Niveau liquide de frein', levelStatuses, checks);
      ['pression_av_g','pression_av_d','pression_ar_g','pression_ar_d'].forEach((key) => reconfigureExistingControl(detail, key, null, conformStatuses, checks));

      if (!detail.querySelector('[data-edm-extra-checks]')) {
        const photosHeading = [...detail.querySelectorAll('h3')].find((node) => /photos avant/i.test(node.textContent || ''));
        const section = document.createElement('section');
        section.dataset.edmExtraChecks = 'true';
        section.innerHTML = `<h3>Contrôles complémentaires</h3>
          <p class="muted">Niveaux : À faire / Fait. Pression pneus, essuie-glaces, éclairage et klaxon : Conforme / Non conforme.</p>
          ${levelControls.map(([key, label]) => {
            const stored = checks[key];
            const raw = typeof stored === 'string' ? stored : stored?.status || 'a_faire';
            return controlCard(key, label, normalizeStatus(raw, levelStatuses, 'a_faire'), levelStatuses);
          }).join('')}
          ${conformityControls.map(([key, label]) => {
            const stored = checks[key];
            const raw = typeof stored === 'string' ? stored : stored?.status || '';
            return controlCard(key, label, normalizeStatus(raw, conformStatuses, ''), conformStatuses);
          }).join('')}`;
        if (photosHeading) photosHeading.insertAdjacentElement('beforebegin', section);
        else detail.appendChild(section);
      }

      bindStatusButtons(detail);
      detail.dataset.workflowEnhanced = 'true';
    });
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
      if (installOverviewWrapper() || attempts > 80) window.clearInterval(timer);
    }, 100);

    const observer = new MutationObserver(() => enhanceInterventions().catch(() => {}));
    const dashboard = document.getElementById('dashboard');
    if (dashboard) observer.observe(dashboard, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-page="interventions"],#interventionRefresh,[data-open]')) {
        window.setTimeout(() => enhanceInterventions().catch(() => {}), 150);
        window.setTimeout(() => enhanceInterventions().catch(() => {}), 700);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
