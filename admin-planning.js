(() => {
  if (window.__edmAdminPlanningInstalled) return;
  window.__edmAdminPlanningInstalled = true;

  const A = () => window.EDMAdmin;
  const BUFFER_MINUTES = 30;
  let weekStart = startOfWeek(new Date());
  let rows = [];

  function startOfWeek(date) {
    const value = new Date(date);
    const day = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - day);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  const esc = (value) => A().esc(value ?? '');
  const localInput = (value) => {
    const date = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const durationMinutes = (row) => Math.max(15, Math.round((new Date(row.ends_at) - new Date(row.starts_at)) / 60000));
  const statusLabel = (status) => ({ proposed:'Proposé', confirmed:'Confirmé', completed:'Terminé', cancelled:'Annulé', rescheduled:'Déplacé' }[status] || status || '—');
  const statusColor = (status) => status === 'cancelled' ? '#b42318' : status === 'completed' ? '#027a48' : '#b54708';

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard || document.getElementById('planning')) return;

    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.dataset.page = 'planning';
    button.textContent = 'Planning';
    nav.insertBefore(button, nav.querySelector('[data-page="clients"]') || null);

    const section = document.createElement('section');
    section.id = 'planning';
    section.className = 'page';
    section.innerHTML = `
      <div class="card">
        <div class="top">
          <div><h2>Planning atelier</h2><p class="muted">Gérer les rendez-vous, interventions et temps bloqués avec 30 minutes entre chaque client.</p></div>
          <div class="toolbar"><button class="btn ghost" id="planningPrev">Semaine précédente</button><button class="btn ghost" id="planningToday">Aujourd’hui</button><button class="btn ghost" id="planningNext">Semaine suivante</button><button class="btn ghost" id="planningRefresh">Actualiser</button></div>
        </div>
        <div id="planningStatus" class="status hidden"></div>
        <div id="planningWeekLabel" class="muted" style="margin:12px 0"></div>
        <div id="planningGrid"></div>
      </div>
      <div id="planningEditor" class="card hidden" style="margin-top:14px"></div>`;
    dashboard.appendChild(section);

    button.onclick = () => { A().page('planning'); load().catch(showError); };
    section.querySelector('#planningPrev').onclick = () => { weekStart.setDate(weekStart.getDate() - 7); load().catch(showError); };
    section.querySelector('#planningToday').onclick = () => { weekStart = startOfWeek(new Date()); load().catch(showError); };
    section.querySelector('#planningNext').onclick = () => { weekStart.setDate(weekStart.getDate() + 7); load().catch(showError); };
    section.querySelector('#planningRefresh').onclick = () => load().catch(showError);
  }

  function showError(error) {
    A().status('planningStatus', error.message || 'Planning indisponible.', true);
  }

  function render() {
    const grid = document.getElementById('planningGrid');
    const label = document.getElementById('planningWeekLabel');
    if (!grid || !label) return;
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    label.textContent = `Du ${weekStart.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;

    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,minmax(220px,1fr));gap:10px;overflow:auto">${days.map((day) => {
      const sameDay = rows.filter((row) => new Date(row.starts_at).toDateString() === day.toDateString());
      return `<section class="card" style="min-width:220px;padding:10px"><h3>${esc(day.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'2-digit'}))}</h3><div style="display:grid;gap:8px;margin-top:10px">${sameDay.map((row) => {
        const start = new Date(row.starts_at);
        const endAt = new Date(row.ends_at);
        const blocked = new Date(endAt.getTime() + BUFFER_MINUTES * 60000);
        const client = [row.profiles?.first_name,row.profiles?.last_name].filter(Boolean).join(' ') || row.profiles?.email || 'Client';
        const vehicle = [row.vehicles?.plate,row.vehicles?.brand,row.vehicles?.model].filter(Boolean).join(' · ') || 'Véhicule';
        return `<button type="button" data-planning-open="${row.id}" style="text-align:left;border:1px solid #d0d5dd;border-left:6px solid ${statusColor(row.status)};border-radius:12px;background:white;padding:10px;color:inherit"><strong>${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}–${endAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</strong><br>${esc(client)}<br><span class="muted">${esc(vehicle)}</span><br><span class="pill" style="margin-top:6px">${esc(statusLabel(row.status))}</span><p class="muted" style="margin:6px 0 0">Bloqué jusqu’à ${blocked.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p></button>`;
      }).join('') || '<p class="muted">Aucun rendez-vous.</p>'}</div></section>`;
    }).join('')}</div>`;
    grid.querySelectorAll('[data-planning-open]').forEach((button) => button.onclick = () => openEditor(button.dataset.planningOpen));
  }

  function openEditor(id) {
    const row = rows.find((item) => item.id === id);
    const box = document.getElementById('planningEditor');
    if (!row || !box) return;
    const minutes = durationMinutes(row);
    const client = [row.profiles?.first_name,row.profiles?.last_name].filter(Boolean).join(' ') || row.profiles?.email || 'Client';
    const vehicle = [row.vehicles?.plate,row.vehicles?.brand,row.vehicles?.model].filter(Boolean).join(' · ') || 'Véhicule';
    box.classList.remove('hidden');
    box.innerHTML = `<div class="top"><div><h2>${esc(client)}</h2><p class="muted">${esc(vehicle)}</p></div><span class="pill">${esc(statusLabel(row.status))}</span></div>
      <div class="grid2">
        <label>Début<input data-p-start type="datetime-local" value="${localInput(row.starts_at)}"></label>
        <label>Durée de main-d’œuvre (minutes)<input data-p-duration type="number" min="15" max="480" step="15" value="${minutes}"></label>
        <label>Statut<select data-p-status><option value="confirmed">En cours de traitement</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option><option value="rescheduled">Déplacée</option><option value="proposed">Proposée</option></select></label>
        <label>Fin bloquée<input data-p-blocked readonly value=""></label>
      </div>
      <label>Notes<textarea data-p-notes rows="4">${esc(row.notes || '')}</textarea></label>
      <div class="toolbar"><button class="btn primary" data-p-save>Enregistrer</button><button class="btn danger" data-p-cancel>Annuler l’intervention</button><button class="btn ghost" data-p-client>Ouvrir le dossier client</button></div>`;
    box.querySelector('[data-p-status]').value = row.status;
    const refreshBlocked = () => {
      const start = new Date(box.querySelector('[data-p-start]').value);
      const duration = Number(box.querySelector('[data-p-duration]').value || 0);
      const blocked = new Date(start.getTime() + (duration + BUFFER_MINUTES) * 60000);
      box.querySelector('[data-p-blocked]').value = Number.isNaN(blocked.getTime()) ? '' : blocked.toLocaleString('fr-FR');
    };
    box.querySelector('[data-p-start]').oninput = refreshBlocked;
    box.querySelector('[data-p-duration]').oninput = refreshBlocked;
    refreshBlocked();

    box.querySelector('[data-p-save]').onclick = async () => {
      const start = new Date(box.querySelector('[data-p-start]').value);
      const duration = Number(box.querySelector('[data-p-duration]').value || 0);
      if (Number.isNaN(start.getTime())) throw new Error('Date de début invalide.');
      if (!Number.isFinite(duration) || duration < 15 || duration > 480) throw new Error('Durée comprise entre 15 et 480 minutes.');
      const end = new Date(start.getTime() + duration * 60000);
      const conflict = await A().db.from('appointments').select('id,starts_at,ends_at,status').neq('id', row.id).neq('status','cancelled').lt('starts_at', new Date(end.getTime() + BUFFER_MINUTES * 60000).toISOString()).gt('ends_at', new Date(start.getTime() - BUFFER_MINUTES * 60000).toISOString());
      if (conflict.error) throw conflict.error;
      if (conflict.data?.length) throw new Error('Ce créneau chevauche un autre rendez-vous avec la marge de 30 minutes.');
      const saved = await A().db.from('appointments').update({ starts_at:start.toISOString(), ends_at:end.toISOString(), status:box.querySelector('[data-p-status]').value, notes:box.querySelector('[data-p-notes]').value.trim() || null, updated_at:new Date().toISOString() }).eq('id', row.id);
      if (saved.error) throw saved.error;
      A().status('planningStatus','Rendez-vous enregistré.');
      await load();
      openEditor(row.id);
    };
    box.querySelector('[data-p-cancel]').onclick = async () => {
      const saved = await A().db.from('appointments').update({ status:'cancelled', updated_at:new Date().toISOString() }).eq('id', row.id);
      if (saved.error) throw saved.error;
      if (row.repair_orders?.[0]?.id) await A().db.from('repair_orders').update({ status:'cancelled', updated_at:new Date().toISOString() }).eq('id', row.repair_orders[0].id);
      A().status('planningStatus','Intervention annulée.');
      await load();
      box.classList.add('hidden');
    };
    box.querySelector('[data-p-client]').onclick = () => {
      A().page('clients');
      setTimeout(() => window.EDMAdminClients?.show(row.user_id), 150);
    };
  }

  async function load() {
    ensureUi();
    const end = new Date(weekStart); end.setDate(end.getDate() + 7);
    const result = await A().db.from('appointments').select('id,user_id,vehicle_id,starts_at,ends_at,status,notes,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model),repair_orders(id,order_number,status,pdf_path,quote_id)').gte('starts_at', weekStart.toISOString()).lt('starts_at', end.toISOString()).order('starts_at');
    if (result.error) throw result.error;
    rows = result.data || [];
    render();
  }

  window.EDMAdminPlanning = { load };
  const boot = () => { ensureUi(); document.querySelector('[data-page="planning"]')?.addEventListener('click', () => load().catch(showError)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();