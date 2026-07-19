(() => {
  async function render() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient.from('repair_orders').select('id,order_number,status,authorized_work,appointment_id,appointments(starts_at,status)').eq('user_id', state.user.id).eq('visible_to_client', true).order('created_at', { ascending: false });
    if (error) throw error;
    const cards = (data || []).map((o) => {
      const work = Array.isArray(o.authorized_work) ? o.authorized_work.map((x) => x.name || x.id).filter(Boolean).join(' · ') : '';
      const date = o.appointments?.starts_at ? new Date(o.appointments.starts_at).toLocaleString('fr-FR') : 'À confirmer';
      return `<article class="card"><div class="section-title"><h3>${escapeHtml(o.order_number || 'Ordre de réparation')}</h3><span class="pill orange">${escapeHtml(o.status)}</span></div><p>Rendez-vous : ${escapeHtml(date)}</p><p class="small">${escapeHtml(work || 'Travaux autorisés à confirmer')}</p></article>`;
    }).join('');
    const section = document.createElement('section');
    section.className = 'panel';
    section.dataset.operationHistory = 'true';
    section.innerHTML = `<h3>Prise en charge atelier</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune intervention planifiée.</div>'}</div>`;
    host.querySelector('[data-operation-history]')?.remove();
    host.prepend(section);
  }
  const schedule = () => setTimeout(() => render().catch((e) => console.warn('EDM operations unavailable', e)), 650);
  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
})();