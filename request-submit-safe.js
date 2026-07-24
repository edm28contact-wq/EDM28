(() => {
  const STORAGE_KEY = 'edm28_pending_request_v2';
  const waitForApp = async () => {
    for (let i = 0; i < 120; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof calculateTotals === 'function' && typeof getVehicle === 'function' && document.getElementById('btnSubmit')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };
  const readPending = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; } };
  const writePending = (value) => value ? localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) : localStorage.removeItem(STORAGE_KEY);
  const intOrNull = (value) => { const number = Number.parseInt(String(value || '').replace(/\D/g, ''), 10); return Number.isFinite(number) ? number : null; };
  const field = (id) => document.getElementById(id)?.value?.trim() || '';

  async function currentSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) throw new Error('Connexion requise.');
    return data.session;
  }

  async function syncProfile(session) {
    const current = typeof state !== 'undefined' ? state.user || {} : {};
    const firstName = field('firstName') || current.firstName || session.user.user_metadata?.first_name || '';
    const lastName = field('lastName') || current.lastName || session.user.user_metadata?.last_name || '';
    const phone = field('phone') || current.phone || session.user.user_metadata?.phone || '';
    const email = String(session.user.email || field('email') || current.email || '').trim().toLowerCase();
    if (!firstName || !lastName || !phone) throw new Error('Complétez prénom, nom et téléphone.');

    const { data, error } = await supabaseClient.from('profiles')
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq('id', session.user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('Profil client introuvable. Reconnectez-vous puis réessayez.');

    if (typeof state !== 'undefined') {
      state.user = { id: session.user.id, firstName, lastName, phone, email };
      if (typeof saveState === 'function') saveState();
    }
    return { firstName, lastName, phone, email };
  }

  async function saveVehicle(session) {
    const vehicle = getVehicle();
    if (!vehicle.plateNormalized) throw new Error('Plaque obligatoire.');
    const { data, error } = await supabaseClient.from('vehicles').upsert({
      user_id: session.user.id,
      plate: vehicle.plate,
      plate_normalized: vehicle.plateNormalized,
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: intOrNull(vehicle.year),
      energy: vehicle.energy || null,
      mileage: intOrNull(vehicle.mileage)
    }, { onConflict: 'user_id,plate_normalized' }).select('id').single();
    if (error) throw error;
    return data;
  }

  async function upsertDraft(session, vehicleId, totals, payload) {
    const pending = readPending();
    const row = {
      user_id: session.user.id,
      vehicle_id: vehicleId,
      status: 'draft',
      selected_basket: selectedBasket,
      services: totals.selected,
      notes: payload.notes || null,
      totals,
      j7_accepted: payload.j7Accepted,
      refuse_control: payload.refuseControl,
      submitted_at: null
    };
    if (pending?.id && pending.userId === session.user.id) {
      const { data, error } = await supabaseClient.from('service_requests').update(row).eq('id', pending.id).eq('user_id', session.user.id).eq('status', 'draft').select('id').maybeSingle();
      if (error) throw error;
      if (data?.id) return data;
      writePending(null);
    }
    const { data, error } = await supabaseClient.from('service_requests').insert(row).select('id').single();
    if (error) throw error;
    writePending({ id: data.id, userId: session.user.id, createdAt: Date.now() });
    return data;
  }

  async function submitRequest() {
    const totals = calculateTotals(true);
    if (!totals) return;
    const button = document.getElementById('btnSubmit');
    const status = document.getElementById('submitStatus');
    setButtonBusy(button, true, 'Envoi...');
    status.innerHTML = '<div class="notice">Enregistrement et envoi vers EDM AUTO...</div>';
    try {
      const session = await currentSession();
      const client = await syncProfile(session);
      const vehicle = await saveVehicle(session);
      const payload = {
        client,
        vehicle: getVehicle(),
        services: totals.selected,
        selectedBasket,
        j7Accepted: document.getElementById('j7Accepted').checked,
        refuseControl: document.getElementById('refuseControl').checked,
        notes: document.getElementById('clientNotes').value.trim(),
        totals
      };
      const request = await upsertDraft(session, vehicle.id, totals, payload);
      const response = await fetch('/api/submit-request-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ requestId: request.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        const error = new Error(result.error || 'Envoi email impossible.');
        error.saved = result.saved === true;
        throw error;
      }
      writePending(null);
      updateStepper(4);
      status.innerHTML = '<div class="okbox"><strong>Demande transmise.</strong><br>Votre demande est enregistrée et EDM AUTO reviendra vers vous après étude.</div>';
      toast('Demande enregistrée et envoyée.');
      window.dispatchEvent(new CustomEvent('edm:request-submitted', {
        detail: { requestId: result.requestId || request.id }
      }));
      if (typeof window.renderRequestHistory === 'function') {
        void window.renderRequestHistory().catch((error) => console.warn('EDM request history refresh unavailable', error));
      }
    } catch (error) {
      const prefix = error.saved ? 'Votre demande est enregistrée. ' : '';
      status.innerHTML = `<div class="errorbox"><strong>Envoi non terminé.</strong><br>${escapeHtml(prefix + (error.message || 'Réessayez plus tard.'))}</div>`;
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmSafeSubmitInstalled) return;
    window.__edmSafeSubmitInstalled = true;
    const oldButton = document.getElementById('btnSubmit');
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', submitRequest);
    supabaseClient.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') writePending(null); });
  }

  install().catch((error) => console.error('EDM safe submit:', error));
})();
