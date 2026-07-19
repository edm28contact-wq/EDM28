(() => {
  const labels = { draft: 'Brouillon', submitted: 'Reçue', reviewed: 'Étudiée', quoted: 'Devis créé', confirmed: 'Confirmée', cancelled: 'Annulée' };
  const A = () => window.EDMAdmin;
  const fmt = (v) => v ? new Date(v).toLocaleString('fr-FR') : '-';
  const total = (r) => r?.totals?.totalAllMin ?? r?.totals?.laborAfter ?? 0;

  async function updateStatus(id, status) {
    if (!['reviewed', 'cancelled'].includes(status)) return;
    const { error } = await A().db.from('service_requests').update({ status }).eq('id', id).in('status', ['submitted', 'reviewed']);
    if (error) throw error;
    await load();
  }

  function render(rows) {
    const host = A().$('requestList');
    if (!host) return;
    host.innerHTML = rows.length ? rows.map((r) => {
      const client = r.profiles || {};
      const vehicle = r.vehicles || {};
      const services = Array.isArray(r.services) ? r.services : [];
      return `<article class="card" style="margin:12px 0">
        <div class="top"><div><span class="pill">${A().esc(labels[r.status] || r.status)}</span><h3>${A().esc(`${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Client')}</h3></div><strong>${A().money(total(r))}</strong></div>
        <p>${A().esc(vehicle.plate || '-')} · ${A().esc(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule')} · ${A().esc(fmt(r.submitted_at || r.created_at))}</p>
        <p>${services.map((s) => A().esc(s.name || s.id || 'Prestation')).join(' · ') || 'Aucune prestation'}</p>
        <p>${A().esc(r.notes || 'Aucune note client')}</p>
        <div class="toolbar">
          <button class="btn primary" data-request-status="reviewed" data-request-id="${r.id}">Marquer étudiée</button>
          <button class="btn ghost" data-request-status="cancelled" data-request-id="${r.id}">Annuler</button>
        </div>
      </article>`;
    }).join('') : '<p class="muted">Aucune demande à traiter.</p>';
    host.querySelectorAll('[data-request-status]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try { await updateStatus(button.dataset.requestId, button.dataset.requestStatus); }
        catch (error) { A().status('requestStatus', error.message || 'Mise à jour impossible.', true); }
        finally { button.disabled = false; }
      };
    });
  }

  async function load() {
    const host = A().$('requestList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('service_requests').select('id,status,services,notes,totals,created_at,submitted_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,mileage)').in('status', ['submitted','reviewed']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  window.EDMAdminRequests = { load };
})();