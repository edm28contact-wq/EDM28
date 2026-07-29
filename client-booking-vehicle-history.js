(() => {
  if (window.__edmBookingVehicleHistoryInstalled) return;
  window.__edmBookingVehicleHistoryInstalled = true;

  const BOOKING_URL = 'https://calendar.app.google/CfmuTgoQ84bBMvnr8';
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const dateTime = (value) => {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleString('fr-FR');
  };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  async function user() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function installBookingPage() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-page="booking"]')) {
      const button = document.createElement('button');
      button.dataset.page = 'booking';
      button.innerHTML = '📅 Choisir mon RDV';
      const historyButton = nav.querySelector('[data-page="history"]');
      nav.insertBefore(button, historyButton || nav.lastElementChild);
    }

    const main = document.querySelector('main.main');
    if (main && !document.getElementById('booking')) {
      const section = document.createElement('section');
      section.id = 'booking';
      section.className = 'page';
      section.innerHTML = `
        <div class="panel">
          <div class="section-title">
            <div>
              <h2>Choisir mon rendez-vous</h2>
              <p>Consultez les créneaux disponibles dans le planning Google EDM28, puis sélectionnez celui qui vous convient.</p>
            </div>
            <a class="btn btn-primary" href="${BOOKING_URL}" target="_blank" rel="noopener noreferrer">Ouvrir le planning</a>
          </div>
          <div class="notice">Réservez de préférence après acceptation de votre devis afin que la durée de l’intervention soit correctement prévue.</div>
          <div style="margin-top:18px;border:1px solid var(--border);border-radius:22px;overflow:hidden;background:white;min-height:680px">
            <iframe title="Planning Google EDM28" src="${BOOKING_URL}" style="width:100%;height:680px;border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
          <p class="small" style="margin-top:12px">Si Google refuse l’affichage intégré sur votre appareil, utilisez le bouton « Ouvrir le planning ».</p>
        </div>`;
      const history = document.getElementById('history');
      main.insertBefore(section, history || null);
    }
  }

  function serviceNames(request) {
    return (Array.isArray(request?.services) ? request.services : [])
      .map((service) => typeof service === 'string' ? service : service?.name || service?.label || service?.id)
      .filter(Boolean);
  }

  function detailsRows(items) {
    return items.filter((item) => item.value !== '' && item.value != null).map((item) => `
      <div class="summary-line"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join('');
  }

  function serviceCard(item) {
    const details = detailsRows(item.details || []);
    const documents = (item.documents || []).filter((doc) => doc.path).map((doc) => `
      <button class="btn btn-ghost" type="button" data-vehicle-doc="${esc(doc.path)}">${esc(doc.label)}</button>`).join('');
    return `<article class="card" data-vehicle-service="${esc(item.id)}" style="margin:10px 0">
      <button type="button" data-service-toggle="${esc(item.id)}" style="width:100%;background:transparent;text-align:left;padding:0;color:inherit">
        <div class="section-title">
          <div><span class="pill blue">${esc(item.type)}</span><h3 style="margin-top:10px">${esc(item.title)}</h3><p class="small">${esc(item.date)}</p></div>
          <span class="pill">${esc(item.status || '')}</span>
        </div>
      </button>
      <div data-service-details="${esc(item.id)}" class="hidden" style="margin-top:14px">
        <div class="summary">${details || '<div class="notice">Aucun détail complémentaire disponible.</div>'}</div>
        ${documents ? `<div class="btn-row">${documents}</div>` : ''}
      </div>
    </article>`;
  }

  async function renderVehicleHistory() {
    const host = document.getElementById('historyList');
    if (!host) return;
    const currentUser = await user();
    if (!currentUser) return;

    let section = host.querySelector('[data-vehicle-history]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'panel';
      section.dataset.vehicleHistory = 'true';
      host.prepend(section);
    }
    section.innerHTML = '<div class="notice">Chargement de l’historique par véhicule…</div>';

    const [vehicles, requests, quotes, orders, appointments, invoices, inspections] = await Promise.all([
      supabaseClient.from('vehicles').select('id,plate,brand,model,year,energy,engine,mileage,created_at').eq('user_id', currentUser.id).order('created_at'),
      supabaseClient.from('service_requests').select('id,vehicle_id,status,selected_basket,services,notes,totals,j7_accepted,refuse_control,submitted_at,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabaseClient.from('quotes').select('id,vehicle_id,service_request_id,quote_number,status,title,description,subtotal,discount,total,valid_until,pdf_path,created_at,quote_items(designation,description,quantity,unit_price,total)').eq('user_id', currentUser.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('repair_orders').select('id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,pdf_path,signed_at,created_at').eq('user_id', currentUser.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('appointments').select('id,vehicle_id,service_request_id,starts_at,ends_at,status,notes,created_at').eq('user_id', currentUser.id).eq('visible_to_client', true).order('starts_at', { ascending: false }),
      supabaseClient.from('invoices').select('id,vehicle_id,quote_id,repair_order_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,payment_method,issued_at,due_at,paid_at,pdf_path,created_at,invoice_items(description,quantity,unit_price,line_total)').eq('user_id', currentUser.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('inspection_reports').select('id,vehicle_id,repair_order_id,appointment_id,report_number,status,mileage,customer_request,checks,observations,completed_at,pdf_path,created_at').eq('user_id', currentUser.id).eq('visible_to_client', true).order('created_at', { ascending: false })
    ]);

    const error = [vehicles, requests, quotes, orders, appointments, invoices, inspections].find((result) => result.error)?.error;
    if (error) throw error;

    const byVehicle = new Map((vehicles.data || []).map((vehicle) => [vehicle.id, { vehicle, entries: [] }]));
    const add = (vehicleId, entry) => {
      if (!vehicleId || !byVehicle.has(vehicleId)) return;
      byVehicle.get(vehicleId).entries.push(entry);
    };

    (requests.data || []).forEach((row) => {
      const names = serviceNames(row);
      const totals = row.totals || {};
      add(row.vehicle_id, {
        id: `request-${row.id}`,
        type: 'Demande',
        title: names.join(' · ') || 'Demande mécanique',
        date: dateTime(row.submitted_at || row.created_at),
        status: row.status,
        timestamp: row.submitted_at || row.created_at,
        details: [
          { label: 'Prestations demandées', value: names.join(', ') || 'À confirmer' },
          { label: 'Gamme de pièces', value: row.selected_basket ? String(row.selected_basket).toUpperCase() : '' },
          { label: 'Estimation', value: totals.totalAllMin != null ? `${money(totals.totalAllMin)} à ${money(totals.totalAllMax ?? totals.totalAllMin)}` : '' },
          { label: 'Contrôle préalable', value: row.j7_accepted ? 'Accepté' : row.refuse_control ? 'Refusé' : 'Non renseigné' },
          { label: 'Notes / symptômes', value: row.notes || '' }
        ]
      });
    });

    (quotes.data || []).forEach((row) => add(row.vehicle_id, {
      id: `quote-${row.id}`,
      type: 'Devis',
      title: row.quote_number || row.title || 'Devis',
      date: dateTime(row.created_at),
      status: row.status,
      timestamp: row.created_at,
      details: [
        { label: 'Objet', value: row.title || '' },
        { label: 'Description', value: row.description || '' },
        { label: 'Prestations', value: (row.quote_items || []).map((item) => item.designation || item.description).filter(Boolean).join(', ') },
        { label: 'Sous-total', value: money(row.subtotal) },
        { label: 'Remise', value: money(row.discount) },
        { label: 'Total', value: money(row.total) },
        { label: 'Valable jusqu’au', value: row.valid_until ? new Date(`${row.valid_until}T00:00:00`).toLocaleDateString('fr-FR') : '' }
      ],
      documents: [{ label: 'Ouvrir le devis PDF', path: row.pdf_path }]
    }));

    (orders.data || []).forEach((row) => add(row.vehicle_id, {
      id: `order-${row.id}`,
      type: 'Intervention',
      title: row.order_number || 'Ordre de réparation',
      date: dateTime(row.signed_at || row.created_at),
      status: row.status,
      timestamp: row.signed_at || row.created_at,
      details: [
        { label: 'Travaux autorisés', value: Array.isArray(row.authorized_work) ? row.authorized_work.join(', ') : String(row.authorized_work || '') },
        { label: 'Kilométrage à l’entrée', value: row.mileage_in ? `${row.mileage_in.toLocaleString('fr-FR')} km` : '' },
        { label: 'État visible', value: row.visible_condition || '' },
        { label: 'Objets confiés', value: row.customer_items || '' }
      ],
      documents: [{ label: 'Ouvrir l’ordre de réparation', path: row.pdf_path }]
    }));

    (appointments.data || []).forEach((row) => add(row.vehicle_id, {
      id: `appointment-${row.id}`,
      type: 'Rendez-vous',
      title: row.starts_at ? new Date(row.starts_at).toLocaleString('fr-FR') : 'Rendez-vous',
      date: dateTime(row.created_at),
      status: row.status,
      timestamp: row.starts_at || row.created_at,
      details: [
        { label: 'Début', value: dateTime(row.starts_at) },
        { label: 'Fin', value: dateTime(row.ends_at) },
        { label: 'Informations', value: row.notes || '' }
      ]
    }));

    (invoices.data || []).forEach((row) => add(row.vehicle_id, {
      id: `invoice-${row.id}`,
      type: 'Facture',
      title: row.invoice_number || row.title || 'Facture',
      date: dateTime(row.issued_at || row.created_at),
      status: row.status,
      timestamp: row.issued_at || row.created_at,
      details: [
        { label: 'Détail des prestations', value: (row.invoice_items || []).map((item) => item.description).filter(Boolean).join(', ') },
        { label: 'Sous-total', value: money(row.subtotal) },
        { label: 'Remise', value: money(row.discount) },
        { label: 'Total', value: money(row.total) },
        { label: 'Montant payé', value: money(row.amount_paid) },
        { label: 'Mode de paiement', value: row.payment_method || '' },
        { label: 'Date de paiement', value: row.paid_at ? dateTime(row.paid_at) : '' }
      ],
      documents: [{ label: 'Ouvrir la facture PDF', path: row.pdf_path }]
    }));

    (inspections.data || []).forEach((row) => add(row.vehicle_id, {
      id: `inspection-${row.id}`,
      type: 'Contrôle',
      title: row.report_number || 'Fiche de contrôle',
      date: dateTime(row.completed_at || row.created_at),
      status: row.status,
      timestamp: row.completed_at || row.created_at,
      details: [
        { label: 'Kilométrage', value: row.mileage ? `${row.mileage.toLocaleString('fr-FR')} km` : '' },
        { label: 'Demande client', value: row.customer_request || '' },
        { label: 'Observations', value: row.observations || '' },
        { label: 'Contrôles réalisés', value: row.checks ? JSON.stringify(row.checks) : '' }
      ],
      documents: [{ label: 'Ouvrir la fiche de contrôle', path: row.pdf_path }]
    }));

    const vehicleCards = [...byVehicle.values()].map(({ vehicle, entries }) => {
      entries.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      const title = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule';
      return `<article class="card" data-history-vehicle="${esc(vehicle.id)}" style="margin:12px 0">
        <button type="button" data-vehicle-toggle="${esc(vehicle.id)}" style="width:100%;background:transparent;text-align:left;padding:0;color:inherit">
          <div class="section-title">
            <div><span class="pill blue">${esc(vehicle.plate || 'Sans plaque')}</span><h3 style="margin-top:10px">${esc(title)}</h3><p>${esc([vehicle.year, vehicle.energy, vehicle.engine].filter(Boolean).join(' · '))}</p></div>
            <div style="text-align:right"><strong>${entries.length}</strong><p class="small">élément${entries.length > 1 ? 's' : ''}</p></div>
          </div>
        </button>
        <div data-vehicle-details="${esc(vehicle.id)}" class="hidden" style="margin-top:16px">
          ${entries.length ? entries.map(serviceCard).join('') : '<div class="empty">Aucune prestation enregistrée pour ce véhicule.</div>'}
        </div>
      </article>`;
    }).join('');

    section.innerHTML = `<div class="section-title"><div><h2>Historique par véhicule</h2><p>Sélectionnez une voiture, puis une prestation pour consulter tous les détails.</p></div></div>${vehicleCards || '<div class="empty">Aucun véhicule enregistré.</div>'}`;

    section.querySelectorAll('[data-vehicle-toggle]').forEach((button) => button.addEventListener('click', () => {
      section.querySelector(`[data-vehicle-details="${CSS.escape(button.dataset.vehicleToggle)}"]`)?.classList.toggle('hidden');
    }));
    section.querySelectorAll('[data-service-toggle]').forEach((button) => button.addEventListener('click', () => {
      section.querySelector(`[data-service-details="${CSS.escape(button.dataset.serviceToggle)}"]`)?.classList.toggle('hidden');
    }));
    section.querySelectorAll('[data-vehicle-doc]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(button.dataset.vehicleDoc, 120);
        if (error || !data?.signedUrl) throw error || new Error('Document indisponible.');
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        if (typeof toast === 'function') toast(error.message || 'Document indisponible.');
      }
    }));
  }

  function install() {
    installBookingPage();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="history"]')) setTimeout(() => renderVehicleHistory().catch(console.warn), 100);
    });
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user && document.getElementById('history')?.classList.contains('active')) setTimeout(() => renderVehicleHistory().catch(console.warn), 150);
      });
    }
  }

  window.renderVehicleHistory = renderVehicleHistory;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();