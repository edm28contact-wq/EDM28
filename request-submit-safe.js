(() => {
  const STORAGE_KEY = 'edm28_pending_request_v2';

  const waitForApp = async () => {
    for (let i = 0; i < 120; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof calculateTotals === 'function' && typeof getVehicle === 'function' && document.getElementById('btnSubmit')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const readPending = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (_) { return null; }
  };

  const writePending = (value) => {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const intOrNull = (value) => {
    const number = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
    return Number.isFinite(number) ? number : null;
  };

  const currentSession = async () => {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) throw new Error('Connexion requise.');
    return data.session;
  };

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
      const vehicle = await saveVehicle(session);
      const payload = {
        client: state.user || {},
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
    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') writePending(null);
    });
  }

  install().catch((error) => console.error('EDM safe submit:', error));
})();
