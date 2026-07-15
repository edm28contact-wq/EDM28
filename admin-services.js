(() => {
  const mod = window.EDMAdminServices = {
    async load() {
      const app = window.EDMAdmin;
      const { data, error } = await app.db.from('site_services').select('*').order('display_order');
      if (error) throw error;
      app.services = data || [];
      this.render();
      app.$('newServiceBtn').onclick = () => this.edit(null);
    },
    render() {
      const app = window.EDMAdmin;
      app.$('serviceTable').innerHTML = `<div class="tablewrap"><table class="table"><thead><tr><th>Service</th><th>Catégorie</th><th>Prix MO</th><th>Durée</th><th>Publié</th><th></th></tr></thead><tbody>${app.services.map((s) => `<tr><td>${app.esc(s.name)}</td><td>${app.esc(s.category)}</td><td>${app.money(s.labor_price)}</td><td>${s.duration_minutes} min</td><td>${s.active && s.published_at ? 'Oui' : 'Non'}</td><td><button class="btn ghost" data-service="${s.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>`;
      document.querySelectorAll('[data-service]').forEach((button) => button.onclick = () => this.edit(button.dataset.service));
    },
    edit(id) {
      const app = window.EDMAdmin;
      const s = app.services.find((x) => x.id === id) || { category:'', name:'', labor_price:0, duration_minutes:60, client_description:'', active:true, online_booking_enabled:false, display_order:app.services.length * 10 + 10, pricing_type:'fixed' };
      const box = app.$('serviceEditor');
      box.classList.remove('hidden');
      box.innerHTML = `<div class="grid2"><div class="field"><label>Nom</label><input id="svcName" value="${app.esc(s.name)}"></div><div class="field"><label>Catégorie</label><input id="svcCategory" value="${app.esc(s.category)}"></div><div class="field"><label>Prix main-d’œuvre</label><input id="svcPrice" type="number" step="0.01" value="${Number(s.labor_price || 0)}"></div><div class="field"><label>Durée en minutes</label><input id="svcDuration" type="number" value="${Number(s.duration_minutes || 60)}"></div></div><div class="field"><label>Description client</label><textarea id="svcDescription">${app.esc(s.client_description || '')}</textarea></div><div class="toolbar"><label><input id="svcActive" type="checkbox" ${s.active ? 'checked' : ''}> Publié</label><label><input id="svcBooking" type="checkbox" ${s.online_booking_enabled ? 'checked' : ''}> Réservable</label><button id="saveServiceBtn" class="btn success">Enregistrer</button><button id="cancelServiceBtn" class="btn ghost">Annuler</button></div>`;
      app.$('cancelServiceBtn').onclick = () => box.classList.add('hidden');
      app.$('saveServiceBtn').onclick = () => this.save(s);
    },
    async save(old) {
      const app = window.EDMAdmin;
      const name = app.$('svcName').value.trim();
      const row = {
        category: app.$('svcCategory').value.trim(),
        name,
        client_description: app.$('svcDescription').value.trim(),
        technical_description: app.$('svcDescription').value.trim(),
        labor_price: Number(app.$('svcPrice').value || 0),
        displayed_price: Number(app.$('svcPrice').value || 0),
        duration_minutes: Number(app.$('svcDuration').value || 60),
        active: app.$('svcActive').checked,
        online_booking_enabled: app.$('svcBooking').checked,
        published_at: app.$('svcActive').checked ? new Date().toISOString() : null,
        display_order: old.display_order || app.services.length * 10 + 10,
        pricing_type: old.pricing_type || 'fixed'
      };
      let result;
      if (old.id) result = await app.db.from('site_services').update(row).eq('id', old.id);
      else result = await app.db.from('site_services').insert({ ...row, external_service_id:`SVC_${Date.now()}`, slug:name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') });
      if (result.error) return alert(result.error.message);
      app.$('serviceEditor').classList.add('hidden');
      await this.load();
    }
  };
})();