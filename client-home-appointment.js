(() => {
  if (window.__edmHomeAppointmentInstalled) return;
  window.__edmHomeAppointmentInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString('fr-FR', { dateStyle:'full', timeStyle:'short' });
  };

  async function render() {
    const host = document.getElementById('homeNextAppointment');
    if (!host || typeof supabaseClient === 'undefined') return;

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      host.innerHTML = '';
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
      .from('appointments')
      .select('id,starts_at,ends_at,status,vehicle_id,vehicles(plate,brand,model)')
      .eq('user_id', userData.user.id)
      .eq('visible_to_client', true)
      .neq('status', 'cancelled')
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('EDM next appointment unavailable', error);
      host.innerHTML = '';
      return;
    }

    if (!data?.starts_at) {
      host.innerHTML = '';
      return;
    }

    const vehicle = data.vehicles
      ? [data.vehicles.plate, data.vehicles.brand, data.vehicles.model].filter(Boolean).join(' · ')
      : '';

    host.innerHTML = `
      <div class="panel" style="margin-top:18px">
        <div class="section-title">
          <div>
            <span class="pill green">Prochain rendez-vous</span>
            <h2 style="margin-top:12px">${esc(formatDate(data.starts_at))}</h2>
            <p>${vehicle ? esc(vehicle) : 'Intervention EDM28'}</p>
          </div>
          <button class="btn btn-primary" type="button" data-page="history">Voir mes interventions</button>
        </div>
      </div>`;
  }

  function schedule() {
    window.setTimeout(() => render().catch((error) => console.warn('EDM next appointment render unavailable', error)), 80);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-page="home"]')) schedule();
  });
  window.addEventListener('edm:appointment-updated', schedule);
  window.addEventListener('edm:request-submitted', schedule);

  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange(() => schedule());
  }

  window.EDMHomeAppointment = { render, schedule };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once:true });
  } else {
    schedule();
  }
})();