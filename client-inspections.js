(() => {
  const labels = { conforme: 'Conforme', surveiller: 'À surveiller', remplacer: 'À remplacer' };
  async function render() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient.from('inspection_reports').select('id,report_number,status,mileage,technician_name,checks,observations,completed_at,pdf_path,created_at,repair_orders(order_number),vehicles(plate,brand,model)').eq('user_id', state.user.id).eq('visible_to_client', true).order('created_at', { ascending: false });
    if (error) throw error;
    const cards = (data || []).map((r) => {
      const checks = Object.entries(r.checks || {}).map(([key,value]) => `<li><strong>${escapeHtml(key.replaceAll('_',' '))}</strong> : ${escapeHtml(labels[value] || value)}</li>`).join('');
      return `<article class="card"><div class="section-title"><div><span class="pill orange">${escapeHtml(r.status)}</span><h3>${escapeHtml(r.report_number || 'Fiche de contrôle')}</h3></div><span>${r.completed_at ? new Date(r.completed_at).toLocaleDateString('fr-FR') : ''}</span></div><p>${escapeHtml([r.vehicles?.brand,r.vehicles?.model,r.vehicles?.plate].filter(Boolean).join(' '))}</p>${r.mileage ? `<p>Kilométrage : ${Number(r.mileage).toLocaleString('fr-FR')} km</p>` : ''}${checks ? `<ul>${checks}</ul>` : ''}<p>${escapeHtml(r.observations || '')}</p></article>`;
    }).join('');
    const section = document.createElement('section');
    section.className = 'panel'; section.dataset.inspectionHistory = 'true';
    section.innerHTML = `<h3>Fiches de contrôle</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune fiche de contrôle disponible.</div>'}</div>`;
    host.querySelector('[data-inspection-history]')?.remove(); host.prepend(section);
  }
  const schedule = () => setTimeout(() => render().catch((e) => console.warn('EDM inspections unavailable', e)), 700);
  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
})();