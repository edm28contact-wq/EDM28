(() => {
  if (window.__edmInternalBookingInstalled) return;
  window.__edmInternalBookingInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
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
    host.innerHTML = `<div class="panel"><div class="section-title"><div><h2>Préparer mon RDV</h2><p>Après validation de votre dossier dans « Statut de ma demande », choisissez ici uniquement votre créneau.</p></div><span class="pill blue">Rendez-vous</span></div><div id="prepareRdvStatus"></div><div id="prepareRdvContent"><div class="notice">Chargement de votre dossier…</div></div></div>`;
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
      .select('id,service_request_id,status,labor_duration_minutes,created_at')
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

  function lockedView() {
    return `<div class="card"><span class="pill orange">Rendez-vous non disponible</span><h3 style="margin-top:12px">Suivez d’abord votre demande</h3><p>La prise de rendez-vous sera activée automatiquement lorsque votre dossier sera prêt. Toutes les validations et tous les documents en cours se trouvent dans « Statut de ma demande ».</p><button type="button" class="btn btn-primary" data-go-request-status>Ouvrir le statut de ma demande</button></div>`;
  }

  async function slotsView(state) {
    const q = state.quote;
    const host = content();
    host.innerHTML = `<div class="card"><span class="pill green">Dossier validé</span><h3 style="margin-top:12px">Choisissez votre rendez-vous</h3><p>Le premier créneau proposé respecte un délai minimum de 7 jours et la durée prévue de l’intervention.</p></div><div class="card" style="margin-top:14px"><div id="prepareSlots"><div class="notice">Calcul des créneaux disponibles…</div></div><div id="prepareSelection" class="empty" style="margin-top:14px">Sélectionnez un créneau.</div><div class="btn-row"><button id="prepareConfirmSlot" class="btn btn-primary" type="button" disabled>Confirmer mon rendez-vous</button></div></div>`;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() + 7);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth()+1).padStart(2,'0')}-${String(fromDate.getDate()).padStart(2,'0')}`;
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
      slotHost.querySelectorAll('[data-prepare-slot]').forEach((node) => {
        node.classList.toggle('edm-slot-selected', node === button);
        node.setAttribute('aria-pressed', node === button ? 'true' : 'false');
      });
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
    return `<div class="card"><span class="pill green">Rendez-vous confirmé</span><h3 style="margin-top:12px">Intervention ${esc(state.order?.order_number || '')}</h3><div class="summary" style="margin-top:14px"><div class="summary-line"><span>Date et heure</span><strong>${esc(dateTime(state.appointment?.starts_at))}</strong></div></div><div class="btn-row" style="margin-top:18px"><button id="prepareCancelRequest" class="btn btn-danger" type="button">Annuler ma demande</button></div><p class="small">L’annulation supprime la demande et le rendez-vous tant qu’aucun travail, achat ou facturation n’a commencé.</p></div>`;
  }

  async function cancelRequest() {
    const requestId = currentState?.request?.id;
    if (!requestId) return;
    if (!window.confirm('Annuler cette demande et le rendez-vous associé ?')) return;
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
    if (!currentState.request) { host.innerHTML = '<div class="card"><span class="pill">Aucune demande en cours</span><h3 style="margin-top:12px">Aucun rendez-vous à préparer</h3><p>Envoyez d’abord une demande depuis « Prendre RDV ».</p></div>'; return; }
    if (currentState.appointment && currentState.order) {
      host.innerHTML = confirmedView(currentState);
      document.getElementById('prepareCancelRequest')?.addEventListener('click', () => cancelRequest().catch((error) => status(error.message || 'Annulation impossible.', true)));
      return;
    }
    if (currentState.quote?.status === 'accepted') { await slotsView(currentState); return; }
    host.innerHTML = lockedView();
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