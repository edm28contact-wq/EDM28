(() => {
  const app = () => window.EDMAdmin;
  const labels = { submitted: 'Reçue', reviewed: 'Étudiée', quoted: 'Devis créé', cancelled: 'Annulée' };
  const money = (r, key, fallback = 0) => Number(r?.totals?.[key] ?? fallback);

  async function setStatus(id, status) {
    const allowed = status === 'reviewed' ? ['submitted'] : status === 'cancelled' ? ['submitted', 'reviewed'] : [];
    if (!allowed.length) return;
    const { data, error } = await app().db.from('service_requests').update({ status }).eq('id', id).in('status', allowed).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('La demande a déjà changé de statut.');
  }

  async function createQuote(request) {
    if (request.status !== 'reviewed') throw new Error('La demande doit être étudiée avant création du devis.');
    const externalId = `request/${request.id}`;
    const { data: existing, error: lookupError } = await app().db.from('quotes').select('id').eq('service_request_id', request.id).limit(1);
    if (lookupError) throw lookupError;
    let quoteId = existing?.[0]?.id;
    if (!quoteId) {
      const min = money(request, 'totalAllMin', money(request, 'laborAfter'));
      const max = money(request, 'totalAllMax', min);
      const discount = money(request, 'comboSaving');
      const services = Array.isArray(request.services) ? request.services : [];
      const description = services.map((s) => s.name || s.id || 'Prestation').join(', ');
      const { data, error } = await app().db.from('quotes').insert({
        user_id: request.user_id,
        vehicle_id: request.vehicle_id,
        service_request_id: request.id,
        external_quote_id: externalId,
        status: 'draft',
        title: 'Devis EDM AUTO',
        description: `${description}${request.notes ? `\nNotes client : ${request.notes}` : ''}`,
        subtotal: max + discount,
        discount,
        total: max,
        visible_to_client: false
      }).select('id').single();
      if (error) throw error;
      quoteId = data.id;
    }
    const { data: updated, error: statusError } = await app().db.from('service_requests').update({ status: 'quoted' }).eq('id', request.id).eq('status', 'reviewed').select('id');
    if (statusError) throw statusError;
    if (!updated?.length) throw new Error('Le devis existe, mais le statut de la demande a changé.');
    return quoteId;
  }

  function render(rows) {
    const host = app().$('requestList');
    host.innerHTML = rows.length ? rows.map((r) => {
      const client = r.profiles || {};
      const vehicle = r.vehicles || {};
      const services = Array.isArray(r.services) ? r.services : [];
      const min = money(r, 'totalAllMin', money(r, 'laborAfter'));
      const max = money(r, 'totalAllMax', min);
      const actions = r.status === 'submitted'
        ? `<button class="btn primary" data-action="reviewed" data-id="${r.id}">Marquer étudiée</button><button class="btn ghost" data-action="cancelled" data-id="${r.id}">Annuler</button>`
        : `<button class="btn primary" data-action="quote" data-id="${r.id}">Créer le devis</button><button class="btn ghost" data-action="cancelled" data-id="${r.id}">Annuler</button>`;
      return `<article class="card" style="margin:12px 0"><div class="top"><div><span class="pill">${app().esc(labels[r.status] || r.status)}</span><h3>${app().esc(`${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Client')}</h3></div><strong>${app().money(min)}${max !== min ? ` à ${app().money(max)}` : ''}</strong></div><p>${app().esc(vehicle.plate || '-')} · ${app().esc(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule')}</p><p>${services.map((s) => app().esc(s.name || s.id || 'Prestation')).join(' · ') || 'Aucune prestation'}</p><p>${app().esc(r.notes || 'Aucune note client')}</p><div class="toolbar">${actions}</div></article>`;
    }).join('') : '<p class="muted">Aucune demande à traiter.</p>';

    host.querySelectorAll('[data-action]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          const request = rows.find((r) => r.id === button.dataset.id);
          if (button.dataset.action === 'quote') {
            await createQuote(request);
            app().status('requestStatus', 'Brouillon de devis créé. Il reste invisible au client.');
          } else {
            await setStatus(request.id, button.dataset.action);
          }
          await load();
          await app().overview();
        } catch (error) {
          app().status('requestStatus', error.message || 'Opération impossible.', true);
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  async function load() {
    const host = app().$('requestList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('service_requests').select('id,user_id,vehicle_id,status,services,notes,totals,created_at,submitted_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,mileage)').in('status', ['submitted', 'reviewed']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  window.EDMAdminRequests = { load };
})();