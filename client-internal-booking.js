(() => {
  if (window.__edmInternalBookingInstalled) return;
  window.__edmInternalBookingInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const dateTime = (value) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle:'full', timeStyle:'short' }) : '';
  let selectedSlot = '';
  let currentState = null;

  async function user() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function section() { return document.getElementById('booking'); }
  function content() { return document.getElementById('prepareRdvContent'); }
  function status(message, error = false) {
    const host = document.getElementById('prepareRdvStatus');
    if (!host) return;
    host.innerHTML = message ? `<div class="${error ? 'errorbox' : 'okbox'}">${esc(message)}</div>` : '';
  }

  function installShell() {
    document.querySelectorAll('[data-page="booking"]').forEach((button) => { button.innerHTML = '📅 Préparer mon RDV'; });
    const host = section();
    if (!host) return;
    host.dataset.internalBooking = 'true';
    host.innerHTML = `<div class="panel"><div class="section-title"><div><h2>Préparer mon RDV</h2><p>Votre devis, votre décision puis votre rendez-vous au même endroit.</p></div><span class="pill blue">Parcours client</span></div><div id="prepareRdvStatus"></div><div id="prepareRdvContent"><div class="notice">Chargement de votre dossier…</div></div></div>`;
  }

  async function openPdf(path) {
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 180);
    if (error || !data?.signedUrl) throw error || new Error('Devis indisponible.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function loadState() {
    const currentUser = await user();
    if (!currentUser) return { user:null };

    const requestResult = await supabaseClient.from('service_requests')
      .select('id,status,created_at,submitted_at,vehicle_id,vehicles(plate,brand,model)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending:false })
      .limit(1)
      .maybeSingle();
    if (requestResult.error) throw requestResult.error;
    const request = requestResult.data;
    if (!request) return { user:currentUser, request:null };

    const quoteResult = await supabaseClient.from('quotes')
      .select('id,service_request_id,quote_number,status,title,description,total,valid_until,pdf_path,labor_duration_minutes,created_at')
      .eq('user_id', currentUser.id)
      .eq('service_request_id', request.id)
      .eq('visible_to_client', true)
      .order('created_at', { ascending:false })
      .limit(1)
      .maybeSingle();
    if (quoteResult.error) throw quoteResult.error;
    const quote = quoteResult.data;

    let appointment = null;
    let order = null;
    if (quote?.id) {
      const orderResult = await supabaseClient.from('repair_orders')
        .select('id,order_number,status,appointment_id,created_at')
        .eq('user_id', currentUser.id)
        .eq('quote_id', quote.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending:false })
        .limit(1)
        .maybeSingle();
      if (orderResult.error) throw orderResult.error;
      order = orderResult.data;
      if (order?.appointment_id) {
        const appointmentResult = await supabaseClient.from('appointments')
          .select('id,starts_at,ends_at,status')
          .eq('id', order.appointment_id)
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (appointmentResult.error) throw appointmentResult.error;
        appointment = appointmentResult.data;
      }
    }
    return { user:currentUser, request, quote, order, appointment };
  }

  function waitingView(state) {
    const vehicle = state.request?.vehicles;
    const vehicleText = vehicle ? [vehicle.plate, vehicle.brand, vehicle.model].filter(Boolean).join(' · ') : '';
    return `<div class="card"><span class="pill orange">En attente du devis</span><h3 style="margin-top:12px">Votre demande est bien enregistrée</h3><p>EDM28 étudie votre demande. Dès que le devis est publié, il apparaîtra ici et dans votre messagerie.</p>${vehicleText ? `<p class="small">${esc(vehicleText)}</p>` : ''}</div>`;
  }

  function refusedView() {
    return `<div class="card"><span class="pill">Devis refusé</span><h3 style="margin-top:12px">Aucun rendez-vous à préparer</h3><p>Le devis a été refusé. Si EDM28 publie une nouvelle proposition, elle apparaîtra automatiquement ici.</p></div>`;
  }

  function quoteView(state) {
    const q = state.quote;
    const expired = q.valid_until && q.valid_until < new Date().toISOString().slice(0,10);
    return `<div class="card"><div class="section-title"><div><span class="pill orange">Devis à valider</span><h3 style="margin-top:10px">${esc(q.quote_number || q.title || 'Devis EDM28')}</h3></div><strong>${money(q.total)}</strong></div><p>${esc(q.description || 'Votre devis est disponible.')}</p><p class="small">${q.valid_until ? `Valable jusqu’au ${new Date(q.valid_until + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}${expired ? ' · Expiré' : ''}</p><div class="btn-row">${q.pdf_path ? '<button id="prepareOpenQuote" class="btn btn-ghost" type="button">Ouvrir le devis</button>' : ''}<button id="prepareAcceptQuote" class="btn btn-success" type="button" ${expired ? 'disabled' : ''}>Accepter le devis</button><button id="prepareRefuseQuote" class="btn btn-danger" type="button">Refuser le devis</button></div></div>`;
  }

  async function slotsView(state) {
    const q = state.quote;
    const host = content();
    host.innerHTML = `<div class="card"><span class="pill green">Devis accepté</span><h3 style="margin-top:12px">Choisissez votre rendez-vous</h3><p>Le planning affiche uniquement les créneaux compatibles avec la durée prévue de votre intervention.</p></div><div class="card" style="margin-top:14px"><div id="prepareSlots"><div class="notice">Calcul des créneaux disponibles…</div></div><div id="prepareSelection" class="empty" style="margin-top:14px">Sélectionnez un créneau.</div><div class="btn-row"><button id="prepareConfirmSlot" class="btn btn-primary" type="button" disabled>Confirmer mon rendez-vous</button></div></div>`;
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const { data, error } = await supabaseClient.rpc('get_available_booking_slots', { p_quote_id:q.id, p_from:from, p_days:30 });
    if (error) throw error;
    const rows = data || [];
    const slotHost = document.getElementById('prepareSlots');
    if (!slotHost) return;
    if (!rows.length) { slotHost.innerHTML = '<div class="empty">Aucun créneau disponible dans les 30 prochains jours.</div>'; return; }
    const groups = new Map();
    rows.forEach((row) => {
      const d = new Date(row.starts_at);
      const key = d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    slotHost.innerHTML = [...groups.entries()].map(([day, slots]) => `<section class="card" style="margin:10px 0"><h3 style="text-transform:capitalize">${esc(day)}</h3><div class="btn-row">${slots.map((slot) => `<button type="button" class="btn btn-secondary" data-prepare-slot="${esc(slot.starts_at)}">${new Date(slot.starts_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</button>`).join('')}</div></section>`).join('');
    slotHost.querySelectorAll('[data-prepare-slot]').forEach((button) => button.onclick = () => {
      selectedSlot = button.dataset.prepareSlot;
      slotHost.querySelectorAll('[data-prepare-slot]').forEach((node) => node.classList.toggle('btn-blue', node === button));
      const start = new Date(selectedSlot);
      document.getElementById('prepareSelection').innerHTML = `<strong>${esc(dateTime(start))}</strong>`;
      document.getElementById('prepareSelection').className = 'notice';
      document.getElementById('prepareConfirmSlot').disabled = false;
    });
    document.getElementById('prepareConfirmSlot').onclick = async () => {
      if (!selectedSlot) return;
      const button = document.getElementById('prepareConfirmSlot');
      button.disabled = true;
      button.textContent = 'Confirmation…';
      try {
        const { error: bookingError } = await supabaseClient.rpc('book_quote_appointment', { p_quote_id:q.id, p_starts_at:selectedSlot });
        if (bookingError) throw bookingError;
        selectedSlot = '';
        await load();
      } catch (error) { status(error.message || 'Réservation impossible.', true); }
    };
  }

  function confirmedView(state) {
    return `<div class="card"><span class="pill green">Rendez-vous confirmé</span><h3 style="margin-top:12px">Intervention ${esc(state.order?.order_number || '')}</h3><div class="summary" style="margin-top:14px"><div class="summary-line"><span>Date et heure</span><strong>${esc(dateTime(state.appointment?.starts_at))}</strong></div></div><div class="btn-row" style="margin-top:18px"><button id="prepareCancelRequest" class="btn btn-danger" type="button">Annuler ma demande</button></div><p class="small">L’annulation supprime la demande, le devis, le rendez-vous et l’intervention préparée tant qu’aucun travail, achat ou facture n’a commencé.</p></div>`;
  }

  async function respondQuote(response) {
    const q = currentState?.quote;
    if (!q) return;
    const label = response === 'accepted' ? 'accepter' : 'refuser';
    if (!window.confirm(`Confirmer : ${label} ce devis ?`)) return;
    const { error } = await supabaseClient.rpc('client_respond_quote', { p_quote_id:q.id, p_response:response });
    if (error) throw error;
    selectedSlot = '';
    await load();
  }

  async function cancelRequest() {
    const requestId = currentState?.request?.id;
    if (!requestId) return;
    if (!window.confirm('Annuler cette demande ? Cette action supprimera le devis, le rendez-vous et l’intervention préparée.')) return;
    if (!window.confirm('Dernière confirmation : supprimer définitivement cette demande de A à Z ?')) return;
    const button = document.getElementById('prepareCancelRequest');
    if (button) { button.disabled = true; button.textContent = 'Suppression…'; }
    const { error } = await supabaseClient.rpc('client_cancel_request', { p_service_request_id:requestId });
    if (error) throw error;
    currentState = null;
    selectedSlot = '';
    await load();
    status('Votre demande a été annulée et supprimée.');
  }

  async function render() {
    const host = content();
    if (!host) return;
    currentState = await loadState();
    if (!currentState.user) { host.innerHTML = '<div class="empty">Connectez-vous pour préparer votre rendez-vous.</div>'; return; }
    if (!currentState.request) { host.innerHTML = '<div class="card"><span class="pill">Aucune demande en cours</span><h3 style="margin-top:12px">Votre prochain dossier apparaîtra ici</h3><p>Après l’envoi d’une demande, cette page suivra automatiquement le devis puis le rendez-vous.</p></div>'; return; }
    if (currentState.appointment && currentState.order) {
      host.innerHTML = confirmedView(currentState);
      document.getElementById('prepareCancelRequest')?.addEventListener('click', () => cancelRequest().catch((error) => status(error.message || 'Annulation impossible.', true)));
      return;
    }
    if (!currentState.quote) { host.innerHTML = waitingView(currentState); return; }
    if (currentState.quote.status === 'refused') { host.innerHTML = refusedView(); return; }
    if (currentState.quote.status === 'sent') {
      host.innerHTML = quoteView(currentState);
      document.getElementById('prepareOpenQuote')?.addEventListener('click', () => openPdf(currentState.quote.pdf_path).catch((error) => status(error.message || 'Devis indisponible.', true)));
      document.getElementById('prepareAcceptQuote')?.addEventListener('click', () => respondQuote('accepted').catch((error) => status(error.message || 'Réponse impossible.', true)));
      document.getElementById('prepareRefuseQuote')?.addEventListener('click', () => respondQuote('refused').catch((error) => status(error.message || 'Réponse impossible.', true)));
      return;
    }
    if (currentState.quote.status === 'accepted') { await slotsView(currentState); return; }
    host.innerHTML = waitingView(currentState);
  }

  async function load() {
    installShell();
    status('');
    await render();
  }

  function install() {
    installShell();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="booking"]')) setTimeout(() => load().catch((error) => status(error.message || 'Dossier indisponible.', true)), 60);
    });
    supabaseClient?.auth?.onAuthStateChange?.(() => {
      if (section()?.classList.contains('active')) setTimeout(() => load().catch(() => {}), 80);
    });
  }

  window.EDMInternalBooking = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true }); else install();
})();