(() => {
  const safe = (v) => typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '');
  async function load() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient.from('client_messages').select('id,subject,body,channel,read_by_client,created_at').eq('user_id', state.user.id).eq('visible_to_client', true).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    const rows = data || [];
    const unread = rows.filter((m) => !m.read_by_client).length;
    const section = document.createElement('section');
    section.className = 'panel'; section.dataset.notificationHistory = 'true';
    section.innerHTML = `<div class="section-title"><h3>Notifications</h3><span class="pill orange">${unread} non lue${unread > 1 ? 's' : ''}</span></div><div class="grid" style="margin-top:14px">${rows.map((m) => `<article class="card" data-message-id="${m.id}"><div class="section-title"><h3>${safe(m.subject || 'Information EDM AUTO')}</h3><span class="pill">${m.read_by_client ? 'Lu' : 'Nouveau'}</span></div><p>${safe(m.body)}</p><p class="small">${new Date(m.created_at).toLocaleString('fr-FR')}</p>${m.read_by_client ? '' : '<button class="btn ghost" data-mark-read>Marquer comme lu</button>'}</article>`).join('') || '<div class="empty">Aucune notification.</div>'}</div>`;
    host.querySelector('[data-notification-history]')?.remove(); host.prepend(section);
    section.querySelectorAll('[data-mark-read]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      const id = button.closest('[data-message-id]')?.dataset.messageId;
      const { error: updateError } = await supabaseClient.from('client_messages').update({ read_by_client: true }).eq('id', id).eq('user_id', state.user.id).eq('read_by_client', false);
      if (updateError) alert(updateError.message || 'Mise à jour impossible.'); else await load();
    });
  }
  const schedule = () => setTimeout(() => load().catch((e) => console.warn('EDM notifications unavailable', e)), 900);
  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
})();