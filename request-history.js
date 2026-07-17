(() => {
  const labels = {
    draft: 'Enregistrée',
    submitted: 'Transmise',
    reviewed: 'Étudiée',
    quoted: 'Devis disponible',
    confirmed: 'Confirmée',
    cancelled: 'Annulée'
  };

  async function renderRequests() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;

    const [{ data: requests, error }, { data: vehicles }] = await Promise.all([
      supabaseClient.from('service_requests').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }),
      supabaseClient.from('vehicles').select('id,plate,brand,model').eq('user_id', state.user.id)
    ]);
    if (error) throw error;

    const vehicleMap = new Map((vehicles || []).map((vehicle) => [vehicle.id, vehicle]));
    const section = document.createElement('section');
    section.className = 'panel';
    section.style.marginBottom = '18px';
    section.dataset.requestHistory = 'true';

    const cards = (requests || []).map((request) => {
      const vehicle = vehicleMap.get(request.vehicle_id) || {};
      const services = Array.isArray(request.services)
        ? request.services.map((service) => service.name || service.id).filter(Boolean).join(' · ')
        : '';
      return `<article class="card">
        <div class="section-title"><div><span class="pill orange">${escapeHtml(labels[request.status] || request.status)}</span><h3 style="margin-top:10px">${escapeHtml(vehicle.plate || 'Véhicule')}</h3></div><strong>${new Date(request.created_at).toLocaleDateString('fr-FR')}</strong></div>
        <p>${escapeHtml(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule enregistré')}</p>
        <p class="small">${escapeHtml(services || 'Prestations à confirmer')}</p>
      </article>`;
    }).join('');

    section.innerHTML = `<h3>Demandes en cours</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune demande enregistrée.</div>'}</div>`;
    host.querySelector('[data-request-history]')?.remove();
    host.prepend(section);
  }

  function scheduleRender() {
    setTimeout(() => renderRequests().catch((error) => console.warn('EDM request history unavailable', error)), 400);
  }

  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', scheduleRender));
  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) scheduleRender();
    });
  }
})();