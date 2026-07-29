(() => {
  if (window.__edmBusinessHoursInstalled) return;
  window.__edmBusinessHoursInstalled = true;

  const A = () => window.EDMAdmin;
  const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const esc = (value) => A().esc(value ?? '');
  const time = (value) => value ? String(value).slice(0,5) : '';

  function ensureUi() {
    const planning = document.getElementById('planning');
    if (!planning || document.getElementById('businessHoursManager')) return;
    const card = document.createElement('div');
    card.id = 'businessHoursManager';
    card.className = 'card';
    card.style.marginTop = '14px';
    card.innerHTML = `
      <div class="top"><div><h2>Jours et horaires d’ouverture</h2><p class="muted">Définir les jours travaillés, les pauses, les fermetures et les ouvertures exceptionnelles.</p></div><button class="btn ghost" id="businessHoursRefresh">Actualiser</button></div>
      <div id="businessHoursStatus" class="status hidden"></div>
      <div id="businessHoursList"></div>
      <div class="toolbar"><button class="btn primary" id="businessHoursSave">Enregistrer les horaires</button></div>
      <hr>
      <h3>Fermeture ou ouverture exceptionnelle</h3>
      <div class="grid2">
        <label>Du<input id="exceptionStart" type="date"></label>
        <label>Au<input id="exceptionEnd" type="date"></label>
        <label>Type<select id="exceptionStatus"><option value="closed">Entreprise fermée</option><option value="open">Entreprise ouverte exceptionnellement</option></select></label>
        <label>Motif<input id="exceptionReason" placeholder="Congés, jour férié, ouverture spéciale…"></label>
        <label>Matin début<input id="exceptionMorningStart" type="time"></label>
        <label>Matin fin<input id="exceptionMorningEnd" type="time"></label>
        <label>Après-midi début<input id="exceptionAfternoonStart" type="time"></label>
        <label>Après-midi fin<input id="exceptionAfternoonEnd" type="time"></label>
      </div>
      <div class="toolbar"><button class="btn primary" id="exceptionAdd">Ajouter l’exception</button></div>
      <div id="exceptionList" style="display:grid;gap:10px;margin-top:12px"></div>`;
    planning.appendChild(card);
    card.querySelector('#businessHoursRefresh').onclick = () => load().catch(showError);
    card.querySelector('#businessHoursSave').onclick = () => saveHours().catch(showError);
    card.querySelector('#exceptionAdd').onclick = () => addException().catch(showError);
  }

  function showError(error) {
    A().status('businessHoursStatus', error.message || 'Gestion des horaires indisponible.', true);
  }

  function renderHours(rows) {
    const byDay = new Map((rows || []).map((row) => [Number(row.weekday), row]));
    const host = document.getElementById('businessHoursList');
    host.innerHTML = `<div style="display:grid;gap:10px;margin:12px 0">${days.map((label, weekday) => {
      const row = byDay.get(weekday) || { weekday, is_open:false };
      return `<article class="card" data-hours-day="${weekday}" style="padding:12px">
        <div class="top"><strong>${label}</strong><label style="display:flex;align-items:center;gap:8px"><input data-hours-open type="checkbox" ${row.is_open ? 'checked' : ''}> Ouvert</label></div>
        <div class="grid4" style="margin-top:10px">
          <label>Matin début<input data-hours-morning-start type="time" value="${time(row.morning_start)}"></label>
          <label>Matin fin<input data-hours-morning-end type="time" value="${time(row.morning_end)}"></label>
          <label>Après-midi début<input data-hours-afternoon-start type="time" value="${time(row.afternoon_start)}"></label>
          <label>Après-midi fin<input data-hours-afternoon-end type="time" value="${time(row.afternoon_end)}"></label>
        </div>
      </article>`;
    }).join('')}</div>`;
    host.querySelectorAll('[data-hours-open]').forEach((input) => input.onchange = () => {
      const article = input.closest('[data-hours-day]');
      article.querySelectorAll('input[type="time"]').forEach((node) => node.disabled = !input.checked);
    });
    host.querySelectorAll('[data-hours-day]').forEach((article) => {
      const open = article.querySelector('[data-hours-open]').checked;
      article.querySelectorAll('input[type="time"]').forEach((node) => node.disabled = !open);
    });
  }

  function renderExceptions(rows) {
    const host = document.getElementById('exceptionList');
    host.innerHTML = (rows || []).length ? rows.map((row) => `<article class="card" style="padding:12px"><div class="top"><div><span class="pill">${row.status === 'closed' ? 'Fermé' : 'Ouvert exceptionnellement'}</span><strong style="margin-left:8px">${new Date(row.starts_on + 'T00:00:00').toLocaleDateString('fr-FR')} → ${new Date(row.ends_on + 'T00:00:00').toLocaleDateString('fr-FR')}</strong><p class="muted">${esc(row.reason || 'Sans motif')}${row.status === 'open' ? ` · ${time(row.morning_start)}–${time(row.morning_end)} ${time(row.afternoon_start)}–${time(row.afternoon_end)}` : ''}</p></div><button class="btn danger" data-exception-delete="${row.id}">Supprimer</button></div></article>`).join('') : '<p class="muted">Aucune fermeture ou ouverture exceptionnelle.</p>';
    host.querySelectorAll('[data-exception-delete]').forEach((button) => button.onclick = async () => {
      const result = await A().db.from('business_schedule_exceptions').delete().eq('id', button.dataset.exceptionDelete);
      if (result.error) throw result.error;
      A().status('businessHoursStatus', 'Exception supprimée.');
      await load();
    });
  }

  async function saveHours() {
    const payload = [...document.querySelectorAll('[data-hours-day]')].map((article) => {
      const isOpen = article.querySelector('[data-hours-open]').checked;
      const value = (selector) => article.querySelector(selector).value || null;
      const morningStart = isOpen ? value('[data-hours-morning-start]') : null;
      const morningEnd = isOpen ? value('[data-hours-morning-end]') : null;
      const afternoonStart = isOpen ? value('[data-hours-afternoon-start]') : null;
      const afternoonEnd = isOpen ? value('[data-hours-afternoon-end]') : null;
      if (isOpen && !((morningStart && morningEnd) || (afternoonStart && afternoonEnd))) throw new Error(`${days[Number(article.dataset.hoursDay)]} : renseignez au moins une plage horaire.`);
      return { weekday:Number(article.dataset.hoursDay), is_open:isOpen, morning_start:morningStart, morning_end:morningEnd, afternoon_start:afternoonStart, afternoon_end:afternoonEnd, updated_at:new Date().toISOString() };
    });
    const result = await A().db.from('business_hours').upsert(payload, { onConflict:'weekday' });
    if (result.error) throw result.error;
    A().status('businessHoursStatus', 'Jours et horaires enregistrés.');
    await load();
  }

  async function addException() {
    const start = document.getElementById('exceptionStart').value;
    const end = document.getElementById('exceptionEnd').value || start;
    const status = document.getElementById('exceptionStatus').value;
    if (!start) throw new Error('La date de début est obligatoire.');
    if (end < start) throw new Error('La date de fin doit être après la date de début.');
    const payload = {
      starts_on:start,
      ends_on:end,
      status,
      reason:document.getElementById('exceptionReason').value.trim() || null,
      morning_start:status === 'open' ? (document.getElementById('exceptionMorningStart').value || null) : null,
      morning_end:status === 'open' ? (document.getElementById('exceptionMorningEnd').value || null) : null,
      afternoon_start:status === 'open' ? (document.getElementById('exceptionAfternoonStart').value || null) : null,
      afternoon_end:status === 'open' ? (document.getElementById('exceptionAfternoonEnd').value || null) : null
    };
    if (status === 'open' && !((payload.morning_start && payload.morning_end) || (payload.afternoon_start && payload.afternoon_end))) throw new Error('Renseignez au moins une plage horaire pour une ouverture exceptionnelle.');
    const result = await A().db.from('business_schedule_exceptions').insert(payload);
    if (result.error) throw result.error;
    ['exceptionStart','exceptionEnd','exceptionReason','exceptionMorningStart','exceptionMorningEnd','exceptionAfternoonStart','exceptionAfternoonEnd'].forEach((id) => { document.getElementById(id).value = ''; });
    A().status('businessHoursStatus', 'Exception ajoutée.');
    await load();
  }

  async function load() {
    ensureUi();
    const [hours, exceptions] = await Promise.all([
      A().db.from('business_hours').select('*').order('weekday'),
      A().db.from('business_schedule_exceptions').select('*').order('starts_on', { ascending:false })
    ]);
    if (hours.error) throw hours.error;
    if (exceptions.error) throw exceptions.error;
    renderHours(hours.data || []);
    renderExceptions(exceptions.data || []);
  }

  const boot = () => {
    const observer = new MutationObserver(() => { if (document.getElementById('planning')) { ensureUi(); observer.disconnect(); } });
    observer.observe(document.body, { childList:true, subtree:true });
    ensureUi();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-page="planning"]')) setTimeout(() => load().catch(showError), 100);
    });
  };
  window.EDMAdminBusinessHours = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();