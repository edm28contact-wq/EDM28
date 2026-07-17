(() => {
  window.EDMAdminClients = {
    async load() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('profiles').select('id,first_name,last_name,phone,email,role,external_client_id,created_at').order('created_at', { ascending: false });
      if (error) throw error;
      app.clients = data || [];
      this.render(app.clients);
      app.$('clientSearchBtn').onclick = () => this.search();
      app.$('clientSearch').onkeydown = (event) => { if (event.key === 'Enter') this.search(); };
      app.$('docClient').innerHTML = '<option value="">Choisir</option>' + app.clients.map((c) => `<option value="${c.id}">${app.esc(`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id)}</option>`).join('');
    },
    render(rows) {
      const app = window.EDMAdmin;
      app.$('clientResults').innerHTML = rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Client</th><th>Email</th><th>Téléphone</th><th>Identifiant</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td>${app.esc(`${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sans nom')}</td><td>${app.esc(c.email || '-')}</td><td>${app.esc(c.phone || '-')}</td><td>${app.esc(c.external_client_id || c.id)}</td><td><button class="btn ghost" data-client="${c.id}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun résultat.</p>';
      document.querySelectorAll('[data-client]').forEach((button) => button.onclick = () => this.show(button.dataset.client));
    },
    async search() {
      const app = window.EDMAdmin;
      const term = app.$('clientSearch').value.trim().toLowerCase();
      if (!term) return this.render(app.clients);
      app.$('clientSearchBtn').disabled = true;
      try {
        const safeTerm = term.replace(/[(),]/g, '');
        const { data: vehicles, error } = await app.db.from('vehicles').select('user_id,plate,brand,model').or(`plate.ilike.%${safeTerm}%,brand.ilike.%${safeTerm}%,model.ilike.%${safeTerm}%`);
        if (error) throw error;
        const ids = new Set((vehicles || []).map((v) => v.user_id));
        this.render(app.clients.filter((c) => [c.first_name,c.last_name,c.phone,c.email,c.external_client_id,c.id].some((v) => String(v || '').toLowerCase().includes(term)) || ids.has(c.id)));
      } catch (error) {
        app.$('clientResults').innerHTML = `<div class="status error">${app.esc(error.message || 'Recherche impossible.')}</div>`;
      } finally {
        app.$('clientSearchBtn').disabled = false;
      }
    },
    async show(id) {
      const app = window.EDMAdmin;
      const client = app.clients.find((c) => c.id === id);
      if (!client) return;
      const [vehicles, requests, quotes, invoices, appointments] = await Promise.all([
        app.db.from('vehicles').select('*').eq('user_id', id),
        app.db.from('service_requests').select('id,status,created_at').eq('user_id', id),
        app.db.from('quotes').select('quote_number,status,total').eq('user_id', id),
        app.db.from('invoices').select('invoice_number,status,total,amount_paid').eq('user_id', id),
        app.db.from('appointments').select('starts_at,status').eq('user_id', id)
      ]);
      const failure = [vehicles, requests, quotes, invoices, appointments].find((result) => result.error)?.error;
      if (failure) {
        app.$('clientDetail').classList.remove('hidden');
        app.$('clientDetail').innerHTML = `<div class="status error">${app.esc(failure.message)}</div>`;
        return;
      }
      const box = app.$('clientDetail');
      box.classList.remove('hidden');
      box.innerHTML = `<h2>${app.esc(`${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client')}</h2><p>${app.esc(client.email || 'Email non renseigné')} · ${app.esc(client.phone || 'Téléphone non renseigné')} · ${app.esc(client.external_client_id || client.id)}</p><div class="grid2"><div><h3>Véhicules</h3>${(vehicles.data || []).map((v) => `<p><span class="pill">${app.esc(v.plate)}</span> ${app.esc(`${v.brand || ''} ${v.model || ''}`)}</p>`).join('') || '<p>Aucun véhicule</p>'}</div><div><h3>Activité</h3><p>${requests.data?.length || 0} demande(s) · ${quotes.data?.length || 0} devis · ${invoices.data?.length || 0} facture(s) · ${appointments.data?.length || 0} rendez-vous</p>${(invoices.data || []).map((i) => `<p>${app.esc(i.invoice_number || 'Facture')} : ${app.money(i.total)} · payé ${app.money(i.amount_paid)}</p>`).join('')}</div></div>`;
    }
  };
})();