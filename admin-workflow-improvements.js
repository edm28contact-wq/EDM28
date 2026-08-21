(() => {
  if (window.__edmAdminWorkflowImprovementsInstalled) return;
  window.__edmAdminWorkflowImprovementsInstalled = true;

  const A = () => window.EDMAdmin;
  const serviceStatusChoices = [
    ['todo', 'À faire'],
    ['done', 'Fait'],
    ['replace', 'Remplacer']
  ];
  const checkStatusChoices = [
    ['todo', 'À contrôler'],
    ['ok', 'Conforme'],
    ['action', 'À corriger'],
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

  let activeServicePromise = null;
  const esc = (value) => A()?.esc ? A().esc(value ?? '') : String(value ?? '');
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  async function activeServices() {
    if (!activeServicePromise) {
      activeServicePromise = A().db.from('site_services')
        .select('external_service_id,name,slug,category')
        .eq('active', true)
        .then(({ data, error }) => {
          if (error) throw error;
          return new Map((data || []).filter((service) => service.external_service_id).map((service) => [service.external_service_id, service]));
        })
        .catch(() => new Map());
    }
    return activeServicePromise;
  }

  function selectHtml(attribute, key, current, choices) {
    const allowed = new Set(choices.map(([value]) => value));
    let selected = allowed.has(current) ? current : choices[0][0];
    if (choices === checkStatusChoices && current === 'done') selected = 'ok';
    if (choices === serviceStatusChoices && current === 'ok') selected = 'done';
    return `<select ${attribute}="${esc(key)}">${choices.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  }

  function checklistHtml(values = {}) {
    return `<section data-workshop-checks class="card" style="margin-top:12px;padding:12px">
      <h4>Contrôles complémentaires</h4>
      <p class="muted">Ces points ne sont pas des prestations EDM28 : ils sont notés À contrôler, Conforme, À corriger ou Remplacer.</p>
      <div class="grid2">${workshopChecks.map((item) => {
        const value = values?.[item.key] || {};
        const status = typeof value === 'string' ? value : value.status || 'todo';
        const measure = typeof value === 'object' ? value.measure ?? '' : '';
        return `<label>${esc(item.label)}${item.unit ? `<div class="toolbar"><input data-workshop-measure="${item.key}" type="number" min="0" step="0.1" value="${esc(measure)}" placeholder="${item.unit}" style="min-width:0"><span class="muted">${item.unit}</span></div>` : ''}${selectHtml('data-workshop-status', item.key, status, checkStatusChoices)}</label>`;
      }).join('')}</div>
    </section>`;
  }

  function serviceEntries(row, activeMap) {
    const requested = Array.isArray(row.service_requests?.services) ? row.service_requests.services : [];
    const exact = requested
      .map((service) => {
        const id = String(service?.id || '');
        const active = activeMap.get(id);
        if (!active) return null;
        return { id, name: service?.name || active.name || id };
      })
      .filter(Boolean);
    if (exact.length) return exact;

    const work = Array.isArray(row.authorized_work) ? row.authorized_work : [];
    const found = [];
    for (const active of activeMap.values()) {
      const serviceName = normalize(active.name);
      if (!serviceName) continue;
      const matched = work.some((item) => {
        const text = normalize(`${item?.designation || item?.name || ''} ${item?.description || ''}`);
        if (!text) return false;
        if (text.includes(serviceName) || serviceName.includes(text)) return true;
        if (/plaquette/.test(serviceName) && /plaquette/.test(text)) return true;
        if (/disque/.test(serviceName) && /disque/.test(text)) return true;
        if (/purge|liquide de frein/.test(serviceName) && /purge|liquide de frein/.test(text)) return true;
        if (/triangle/.test(serviceName) && /triangle/.test(text)) return true;
        if (/rotule|direction/.test(serviceName) && /rotule|direction/.test(text)) return true;
        if (/stabilis/.test(serviceName) && /stabilis/.test(text)) return true;
        return false;
      });
      if (matched) found.push({ id: active.external_service_id, name: active.name });
    }
    return found;
  }

  function serviceStatusHtml(entries, values = {}) {
    if (!entries.length) return '';
    return `<section data-service-statuses class="card" style="margin-top:12px;padding:12px">
      <h4>Suivi des prestations EDM28</h4>
      <p class="muted">Le statut « Fait » est disponible uniquement pour les services actuellement proposés par EDM28.</p>
      <div class="grid2">${entries.map((service) => {
        const stored = values?.[service.id];
        const status = typeof stored === 'string' ? stored : stored?.status || 'todo';
        return `<label><strong>${esc(service.name)}</strong>${selectHtml('data-service-status', service.id, status, serviceStatusChoices)}</label>`;
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
    const serviceStatuses = {};
    card.querySelectorAll('[data-service-status]').forEach((select) => {
      serviceStatuses[select.dataset.serviceStatus] = { status: select.value };
    });
    result.service_statuses = serviceStatuses;
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
    const [result, activeMap] = await Promise.all([
      app.db.from('repair_orders').select('id,internal_saved_at,workshop_checks,authorized_work,service_request_id,service_requests(services)').in('id', ids),
      activeServices()
    ]);
    if (result.error) return;
    const rows = new Map((result.data || []).map((row) => [row.id, row]));

    cards.forEach((card) => {
      const row = rows.get(card.dataset.repairOrder);
      if (!row) return;
      if (row.internal_saved_at) {
        card.remove();
        return;
      }

      const totals = card.querySelector('[data-order-total]')?.closest('.grid2');
      const saveButton = card.querySelector('[data-save-order]');
      const anchor = totals || saveButton;
      const entries = serviceEntries(row, activeMap);
      if (!card.querySelector('[data-service-statuses]') && entries.length && anchor) {
        anchor.insertAdjacentHTML('beforebegin', serviceStatusHtml(entries, row.workshop_checks?.service_statuses || {}));
      }
      if (!card.querySelector('[data-workshop-checks]') && anchor) {
        anchor.insertAdjacentHTML('beforebegin', checklistHtml(row.workshop_checks || {}));
      }

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
            app.status('repairOrderStatus', `Ordre enregistré, mais suivi atelier non sauvegardé : ${updated.error.message}`, true);
            return;
          }
          card.remove();
          if (!host.querySelector('[data-repair-order]')) host.innerHTML = '<p class="muted">Aucun ordre de réparation à enregistrer en interne.</p>';
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
