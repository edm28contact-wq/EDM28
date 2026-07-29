(() => {
  if (window.__edmInternalBookingInstalled) return;
  window.__edmInternalBookingInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const durationText = (minutes) => {
    const value = Number(minutes || 0);
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}` || 'Durée non renseignée';
  };

  let selectedQuoteId = '';
  let selectedSlot = '';
  let quotes = [];

  async function sessionUser() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function host() {
    return document.getElementById('booking');
  }

  function installShell() {
    const section = host();
    if (!section || section.dataset.internalBooking === 'true') return;
    section.dataset.internalBooking = 'true';
    section.innerHTML = `
      <div class="panel">
        <div class="section-title">
          <div><h2>Choisir mon rendez-vous</h2><p>Choisissez un devis, puis un créneau calculé selon la durée de main-d’œuvre, les horaires du garage et les rendez-vous déjà pris.</p></div>
          <span class="pill blue">Planning EDM28</span>
        </div>
        <div id="internalBookingStatus"></div>
        <div id="internalBookingContent"><div class="notice">Chargement du planning…</div></div>
      </div>`;
  }

  function status(message, error = false) {
    const box = document.getElementById('internalBookingStatus');
    if (!box) return;
    box.innerHTML = message ? `<div class="${error ? 'errorbox' : 'okbox'}" style="margin-bottom:14px">${esc(message)}</div>` : '';
  }

  function quoteLabel(row) {
    const vehicle = row.vehicles ? [row.vehicles.plate, row.vehicles.brand, row.vehicles.model].filter(Boolean).join(' · ') : 'Véhicule';
    return `${row.quote_number || row.title || 'Devis'} · ${vehicle} · ${money(row.total)}`;
  }

  async function loadQuotes() {
    const user = await sessionUser();
    const content = document.getElementById('internalBookingContent');
    if (!content) return;
    if (!user) {
      content.innerHTML = '<div class="empty">Connectez-vous pour choisir un rendez-vous.</div>';
      return;
    }

    const { data, error } = await supabaseClient
      .from('quotes')
      .select('id,quote_number,status,title,description,total,labor_duration_minutes,vehicle_id,vehicles(plate,brand,model)')
      .eq('user_id', user.id)
      .eq('visible_to_client', true)
      .not('labor_duration_minutes', 'is', null)
      .order('created_at', { ascending:false });
    if (error) throw error;

    quotes = (data || []).filter((row) => !['draft','cancelled','rejected','expired'].includes(row.status));
    if (!quotes.length) {
      content.innerHTML = '<div class="empty">Aucun devis disponible pour la prise de rendez-vous. Le devis doit être publié et contenir une durée de main-d’œuvre.</div>';
      return;
    }

    selectedQuoteId = selectedQuoteId && quotes.some((row) => row.id === selectedQuoteId) ? selectedQuoteId : quotes[0].id;
    content.innerHTML = `
      <div class="card">
        <label>Devis à planifier
          <select id="bookingQuoteSelect">${quotes.map((row) => `<option value="${esc(row.id)}">${esc(quoteLabel(row))}</option>`).join('')}</select>
        </label>
        <div id="bookingQuoteSummary" class="notice" style="margin-top:12px"></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="section-title"><div><h3>Créneaux disponibles</h3><p>Les 30 minutes entre deux clients sont ajoutées automatiquement.</p></div><button class="btn btn-ghost" id="bookingRefresh" type="button">Actualiser</button></div>
        <div id="bookingSlots"><div class="notice">Chargement des créneaux…</div></div>
      </div>
      <div class="card" id="bookingConfirmation" style="margin-top:14px">
        <h3>Confirmation</h3>
        <div id="bookingSelection" class="empty" style="margin-top:12px">Sélectionnez un créneau.</div>
        <div class="btn-row"><button class="btn btn-primary" id="bookingConfirm" type="button" disabled>Confirmer mon rendez-vous</button></div>
      </div>`;

    const select = document.getElementById('bookingQuoteSelect');
    select.value = selectedQuoteId;
    select.onchange = () => {
      selectedQuoteId = select.value;
      selectedSlot = '';
      renderQuoteSummary();
      loadSlots().catch((error) => status(error.message || 'Créneaux indisponibles.', true));
    };
    document.getElementById('bookingRefresh').onclick = () => loadSlots().catch((error) => status(error.message || 'Créneaux indisponibles.', true));
    document.getElementById('bookingConfirm').onclick = () => confirmBooking().catch((error) => status(error.message || 'Réservation impossible.', true));
    renderQuoteSummary();
    await loadSlots();
  }

  function renderQuoteSummary() {
    const quote = quotes.find((row) => row.id === selectedQuoteId);
    const box = document.getElementById('bookingQuoteSummary');
    if (!quote || !box) return;
    box.innerHTML = `<strong>${esc(quote.quote_number || quote.title || 'Devis')}</strong><br>${esc(quote.description || '')}<br>Durée de main-d’œuvre : <b>${esc(durationText(quote.labor_duration_minutes))}</b> · Créneau occupé avec marge : <b>${esc(durationText(Number(quote.labor_duration_minutes) + 30))}</b>`;
  }

  async function loadSlots() {
    const box = document.getElementById('bookingSlots');
    if (!box || !selectedQuoteId) return;
    box.innerHTML = '<div class="notice">Calcul des créneaux disponibles…</div>';
    selectedSlot = '';
    updateSelection();

    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const { data, error } = await supabaseClient.rpc('get_available_booking_slots', { p_quote_id:selectedQuoteId, p_from:from, p_days:30 });
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) {
      box.innerHTML = '<div class="empty">Aucun créneau disponible dans les 30 prochains jours.</div>';
      return;
    }

    const groups = new Map();
    rows.forEach((row) => {
      const start = new Date(row.starts_at);
      const key = start.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    box.innerHTML = `<div style="display:grid;gap:14px">${[...groups.entries()].map(([day, slots]) => `
      <section class="card" style="margin:0">
        <h3 style="text-transform:capitalize">${esc(day)}</h3>
        <div class="btn-row">${slots.map((slot) => {
          const start = new Date(slot.starts_at);
          const end = new Date(slot.ends_at);
          return `<button class="btn btn-secondary" type="button" data-booking-slot="${esc(slot.starts_at)}">${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} – ${end.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</button>`;
        }).join('')}</div>
      </section>`).join('')}</div>`;

    box.querySelectorAll('[data-booking-slot]').forEach((button) => button.onclick = () => {
      selectedSlot = button.dataset.bookingSlot;
      box.querySelectorAll('[data-booking-slot]').forEach((node) => node.classList.toggle('btn-blue', node === button));
      updateSelection();
    });
  }

  function updateSelection() {
    const box = document.getElementById('bookingSelection');
    const button = document.getElementById('bookingConfirm');
    const quote = quotes.find((row) => row.id === selectedQuoteId);
    if (!box || !button) return;
    if (!selectedSlot || !quote) {
      box.className = 'empty';
      box.textContent = 'Sélectionnez un créneau.';
      button.disabled = true;
      return;
    }
    const start = new Date(selectedSlot);
    const end = new Date(start.getTime() + Number(quote.labor_duration_minutes) * 60000);
    box.className = 'notice';
    box.innerHTML = `<strong>${esc(quote.quote_number || quote.title || 'Devis')}</strong><br>${start.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} de ${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} à ${end.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}.`;
    button.disabled = false;
  }

  async function confirmBooking() {
    if (!selectedQuoteId || !selectedSlot) throw new Error('Sélectionnez un créneau.');
    const button = document.getElementById('bookingConfirm');
    button.disabled = true;
    button.textContent = 'Confirmation…';
    try {
      const { data, error } = await supabaseClient.rpc('book_quote_appointment', { p_quote_id:selectedQuoteId, p_starts_at:selectedSlot });
      if (error) throw error;
      status('Rendez-vous confirmé. L’intervention a été créée dans votre dossier et dans le planning EDM28.');
      selectedSlot = '';
      await loadSlots();
      if (typeof window.renderVehicleHistory === 'function') window.renderVehicleHistory().catch(() => {});
      return data;
    } finally {
      button.textContent = 'Confirmer mon rendez-vous';
      button.disabled = !selectedSlot;
    }
  }

  async function load() {
    installShell();
    status('');
    await loadQuotes();
  }

  function install() {
    installShell();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="booking"]')) setTimeout(() => load().catch((error) => status(error.message || 'Planning indisponible.', true)), 80);
    });
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange(() => {
        if (document.getElementById('booking')?.classList.contains('active')) setTimeout(() => load().catch(() => {}), 100);
      });
    }
  }

  window.EDMInternalBooking = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true }); else install();
})();