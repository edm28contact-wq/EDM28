(() => {
  if (window.__edmBackofficeSyncInstalled) return;
  window.__edmBackofficeSyncInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const time = (value) => value ? String(value).slice(0,5).replace(':',' h ') : '';
  const dayNames = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

  function mapService(row) {
    const price = Number(row.labor_price ?? row.displayed_price ?? 0);
    return {
      id: row.external_service_id || row.slug || row.id,
      category: row.category || 'Autres',
      name: row.name || 'Prestation',
      labor: price,
      parts: { eco:[0,0], standard:[0,0], premium:[0,0] },
      type: row.pricing_type || 'Prestation',
      eligible: true,
      excluded: false,
      short: row.client_description || '',
      detail: row.technical_description || row.client_description || '',
      durationMinutes: row.duration_minutes || null,
      onlineBookingEnabled: row.online_booking_enabled !== false
    };
  }

  async function syncServices() {
    if (typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient
      .from('site_services')
      .select('id,external_service_id,category,name,slug,client_description,technical_description,pricing_type,displayed_price,labor_price,duration_minutes,online_booking_enabled,display_order')
      .order('display_order');
    if (error) throw error;
    if (!data?.length) return;
    const services = data.map(mapService);
    try {
      window.eval(`SERVICES.splice(0, SERVICES.length, ...${JSON.stringify(services)})`);
      if (typeof renderServices === 'function') renderServices();
      if (typeof updateSummary === 'function') updateSummary();
    } catch (error) {
      console.warn('EDM services sync unavailable', error);
    }
  }

  function hoursHtml(hours) {
    const byDay = new Map((hours || []).map((row) => [Number(row.weekday), row]));
    return dayNames.map((label, weekday) => {
      const row = byDay.get(weekday);
      if (!row?.is_open) return `<div class="summary-line"><span>${label}</span><strong>Fermé</strong></div>`;
      const ranges = [];
      if (row.morning_start && row.morning_end) ranges.push(`${time(row.morning_start)} – ${time(row.morning_end)}`);
      if (row.afternoon_start && row.afternoon_end) ranges.push(`${time(row.afternoon_start)} – ${time(row.afternoon_end)}`);
      return `<div class="summary-line"><span>${label}</span><strong>${esc(ranges.join(' / ') || 'Ouvert')}</strong></div>`;
    }).join('');
  }

  function exceptionsHtml(rows) {
    const upcoming = (rows || []).filter((row) => new Date(`${row.ends_on}T23:59:59`) >= new Date()).slice(0,6);
    if (!upcoming.length) return '';
    return `<div class="notice" style="margin-top:14px"><strong>Informations exceptionnelles</strong>${upcoming.map((row) => `<p style="margin:8px 0 0"><b>${row.status === 'closed' ? 'Fermeture' : 'Ouverture exceptionnelle'}</b> du ${new Date(`${row.starts_on}T00:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${row.ends_on}T00:00:00`).toLocaleDateString('fr-FR')}${row.reason ? ` · ${esc(row.reason)}` : ''}</p>`).join('')}</div>`;
  }

  async function syncBusiness() {
    if (typeof supabaseClient === 'undefined') return;
    const [profileResult, hoursResult, exceptionsResult] = await Promise.all([
      supabaseClient.from('public_business_profile').select('*').maybeSingle(),
      supabaseClient.from('business_hours').select('*').order('weekday'),
      supabaseClient.from('business_schedule_exceptions').select('*').order('starts_on')
    ]);
    if (profileResult.error) throw profileResult.error;
    if (hoursResult.error) throw hoursResult.error;
    if (exceptionsResult.error) throw exceptionsResult.error;

    const profile = profileResult.data || {};
    document.querySelectorAll('.brand-name').forEach((node) => { if (profile.business_name) node.textContent = profile.business_name; });
    document.querySelectorAll('.topbar-title span:last-child').forEach((node) => { if (profile.business_name) node.textContent = profile.business_name; });

    const about = document.getElementById('about');
    if (about && !about.querySelector('[data-backoffice-public-info]')) {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.dataset.backofficePublicInfo = 'true';
      const address = [profile.address_line1, profile.address_line2, profile.postal_code, profile.city, profile.country].filter(Boolean).join(' · ');
      panel.innerHTML = `<div class="section-title"><div><h2>Informations EDM28</h2><p>Ces informations sont mises à jour depuis le back-office.</p></div></div>
        <div class="grid">
          <div class="card"><h3>Coordonnées</h3><div class="summary" style="margin-top:14px">
            ${profile.phone ? `<div class="summary-line"><span>Téléphone</span><strong>${esc(profile.phone)}</strong></div>` : ''}
            ${profile.email ? `<div class="summary-line"><span>Email</span><strong>${esc(profile.email)}</strong></div>` : ''}
            ${address ? `<div class="summary-line"><span>Adresse</span><strong>${esc(address)}</strong></div>` : ''}
          </div></div>
          <div class="card"><h3>Horaires habituels</h3><div class="summary" style="margin-top:14px">${hoursHtml(hoursResult.data || [])}</div>${exceptionsHtml(exceptionsResult.data || [])}</div>
        </div>`;
      about.appendChild(panel);
    }

    window.EDM_PUBLIC_BUSINESS = profile;
    window.EDM_BUSINESS_HOURS = hoursResult.data || [];
    window.EDM_SCHEDULE_EXCEPTIONS = exceptionsResult.data || [];
  }

  async function install() {
    await Promise.allSettled([syncServices(), syncBusiness()]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();