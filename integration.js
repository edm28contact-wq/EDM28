(() => {
  const ready = () => typeof supabaseClient !== 'undefined' && typeof getVehicle === 'function' && document.getElementById('btnSaveVehicle');
  const waitReady = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Application non initialisée.');
  };

  const intOrNull = (value) => {
    const n = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  const currentSession = async () => {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) throw new Error('Connexion requise.');
    return data.session;
  };

  const vehicleRowToState = (row) => ({
    id: row.id,
    plate: row.plate,
    plateNormalized: row.plate_normalized,
    brand: row.brand || '',
    model: row.model || '',
    year: row.year || '',
    energy: row.energy || '',
    mileage: row.mileage || ''
  });

  async function loadVehiclesFromSupabase() {
    if (!state.user?.id) {
      state.vehicles = [];
      renderSavedVehicles();
      renderGarage();
      return [];
    }

    const { data, error } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('user_id', state.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    state.vehicles = (data || []).map(vehicleRowToState);
    renderSavedVehicles();
    renderGarage();
    return state.vehicles;
  }

  async function saveVehicleToSupabase(showToast = true) {
    const session = await currentSession();
    const vehicle = getVehicle();
    if (!vehicle.plateNormalized) throw new Error('Plaque obligatoire.');

    const row = {
      user_id: session.user.id,
      plate: vehicle.plate,
      plate_normalized: vehicle.plateNormalized,
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: intOrNull(vehicle.year),
      energy: vehicle.energy || null,
      mileage: intOrNull(vehicle.mileage)
    };

    const { data, error } = await supabaseClient
      .from('vehicles')
      .upsert(row, { onConflict: 'user_id,plate_normalized' })
      .select('*')
      .single();

    if (error) throw error;
    await loadVehiclesFromSupabase();
    if (showToast) toast('Véhicule enregistré dans votre garage.');
    return data;
  }

  async function accessServicesRemote() {
    try {
      await saveVehicleToSupabase(false);
      document.getElementById('servicesArea').classList.remove('hidden');
      renderServices();
      renderBaskets();
      updateSummary();
      updateStepper(3);
      document.getElementById('servicesArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast(error.message || 'Impossible d’enregistrer le véhicule.');
    }
  }

  async function submitRequestRemote() {
    const totals = calculateTotals(true);
    if (!totals) return;

    const btn = document.getElementById('btnSubmit');
    setButtonBusy(btn, true, 'Envoi...');
    document.getElementById('submitStatus').innerHTML = '<div class="notice">Envoi vers EDM AUTO...</div>';

    try {
      const session = await currentSession();
      const vehicle = await saveVehicleToSupabase(false);
      const payload = {
        client: {
          firstName: state.user.firstName,
          lastName: state.user.lastName,
          phone: state.user.phone,
          email: state.user.email
        },
        vehicle: getVehicle(),
        services: totals.selected,
        selectedBasket,
        j7Accepted: document.getElementById('j7Accepted').checked,
        refuseControl: document.getElementById('refuseControl').checked,
        notes: document.getElementById('clientNotes').value.trim(),
        totals
      };

      const { data: requestRow, error: insertError } = await supabaseClient
        .from('service_requests')
        .insert({
          user_id: session.user.id,
          vehicle_id: vehicle.id,
          status: 'submitted',
          selected_basket: selectedBasket,
          services: totals.selected,
          notes: payload.notes || null,
          totals,
          j7_accepted: payload.j7Accepted,
          refuse_control: payload.refuseControl,
          submitted_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const response = await fetch('/api/submit-request-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ ...payload, requestId: requestRow.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || 'Envoi email impossible.');

      updateStepper(4);
      document.getElementById('submitStatus').innerHTML = '<div class="okbox"><strong>Demande transmise.</strong><br>Votre demande est enregistrée et EDM AUTO reviendra vers vous après étude.</div>';
      toast('Demande enregistrée et envoyée.');
    } catch (error) {
      document.getElementById('submitStatus').innerHTML = `<div class="errorbox"><strong>Erreur d’envoi.</strong><br>${escapeHtml(error.message || 'Réessayez plus tard.')}</div>`;
    } finally {
      setButtonBusy(btn, false);
    }
  }

  async function openDocument(path) {
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function renderHistoryRemote() {
    const host = document.getElementById('historyList');
    if (!state.user?.id) {
      host.innerHTML = '<div class="empty">Connectez-vous pour consulter votre historique.</div>';
      return;
    }

    host.innerHTML = '<div class="notice">Chargement de l’historique...</div>';
    const [{ data: vehicles, error: vehiclesError }, { data: repairs, error: repairsError }] = await Promise.all([
      supabaseClient.from('vehicles').select('*').eq('user_id', state.user.id).order('updated_at', { ascending: false }),
      supabaseClient.from('repairs').select('*, repair_documents(*)').eq('user_id', state.user.id).order('repair_date', { ascending: false })
    ]);
    if (vehiclesError) throw vehiclesError;
    if (repairsError) throw repairsError;

    if (!vehicles?.length) {
      host.innerHTML = '<div class="empty">Aucun véhicule enregistré.</div>';
      return;
    }

    host.innerHTML = `<div class="grid">${vehicles.map((vehicle) => {
      const vehicleRepairs = (repairs || []).filter((repair) => repair.vehicle_id === vehicle.id);
      return `<section class="card">
        <span class="pill blue">${escapeHtml(vehicle.plate)}</span>
        <h3 style="margin-top:12px">${escapeHtml(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule')}</h3>
        <p>${escapeHtml(vehicle.energy || '-')} · ${escapeHtml(vehicle.year || '-')} · ${escapeHtml(vehicle.mileage || '-')} km</p>
        <div style="display:grid;gap:10px;margin-top:14px">
          ${vehicleRepairs.length ? vehicleRepairs.map((repair) => `<details class="card" style="margin:0">
            <summary style="cursor:pointer;font-weight:900">${new Date(`${repair.repair_date}T12:00:00`).toLocaleDateString('fr-FR')} · ${escapeHtml(repair.repair_type)}</summary>
            <h3 style="margin-top:14px">${escapeHtml(repair.title || repair.repair_type)}</h3>
            <p>${escapeHtml(repair.description || 'Aucun détail complémentaire.')}</p>
            <div class="service-meta"><span class="pill green">${escapeHtml(repair.status)}</span></div>
            <div class="btn-row">
              ${(repair.repair_documents || []).map((doc) => `<button class="btn btn-ghost" type="button" data-document-path="${escapeHtml(doc.file_path)}">${doc.document_type === 'invoice' ? 'Facture' : doc.document_type === 'repair_order' ? 'Ordre de réparation' : 'Photo'} · ${escapeHtml(doc.file_name)}</button>`).join('') || '<span class="small">Aucun document disponible.</span>'}
            </div>
          </details>`).join('') : '<div class="empty">Aucune réparation enregistrée pour ce véhicule.</div>'}
        </div>
      </section>`;
    }).join('')}</div>`;

    host.querySelectorAll('[data-document-path]').forEach((button) => {
      button.addEventListener('click', async () => {
        try { await openDocument(button.dataset.documentPath); }
        catch (error) { toast(error.message || 'Document indisponible.'); }
      });
    });
  }

  async function deleteAccountRemote() {
    if (!state.user?.id || !window.confirm('Voulez-vous vraiment supprimer votre compte ? Cette action est définitive.')) return;
    try {
      const session = await currentSession();
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || 'Suppression impossible.');
      await supabaseClient.auth.signOut();
      state = { user: null, vehicles: [], requests: [] };
      saveState();
      showPage('home');
      toast('Compte supprimé.');
    } catch (error) {
      const box = document.getElementById('accountDeleteStatus');
      if (box) box.innerHTML = `<div class="errorbox"><strong>Suppression impossible.</strong><br>${escapeHtml(error.message || 'Réessayez plus tard.')}</div>`;
    }
  }

  const replaceButton = (id, handler) => {
    const oldButton = document.getElementById(id);
    if (!oldButton) return;
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', handler);
  };

  async function install() {
    await waitReady();
    replaceButton('btnSaveVehicle', async () => {
      try { await saveVehicleToSupabase(true); }
      catch (error) { toast(error.message || 'Enregistrement impossible.'); }
    });
    replaceButton('btnAccessServices', accessServicesRemote);
    replaceButton('btnSubmit', submitRequestRemote);

    const originalRenderAccountPage = renderAccountPage;
    window.renderAccountPage = function patchedRenderAccountPage() {
      originalRenderAccountPage();
      replaceButton('accountDeleteBtn', deleteAccountRemote);
    };

    document.querySelectorAll('[data-page="garage"]').forEach((button) => button.addEventListener('click', () => loadVehiclesFromSupabase().catch((error) => toast(error.message))));
    document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', () => renderHistoryRemote().catch((error) => {
      document.getElementById('historyList').innerHTML = `<div class="errorbox">${escapeHtml(error.message)}</div>`;
    })));

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        if (session?.user) {
          await loadVehiclesFromSupabase().catch(() => {});
          await renderHistoryRemote().catch(() => {});
        }
      }, 0);
    });

    if (state.user?.id) {
      await loadVehiclesFromSupabase();
      await renderHistoryRemote();
    }
  }

  install().catch((error) => console.error('EDM Supabase integration:', error));
})();
