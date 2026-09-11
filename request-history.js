(() => {
  if (window.__edmRequestHistoryInstalled) return;
  window.__edmRequestHistoryInstalled = true;

  const labels = {
    draft: 'Enregistrée',
    submitted: 'Transmise',
    reviewed: 'Étudiée',
    quoted: 'Devis disponible',
    confirmed: 'Confirmée',
    cancelled: 'Annulée'
  };

  let renderSequence = 0;
  let scheduledTimer = null;

  const safeHtml = (value) => {
    try {
      if (typeof escapeHtml === 'function') return escapeHtml(value);
    } catch (_) {}
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  };

  const formatMoney = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    try {
      if (typeof money === 'function') return money(number);
    } catch (_) {}
    return number.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const formatDate = (value) => {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleString('fr-FR');
  };

  async function currentUserId() {
    try {
      if (typeof state !== 'undefined' && state?.user?.id) return state.user.id;
    } catch (_) {}

    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user?.id || null;
  }

  function requestTotal(request) {
    const totals = request.totals || {};
    const minimum = Number(totals.totalAllMin ?? totals.totalMin);
    const maximum = Number(totals.totalAllMax ?? totals.totalMax ?? minimum);
    if (!Number.isFinite(minimum)) return '';
    if (!Number.isFinite(maximum) || maximum === minimum) return formatMoney(minimum);
    return `${formatMoney(minimum)} à ${formatMoney(maximum)}`;
  }

  function installHostObserver() {
    const host = document.getElementById('historyList');
    if (!host || host.dataset.requestHistoryObserved === '1') return;
    host.dataset.requestHistoryObserved = '1';

    new MutationObserver(() => {
      const historyActive = document.getElementById('history')?.classList.contains('active');
      const requestSectionPresent = Boolean(host.querySelector('[data-request-history]'));
      if (historyActive && !requestSectionPresent) scheduleRender(75);
    }).observe(host, { childList: true, subtree: false });
  }

  async function renderRequests() {
    const host = document.getElementById('historyList');
    if (!host) return;
    installHostObserver();

    const sequence = ++renderSequence;
    const userId = await currentUserId();
    if (sequence !== renderSequence) return;

    if (!userId) {
      host.querySelector('[data-request-history]')?.remove();
      return;
    }

    let section = host.querySelector('[data-request-history]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'card';
      section.dataset.requestHistory = 'true';
      host.prepend(section);
    }
    section.innerHTML = '<div class="notice">Chargement des demandes...</div>';

    const [{ data: requests, error: requestsError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
      supabaseClient
        .from('service_requests')
        .select('id,vehicle_id,status,selected_basket,services,notes,totals,created_at,submitted_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabaseClient
        .from('vehicles')
        .select('id,plate,brand,model')
        .eq('user_id', userId)
    ]);

    if (sequence !== renderSequence) return;
    if (requestsError) throw requestsError;
    if (vehiclesError) throw vehiclesError;

    const vehicleMap = new Map((vehicles || []).map((vehicle) => [vehicle.id, vehicle]));
    const cards = (requests || []).map((request) => {
      const vehicle = vehicleMap.get(request.vehicle_id) || {};
      const services = Array.isArray(request.services)
        ? request.services.map((service) => service.name || service.id).filter(Boolean).join(' · ')
        : '';
      const total = requestTotal(request);
      const date = request.submitted_at || request.created_at;

      return `<article class="card" data-service-request-id="${safeHtml(request.id)}">
        <div class="section-title">
          <div>
            <span class="pill orange">${safeHtml(labels[request.status] || request.status || 'Enregistrée')}</span>
            <h3 style="margin-top:10px">${safeHtml(vehicle.plate || 'Véhicule')}</h3>
          </div>
          <strong>${safeHtml(formatDate(date))}</strong>
        </div>
        <p>${safeHtml(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule enregistré')}</p>
        <p class="small">${safeHtml(services || 'Prestations à confirmer')}</p>
        <div class="service-meta">
          ${request.selected_basket ? `<span class="pill blue">Panier ${safeHtml(String(request.selected_basket).toUpperCase())}</span>` : ''}
          ${total ? `<span class="pill green">${safeHtml(total)}</span>` : ''}
        </div>
      </article>`;
    }).join('');

    section.innerHTML = `<h3>Demandes envoyées</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune demande enregistrée.</div>'}</div>`;
  }

  function scheduleRender(delay = 0) {
    clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(() => {
      renderRequests().catch((error) => {
        console.warn('EDM request history unavailable', error);
        const section = document.querySelector('#historyList [data-request-history]');
        if (section) section.innerHTML = '<div class="errorbox">Impossible de charger les demandes pour le moment.</div>';
      });
    }, delay);
  }

  window.renderRequestHistory = renderRequests;

  window.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-page="history"]');
    if (button) scheduleRender(50);
  }, true);

  window.addEventListener('edm:request-submitted', () => scheduleRender(0));
  window.addEventListener('pageshow', () => {
    installHostObserver();
    if (document.getElementById('history')?.classList.contains('active')) scheduleRender(100);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHostObserver, { once: true });
  } else {
    installHostObserver();
  }

  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) scheduleRender(250);
      else document.querySelector('#historyList [data-request-history]')?.remove();
    });
  }
})();
