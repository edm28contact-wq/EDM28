(() => {
  const A = () => window.EDMAdmin;
  const esc = (v) => A().esc(v ?? '');
  const date = (v, withTime = false) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return withTime ? d.toLocaleString('fr-FR') : d.toLocaleDateString('fr-FR');
  };
  const statusLabel = (value) => ({
    draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé',
    ready: 'Prêt', signed: 'Signé', in_progress: 'En cours', completed: 'Terminé', invoiced: 'Facturé',
    issued: 'Émise', partially_paid: 'Partiellement payée', paid: 'Payée', overdue: 'Échue',
    confirmed: 'Confirmé', cancelled: 'Annulé', reviewed: 'Étudiée', quoted: 'Devis créé'
  }[value] || value || '—');

  function timeline(data) {
    const events = [];
    (data.requests || []).forEach((r) => events.push({ at: r.created_at, type: 'Demande', title: `Demande ${statusLabel(r.status)}`, detail: r.notes || '' }));
    (data.quotes || []).forEach((q) => events.push({ at: q.created_at, type: 'Devis', title: `${q.quote_number || 'Devis'} · ${statusLabel(q.status)}`, detail: `${A().money(q.total)}${q.valid_until ? ` · valable jusqu’au ${date(q.valid_until)}` : ''}`, pdf: q.pdf_path }));
    (data.appointments || []).forEach((r) => events.push({ at: r.starts_at || r.created_at, type: 'Rendez-vous', title: statusLabel(r.status), detail: `${date(r.starts_at, true)}${r.ends_at ? ` → ${date(r.ends_at, true)}` : ''}` }));
    (data.orders || []).forEach((o) => events.push({ at: o.created_at, type: 'Ordre', title: `${o.order_number || 'Ordre de réparation'} · ${statusLabel(o.status)}`, detail: o.mileage_in ? `${Number(o.mileage_in).toLocaleString('fr-FR')} km` : '', pdf: o.pdf_path }));
    (data.inspections || []).forEach((r) => events.push({ at: r.completed_at || r.created_at, type: 'Contrôle', title: `${r.report_number || 'Fiche de contrôle'} · ${statusLabel(r.status)}`, detail: r.observations || '', pdf: r.pdf_path }));
    (data.invoices || []).forEach((i) => events.push({ at: i.issued_at || i.created_at, type: 'Facture', title: `${i.invoice_number || 'Facture'} · ${statusLabel(i.status)}`, detail: `${A().money(i.total)} · payé ${A().money(i.amount_paid)} · reste ${A().money(Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0)))}`, pdf: i.pdf_path }));
    (data.payments || []).forEach((p) => events.push({ at: p.paid_at || p.created_at, type: 'Paiement', title: `${A().money(p.amount)} · ${p.payment_method || 'Mode non renseigné'}`, detail: p.reference || '' }));
    (data.messages || []).forEach((m) => events.push({ at: m.created_at, type: 'Message', title: m.direction === 'inbound' ? 'Message client' : 'Message EDM28', detail: m.subject || m.body?.slice(0, 140) || '' }));
    return events.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }

  async function signedUrl(path) {
    if (!path) return null;
    const { data, error } = await A().db.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error) throw error;
    return data?.signedUrl || null;
  }

  const mod = window.EDMAdminClients = {
    selectedId: null,
    detailData: null,

    async load() {
      const { data, error } = await A().db.from('profiles').select('id,first_name,last_name,phone,email,role,external_client_id,created_at,updated_at').eq('role', 'customer').order('created_at', { ascending: false });
      if (error) throw error;
      A().clients = data || [];
      this.render(A().clients);
      A().$('clientSearchBtn').onclick = () => this.search();
      A().$('clientSearch').onkeydown = (event) => { if (event.key === 'Enter') this.search(); };
      A().$('docClient').innerHTML = '<option value="">Choisir</option>' + A().clients.map((c) => `<option value="${c.id}">${esc(`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id)}</option>`).join('');
      if (this.selectedId && A().clients.some((c) => c.id === this.selectedId)) await this.show(this.selectedId);
    },

    render(rows) {
      A().$('clientResults').innerHTML = rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Client</th><th>Email</th><th>Téléphone</th><th>Créé le</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td>${esc(`${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sans nom')}</td><td>${esc(c.email || '-')}</td><td>${esc(c.phone || '-')}</td><td>${date(c.created_at)}</td><td><button class="btn ghost" data-client="${c.id}">Ouvrir le dossier</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun résultat.</p>';
      A().$('clientResults').querySelectorAll('[data-client]').forEach((button) => button.onclick = () => this.show(button.dataset.client));
    },

    async search() {
      const term = A().$('clientSearch').value.trim().toLowerCase();
      if (!term) return this.render(A().clients);
      A().$('clientSearchBtn').disabled = true;
      try {
        const safe = term.replace(/[(),]/g, '');
        const { data: vehicles, error } = await A().db.from('vehicles').select('user_id,plate,brand,model').or(`plate.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%`);
        if (error) throw error;
        const ids = new Set((vehicles || []).map((v) => v.user_id));
        this.render(A().clients.filter((c) => [c.first_name,c.last_name,c.phone,c.email,c.external_client_id,c.id].some((v) => String(v || '').toLowerCase().includes(term)) || ids.has(c.id)));
      } catch (error) {
        A().$('clientResults').innerHTML = `<div class="status error">${esc(error.message || 'Recherche impossible.')}</div>`;
      } finally { A().$('clientSearchBtn').disabled = false; }
    },

    async fetchDetail(id) {
      const queries = await Promise.all([
        A().db.from('vehicles').select('*').eq('user_id', id).order('created_at'),
        A().db.from('service_requests').select('id,status,notes,services,created_at,updated_at').eq('user_id', id).order('created_at', { ascending: false }),
        A().db.from('quotes').select('id,quote_number,status,title,total,valid_until,pdf_path,created_at,updated_at').eq('user_id', id).order('created_at', { ascending: false }),
        A().db.from('appointments').select('id,starts_at,ends_at,status,notes,created_at').eq('user_id', id).order('starts_at', { ascending: false }),
        A().db.from('repair_orders').select('id,order_number,status,mileage_in,visible_condition,customer_items,pdf_path,created_at,updated_at').eq('user_id', id).order('created_at', { ascending: false }),
        A().db.from('inspection_reports').select('id,report_number,status,mileage,technician_name,observations,photo_paths,signature_path,pdf_path,completed_at,created_at').eq('user_id', id).order('created_at', { ascending: false }),
        A().db.from('invoices').select('id,invoice_number,status,title,total,amount_paid,payment_method,issued_at,due_at,paid_at,pdf_path,created_at').eq('user_id', id).order('created_at', { ascending: false }),
        A().db.from('payments').select('id,invoice_id,amount,payment_method,reference,paid_at,created_at').eq('user_id', id).order('paid_at', { ascending: false }),
        A().db.from('client_messages').select('id,direction,subject,body,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100)
      ]);
      const failure = queries.find((result) => result.error)?.error;
      if (failure) throw failure;
      const [vehicles, requests, quotes, appointments, orders, inspections, invoices, payments, messages] = queries.map((r) => r.data || []);
      return { vehicles, requests, quotes, appointments, orders, inspections, invoices, payments, messages };
    },

    vehicleEditor(vehicle) {
      return `<article class="card" data-vehicle="${vehicle.id}" style="margin:10px 0"><div class="grid2">
        <label>Immatriculation<input data-v="plate" value="${esc(vehicle.plate)}"></label>
        <label>Marque<input data-v="brand" value="${esc(vehicle.brand)}"></label>
        <label>Modèle<input data-v="model" value="${esc(vehicle.model)}"></label>
        <label>Année<input data-v="year" type="number" min="1900" max="2100" value="${vehicle.year || ''}"></label>
        <label>Énergie<input data-v="energy" value="${esc(vehicle.energy)}"></label>
        <label>Moteur<input data-v="engine" value="${esc(vehicle.engine)}"></label>
        <label>Kilométrage<input data-v="mileage" type="number" min="0" value="${vehicle.mileage ?? ''}"></label>
      </div><button class="btn ghost" data-save-vehicle="${vehicle.id}">Enregistrer le véhicule</button></article>`;
    },

    async show(id) {
      const client = A().clients.find((c) => c.id === id);
      if (!client) return;
      this.selectedId = id;
      const box = A().$('clientDetail');
      box.classList.remove('hidden');
      box.innerHTML = '<p class="muted">Chargement du dossier client…</p>';
      try {
        const data = await this.fetchDetail(id);
        this.detailData = data;
        const events = timeline(data);
        const totalBilled = data.invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
        const totalPaid = data.invoices.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
        box.innerHTML = `<div class="top"><div><h2>Dossier client</h2><p class="muted">${esc(client.external_client_id || client.id)}</p></div><button class="btn ghost" data-message-client-open>Ouvrir la messagerie</button></div>
          <div class="card"><h3>Coordonnées</h3><div class="grid2">
            <label>Prénom<input data-client-field="first_name" value="${esc(client.first_name)}"></label>
            <label>Nom<input data-client-field="last_name" value="${esc(client.last_name)}"></label>
            <label>Email<input data-client-field="email" type="email" value="${esc(client.email)}"></label>
            <label>Téléphone<input data-client-field="phone" value="${esc(client.phone)}"></label>
          </div><button class="btn primary" data-save-client>Enregistrer le client</button><div id="clientDetailStatus" class="status hidden"></div></div>
          <div class="grid4" style="margin:12px 0">
            <article class="card kpi"><span>Véhicules</span><strong>${data.vehicles.length}</strong></article>
            <article class="card kpi"><span>Devis</span><strong>${data.quotes.length}</strong></article>
            <article class="card kpi"><span>Facturé</span><strong>${A().money(totalBilled)}</strong></article>
            <article class="card kpi"><span>À encaisser</span><strong>${A().money(Math.max(0, totalBilled - totalPaid))}</strong></article>
          </div>
          <div class="card"><div class="top"><h3>Véhicules</h3><span class="muted">${data.vehicles.length} véhicule(s)</span></div>${data.vehicles.map((v) => this.vehicleEditor(v)).join('') || '<p>Aucun véhicule.</p>'}</div>
          <div class="card" style="margin-top:12px"><h3>Historique chronologique</h3><div style="display:grid;gap:10px">${events.map((event) => `<article class="card" style="padding:12px"><div class="top"><div><span class="pill">${esc(event.type)}</span><strong style="margin-left:8px">${esc(event.title)}</strong></div><span class="muted">${date(event.at, true)}</span></div>${event.detail ? `<p>${esc(event.detail)}</p>` : ''}${event.pdf ? `<button class="btn ghost" data-open-document="${esc(event.pdf)}">Ouvrir le PDF</button>` : ''}</article>`).join('') || '<p>Aucune activité.</p>'}</div></div>`;

        box.querySelector('[data-save-client]').onclick = () => this.saveClient(client, box);
        box.querySelectorAll('[data-save-vehicle]').forEach((button) => button.onclick = () => this.saveVehicle(button.dataset.saveVehicle, button.closest('[data-vehicle]')));
        box.querySelectorAll('[data-open-document]').forEach((button) => button.onclick = async () => {
          button.disabled = true;
          try { const url = await signedUrl(button.dataset.openDocument); if (url) window.open(url, '_blank', 'noopener'); }
          catch (error) { A().status('clientDetailStatus', error.message || 'Document indisponible.', true); }
          finally { button.disabled = false; }
        });
        box.querySelector('[data-message-client-open]').onclick = () => {
          A().page('messages');
          setTimeout(() => window.EDMAdminMessages?.open(id, true, false).catch(() => {}), 200);
        };
      } catch (error) {
        box.innerHTML = `<div class="status error">${esc(error.message || 'Dossier client indisponible.')}</div>`;
      }
    },

    async saveClient(client, root) {
      const patch = {
        first_name: root.querySelector('[data-client-field="first_name"]').value.trim() || null,
        last_name: root.querySelector('[data-client-field="last_name"]').value.trim() || null,
        email: root.querySelector('[data-client-field="email"]').value.trim().toLowerCase() || null,
        phone: root.querySelector('[data-client-field="phone"]').value.trim() || null,
        updated_at: new Date().toISOString()
      };
      const button = root.querySelector('[data-save-client]');
      button.disabled = true;
      try {
        const result = await A().db.from('profiles').update(patch).eq('id', client.id).eq('role', 'customer').select('id');
        if (result.error) throw result.error;
        if (!result.data?.length) throw new Error('Client non modifiable.');
        Object.assign(client, patch);
        A().status('clientDetailStatus', 'Coordonnées client enregistrées.');
        this.render(A().clients);
      } catch (error) { A().status('clientDetailStatus', error.message || 'Enregistrement impossible.', true); }
      finally { button.disabled = false; }
    },

    async saveVehicle(id, root) {
      const value = (name) => root.querySelector(`[data-v="${name}"]`).value.trim();
      const patch = {
        plate: value('plate').toUpperCase() || null,
        plate_normalized: value('plate').toUpperCase().replace(/[^A-Z0-9]/g, '') || null,
        brand: value('brand') || null,
        model: value('model') || null,
        year: Number(value('year')) || null,
        energy: value('energy') || null,
        engine: value('engine') || null,
        mileage: Number(value('mileage')) || null,
        updated_at: new Date().toISOString()
      };
      const button = root.querySelector('[data-save-vehicle]');
      button.disabled = true;
      try {
        const result = await A().db.from('vehicles').update(patch).eq('id', id).eq('user_id', this.selectedId).select('id');
        if (result.error) throw result.error;
        if (!result.data?.length) throw new Error('Véhicule non modifiable.');
        A().status('clientDetailStatus', 'Véhicule enregistré.');
        await this.show(this.selectedId);
      } catch (error) { A().status('clientDetailStatus', error.message || 'Enregistrement impossible.', true); }
      finally { button.disabled = false; }
    }
  };
})();