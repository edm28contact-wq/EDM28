(() => {
  if (window.__edmClientRequestStatusHistoryInstalled) return;
  window.__edmClientRequestStatusHistoryInstalled = true;

  const STEPS = [
    'Envoyé',
    'Étudié',
    'Devis envoyé',
    'Intervention en préparation',
    'OR envoyé',
    'Intervention finie',
    'Facture envoyée'
  ];
  const PUBLISHED_INVOICE_STATUSES = new Set(['issued', 'partially_paid', 'paid', 'overdue']);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const byDateDesc = (a, b) => new Date(b?.created_at || b?.issued_at || 0) - new Date(a?.created_at || a?.issued_at || 0);
  let historyObserver = null;
  let historyRenderQueued = false;

  async function currentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleDateString('fr-FR');
  }

  function serviceNames(request) {
    return (Array.isArray(request?.services) ? request.services : [])
      .map((service) => typeof service === 'string' ? service : service?.name || service?.label || service?.id)
      .filter(Boolean)
      .join(' · ');
  }

  function installStyle() {
    if (document.getElementById('edm-request-status-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-request-status-style';
    style.textContent = `
      .edm-status-card{margin:14px 0}
      .edm-status-track{display:grid;grid-template-columns:repeat(7,minmax(112px,1fr));overflow-x:auto;padding:14px 0 6px;scrollbar-width:thin}
      .edm-status-step{position:relative;text-align:center;min-width:112px;padding:0 8px;color:var(--muted)}
      .edm-status-step:not(:last-child)::after{content:"";position:absolute;left:calc(50% + 18px);right:calc(-50% + 18px);top:16px;height:3px;background:var(--border);z-index:0}
      .edm-status-step.done:not(:last-child)::after{background:var(--green)}
      .edm-status-dot{position:relative;z-index:1;width:34px;height:34px;margin:0 auto 8px;border-radius:50%;display:grid;place-items:center;background:white;border:3px solid var(--border);font-weight:1000;color:var(--muted)}
      .edm-status-step.done .edm-status-dot{background:var(--green);border-color:var(--green);color:white}
      .edm-status-step.current .edm-status-dot{background:var(--orange-soft);border-color:var(--orange);color:var(--orange)}
      .edm-status-step.current{color:var(--ink);font-weight:900}
      .edm-status-step.done{color:var(--green);font-weight:800}
      .edm-status-label{font-size:.82rem;line-height:1.25}
      .edm-archive-vehicle,.edm-archive-intervention{margin:12px 0}
      .edm-archive-toggle{width:100%;background:transparent;color:inherit;text-align:left;padding:0;border:0}
      .edm-doc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
      .edm-doc{border:1px solid var(--border);border-radius:16px;padding:12px;background:white}
      @media(max-width:700px){.edm-doc-grid{grid-template-columns:1fr}.edm-status-track{grid-template-columns:repeat(7,124px)}}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    installStyle();
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-page="request-status"]')) {
      const button = document.createElement('button');
      button.dataset.page = 'request-status';
      button.textContent = '📍 Statut de ma demande';
      const history = nav.querySelector('[data-page="history"]');
      nav.insertBefore(button, history || null);
    }

    const main = document.querySelector('main.main');
    if (main && !document.getElementById('request-status')) {
      const section = document.createElement('section');
      section.id = 'request-status';
      section.className = 'page';
      section.innerHTML = `<div class="panel">
        <div class="section-title">
          <div><h2>Statut de ma demande</h2><p>Suivez chaque dossier depuis son envoi jusqu’à la publication de la facture.</p></div>
          <button class="btn btn-ghost" id="requestStatusRefresh" type="button">Actualiser</button>
        </div>
        <div id="requestStatusList"></div>
      </div>`;
      const history = document.getElementById('history');
      main.insertBefore(section, history || null);
      section.querySelector('#requestStatusRefresh')?.addEventListener('click', () => renderRequestStatus().catch(showStatusError));
    }
  }

  async function loadJourneyData(userId) {
    const results = await Promise.all([
      supabaseClient.from('service_requests')
        .select('id,vehicle_id,status,services,notes,submitted_at,created_at,updated_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseClient.from('vehicles')
        .select('id,plate,brand,model,year').eq('user_id', userId),
      supabaseClient.from('quotes')
        .select('id,vehicle_id,service_request_id,quote_number,status,visible_to_client,pdf_path,valid_until,created_at,updated_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseClient.from('appointments')
        .select('id,vehicle_id,service_request_id,status,visible_to_client,starts_at,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseClient.from('repair_orders')
        .select('id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,visible_to_client,pdf_path,signed_at,created_at,updated_at')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseClient.from('invoices')
        .select('id,vehicle_id,quote_id,repair_order_id,invoice_number,status,visible_to_client,pdf_path,issued_at,created_at,updated_at')
        .eq('user_id', userId).order('created_at', { ascending: false })
    ]);
    const failure = results.find((result) => result.error)?.error;
    if (failure) throw failure;
    return {
      requests: results[0].data || [],
      vehicles: results[1].data || [],
      quotes: results[2].data || [],
      appointments: results[3].data || [],
      orders: results[4].data || [],
      invoices: results[5].data || []
    };
  }

  function requestRelations(request, data) {
    const quotes = data.quotes.filter((quote) => quote.service_request_id === request.id).sort(byDateDesc);
    const quoteIds = new Set(quotes.map((quote) => quote.id));
    const appointments = data.appointments.filter((appointment) => appointment.service_request_id === request.id).sort(byDateDesc);
    const orders = data.orders.filter((order) => order.service_request_id === request.id || quoteIds.has(order.quote_id)).sort(byDateDesc);
    const orderIds = new Set(orders.map((order) => order.id));
    const invoices = data.invoices.filter((invoice) => orderIds.has(invoice.repair_order_id) || quoteIds.has(invoice.quote_id)).sort(byDateDesc);
    return { quotes, appointments, orders, invoices };
  }

  function publishedQuote(rows) {
    return rows.find((row) => row.visible_to_client && ['sent', 'accepted', 'refused'].includes(row.status)) || null;
  }

  function publishedInvoice(rows) {
    return rows.find((row) => row.visible_to_client && row.pdf_path && PUBLISHED_INVOICE_STATUSES.has(row.status)) || null;
  }

  function stageFor(request, relations) {
    let stage = 1;
    const quote = publishedQuote(relations.quotes);
    const accepted = relations.quotes.some((row) => row.status === 'accepted');
    const order = relations.orders[0] || null;
    const publishedOrder = relations.orders.find((row) => row.visible_to_client && row.pdf_path) || null;
    const invoice = publishedInvoice(relations.invoices);

    if (['reviewed', 'quoted', 'confirmed', 'completed', 'closed'].includes(request.status) || relations.quotes.length) stage = 2;
    if (quote) stage = 3;
    if (accepted || relations.appointments.length || relations.orders.length) stage = Math.max(stage, 4);
    if (publishedOrder) stage = Math.max(stage, 5);
    if (relations.orders.some((row) => ['completed', 'invoiced'].includes(row.status))) stage = Math.max(stage, 6);
    if (invoice) stage = 7;

    return { stage, quote, order, invoice, refused: quote?.status === 'refused' };
  }

  function timelineHtml(stage) {
    return `<div class="edm-status-track" role="list" aria-label="Avancement du dossier">${STEPS.map((label, index) => {
      const number = index + 1;
      const className = number < stage ? 'done' : number === stage ? 'current' : '';
      return `<div class="edm-status-step ${className}" role="listitem" ${number === stage ? 'aria-current="step"' : ''}>
        <div class="edm-status-dot">${number < stage ? '✓' : number}</div>
        <div class="edm-status-label">${esc(label)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function quoteActions(quote) {
    if (!quote || quote.status !== 'sent') return quote?.pdf_path
      ? `<button class="btn btn-ghost" type="button" data-status-doc="${esc(quote.pdf_path)}">Ouvrir le devis</button>`
      : '';
    const expired = quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10);
    return `<div class="btn-row">
      ${quote.pdf_path ? `<button class="btn btn-ghost" type="button" data-status-doc="${esc(quote.pdf_path)}">Ouvrir le devis</button>` : ''}
      ${expired ? '<span class="pill red">Devis expiré</span>' : `<button class="btn btn-primary" type="button" data-status-quote="${esc(quote.id)}" data-response="accepted">Accepter</button><button class="btn btn-ghost" type="button" data-status-quote="${esc(quote.id)}" data-response="refused">Refuser</button>`}
    </div>`;
  }

  async function openDocument(path) {
    if (!path) throw new Error('PDF indisponible.');
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error || !data?.signedUrl) throw error || new Error('Lien PDF indisponible.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function respondToQuote(id, status) {
    if (!['accepted', 'refused'].includes(status)) return;
    const result = await supabaseClient.from('quotes').update({ status }).eq('id', id).eq('status', 'sent').select('id');
    if (result.error) throw result.error;
    if (!result.data?.length) throw new Error('Ce devis a déjà été traité ou a expiré.');
  }

  function showStatusError(error) {
    const host = document.getElementById('requestStatusList');
    if (host) host.innerHTML = `<div class="errorbox">${esc(error?.message || 'Impossible de charger le suivi pour le moment.')}</div>`;
  }

  async function renderRequestStatus() {
    installUi();
    const host = document.getElementById('requestStatusList');
    if (!host) return;
    const user = await currentUser();
    if (!user) {
      host.innerHTML = '<div class="notice">Connectez-vous pour suivre vos demandes.</div>';
      return;
    }
    host.innerHTML = '<div class="notice">Chargement du suivi…</div>';
    const data = await loadJourneyData(user.id);
    const vehicles = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));

    const cards = data.requests.map((request) => {
      const vehicle = vehicles.get(request.vehicle_id) || {};
      const relations = requestRelations(request, data);
      const progress = stageFor(request, relations);
      const currentLabel = progress.refused ? 'Devis refusé' : STEPS[progress.stage - 1];
      const title = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule';
      const services = serviceNames(request) || 'Prestations à confirmer';
      const archiveButton = progress.stage === 7
        ? `<button class="btn btn-primary" type="button" data-open-archive data-vehicle-id="${esc(request.vehicle_id || '')}" data-order-id="${esc(progress.order?.id || '')}">Voir l’intervention dans l’historique</button>`
        : '';
      return `<article class="card edm-status-card" data-status-request="${esc(request.id)}">
        <div class="section-title">
          <div><span class="pill ${progress.stage === 7 ? 'green' : progress.refused ? 'red' : 'orange'}">${esc(currentLabel)}</span><h3 style="margin-top:10px">${esc(vehicle.plate || 'Véhicule')}</h3><p>${esc(title)} · ${esc(services)}</p></div>
          <strong>${esc(formatDate(request.submitted_at || request.created_at))}</strong>
        </div>
        ${timelineHtml(progress.stage)}
        ${progress.refused ? '<div class="notice">Le devis a été refusé. Cette demande ne passera pas en préparation atelier sans nouveau devis accepté.</div>' : ''}
        <div class="btn-row">${quoteActions(progress.quote)}${archiveButton}</div>
      </article>`;
    }).join('');
    host.innerHTML = cards || '<div class="empty">Aucune demande envoyée.</div>';

    host.querySelectorAll('[data-status-doc]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await openDocument(button.dataset.statusDoc); }
      catch (error) { alert(error.message || 'PDF indisponible.'); }
      finally { button.disabled = false; }
    }));

    host.querySelectorAll('[data-status-quote]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await respondToQuote(button.dataset.statusQuote, button.dataset.response);
        await renderRequestStatus();
      } catch (error) {
        alert(error.message || 'Réponse impossible.');
      } finally {
        button.disabled = false;
      }
    }));

    host.querySelectorAll('[data-open-archive]').forEach((button) => button.addEventListener('click', async () => {
      window.__edmHistoryFocus = { vehicleId: button.dataset.vehicleId || '', orderId: button.dataset.orderId || '' };
      if (typeof window.__edmNavigate === 'function') await window.__edmNavigate('history');
      else document.querySelector('[data-page="history"]')?.click();
      window.setTimeout(() => renderCompletedInterventionHistory().catch((error) => console.warn('EDM intervention archive unavailable', error)), 50);
    }));
  }

  function completedArchiveRows(data) {
    const quoteMap = new Map(data.quotes.map((quote) => [quote.id, quote]));
    const orderMap = new Map(data.orders.map((order) => [order.id, order]));
    return data.invoices
      .filter((invoice) => invoice.visible_to_client && invoice.pdf_path && PUBLISHED_INVOICE_STATUSES.has(invoice.status))
      .map((invoice) => {
        let order = invoice.repair_order_id ? orderMap.get(invoice.repair_order_id) : null;
        if (!order && invoice.quote_id) order = data.orders.find((candidate) => candidate.quote_id === invoice.quote_id) || null;
        const quote = quoteMap.get(invoice.quote_id) || (order?.quote_id ? quoteMap.get(order.quote_id) : null) || null;
        const vehicleId = invoice.vehicle_id || order?.vehicle_id || quote?.vehicle_id || '';
        return { invoice, order, quote, vehicleId };
      })
      .filter((row) => row.vehicleId)
      .sort((a, b) => new Date(b.invoice.issued_at || b.invoice.created_at || 0) - new Date(a.invoice.issued_at || a.invoice.created_at || 0));
  }

  function documentCard(label, number, path) {
    return `<div class="edm-doc"><strong>${esc(label)}</strong><p class="small">${esc(number || 'Sans numéro')}</p>${path
      ? `<button class="btn btn-ghost" type="button" data-archive-doc="${esc(path)}">Ouvrir le PDF</button>`
      : '<span class="pill red">PDF indisponible</span>'}</div>`;
  }

  function hideLegacyHistory(section) {
    const host = document.getElementById('historyList');
    if (!host) return;
    [...host.children].forEach((child) => { if (child !== section) child.hidden = true; });
  }

  function applyHistoryFocus(section) {
    const focus = window.__edmHistoryFocus;
    if (!focus) return;
    const vehicleCard = [...section.querySelectorAll('[data-archive-vehicle]')].find((node) => node.dataset.archiveVehicle === focus.vehicleId);
    if (vehicleCard) vehicleCard.querySelector('[data-archive-vehicle-details]')?.classList.remove('hidden');
    const interventionCard = [...section.querySelectorAll('[data-archive-order]')].find((node) => node.dataset.archiveOrder === focus.orderId);
    if (interventionCard) interventionCard.querySelector('[data-archive-order-details]')?.classList.remove('hidden');
    window.__edmHistoryFocus = null;
  }

  async function renderCompletedInterventionHistory() {
    installUi();
    const host = document.getElementById('historyList');
    if (!host) return;
    const user = await currentUser();
    if (!user) return;

    let section = host.querySelector('[data-completed-intervention-history]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'panel';
      section.dataset.completedInterventionHistory = 'true';
      host.prepend(section);
    }
    hideLegacyHistory(section);
    section.hidden = false;
    section.innerHTML = '<div class="notice">Chargement des interventions terminées…</div>';

    const data = await loadJourneyData(user.id);
    const vehicles = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const rows = completedArchiveRows(data);
    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.vehicleId)) grouped.set(row.vehicleId, []);
      grouped.get(row.vehicleId).push(row);
    });

    const vehicleCards = [...grouped.entries()].map(([vehicleId, interventions]) => {
      const vehicle = vehicles.get(vehicleId) || {};
      const title = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule';
      const interventionCards = interventions.map(({ invoice, order, quote }) => {
        const interventionNumber = order?.order_number || invoice.invoice_number || 'Intervention';
        const orderKey = order?.id || `invoice-${invoice.id}`;
        return `<article class="card edm-archive-intervention" data-archive-order="${esc(orderKey)}">
          <button class="edm-archive-toggle" type="button" data-archive-order-toggle>
            <div class="section-title"><div><span class="pill green">Terminée</span><h3 style="margin-top:10px">${esc(interventionNumber)}</h3><p class="small">Facture ${esc(invoice.invoice_number || '')}</p></div><strong>${esc(formatDate(invoice.issued_at || invoice.created_at))}</strong></div>
          </button>
          <div class="hidden" data-archive-order-details>
            <div class="edm-doc-grid">
              ${documentCard('Devis', quote?.quote_number, quote?.visible_to_client ? quote?.pdf_path : null)}
              ${documentCard('Ordre de réparation', order?.order_number, order?.visible_to_client ? order?.pdf_path : null)}
              ${documentCard('Facture', invoice.invoice_number, invoice.pdf_path)}
            </div>
          </div>
        </article>`;
      }).join('');
      return `<article class="card edm-archive-vehicle" data-archive-vehicle="${esc(vehicleId)}">
        <button class="edm-archive-toggle" type="button" data-archive-vehicle-toggle>
          <div class="section-title"><div><span class="pill blue">${esc(vehicle.plate || 'Sans plaque')}</span><h3 style="margin-top:10px">${esc(title)}</h3><p class="small">${esc([vehicle.year].filter(Boolean).join(''))}</p></div><div style="text-align:right"><strong>${interventions.length}</strong><p class="small">intervention${interventions.length > 1 ? 's' : ''}</p></div></div>
        </button>
        <div class="hidden" data-archive-vehicle-details>${interventionCards}</div>
      </article>`;
    }).join('');

    section.innerHTML = `<div class="section-title"><div><h2>Historique des interventions</h2><p>Cliquez sur une voiture, puis sur le numéro d’intervention pour retrouver le devis, l’OR et la facture.</p></div></div>${vehicleCards || '<div class="empty">Aucune intervention terminée avec facture publiée.</div>'}`;
    hideLegacyHistory(section);

    section.querySelectorAll('[data-archive-vehicle-toggle]').forEach((button) => button.addEventListener('click', () => {
      button.closest('[data-archive-vehicle]')?.querySelector('[data-archive-vehicle-details]')?.classList.toggle('hidden');
    }));
    section.querySelectorAll('[data-archive-order-toggle]').forEach((button) => button.addEventListener('click', () => {
      button.closest('[data-archive-order]')?.querySelector('[data-archive-order-details]')?.classList.toggle('hidden');
    }));
    section.querySelectorAll('[data-archive-doc]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await openDocument(button.dataset.archiveDoc); }
      catch (error) { alert(error.message || 'PDF indisponible.'); }
      finally { button.disabled = false; }
    }));
    applyHistoryFocus(section);
  }

  function installHistoryObserver() {
    const host = document.getElementById('historyList');
    if (!host || historyObserver) return;
    historyObserver = new MutationObserver(() => {
      const section = host.querySelector('[data-completed-intervention-history]');
      if (section) hideLegacyHistory(section);
      if (!document.getElementById('history')?.classList.contains('active') || section || historyRenderQueued) return;
      historyRenderQueued = true;
      window.setTimeout(() => {
        historyRenderQueued = false;
        renderCompletedInterventionHistory().catch((error) => console.warn('EDM intervention archive unavailable', error));
      }, 75);
    });
    historyObserver.observe(host, { childList: true });
  }

  function install() {
    installUi();
    installHistoryObserver();
    if (document.getElementById('request-status')?.classList.contains('active')) renderRequestStatus().catch(showStatusError);
    if (document.getElementById('history')?.classList.contains('active')) renderCompletedInterventionHistory().catch((error) => console.warn('EDM intervention archive unavailable', error));
  }

  window.renderRequestStatus = renderRequestStatus;
  window.renderCompletedInterventionHistory = renderCompletedInterventionHistory;

  window.addEventListener('edm:request-submitted', () => {
    if (document.getElementById('request-status')?.classList.contains('active')) renderRequestStatus().catch(showStatusError);
  });

  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      if (document.getElementById('request-status')?.classList.contains('active')) window.setTimeout(() => renderRequestStatus().catch(showStatusError), 100);
      if (document.getElementById('history')?.classList.contains('active')) window.setTimeout(() => renderCompletedInterventionHistory().catch((error) => console.warn('EDM intervention archive unavailable', error)), 100);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
