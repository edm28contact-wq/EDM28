(() => {
  const labels = { sent: 'À valider', accepted: 'Accepté', refused: 'Refusé' };

  async function respond(id, status) {
    if (!['accepted', 'refused'].includes(status)) return;
    const { data, error } = await supabaseClient.from('quotes').update({ status }).eq('id', id).eq('status', 'sent').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Ce devis a déjà été traité ou a expiré.');
  }

  function card(q) {
    const expired = q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10);
    const actions = q.status === 'sent' && !expired ? `<div class="toolbar"><button class="btn primary" data-quote-response="accepted" data-quote-id="${q.id}">Accepter</button><button class="btn ghost" data-quote-response="refused" data-quote-id="${q.id}">Refuser</button></div>` : '';
    return `<article class="card"><div class="section-title"><div><span class="pill orange">${escapeHtml(labels[q.status] || q.status)}</span><h3 style="margin-top:10px">${escapeHtml(q.quote_number || q.title || 'Devis EDM AUTO')}</h3></div><strong>${Number(q.total || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong></div><p>${escapeHtml(q.description || 'Prestations détaillées par EDM AUTO')}</p><p class="small">${q.valid_until ? `Valable jusqu’au ${new Date(`${q.valid_until}T00:00:00`).toLocaleDateString('fr-FR')}` : 'Validité à confirmer'}${expired ? ' · Expiré' : ''}</p>${actions}</article>`;
  }

  async function renderQuotes() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient.from('quotes').select('id,status,title,description,quote_number,total,valid_until,pdf_path,created_at').eq('user_id', state.user.id).eq('visible_to_client', true).in('status', ['sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    const section = document.createElement('section');
    section.className = 'panel';
    section.dataset.quoteHistory = 'true';
    section.innerHTML = `<h3>Mes devis</h3><div class="grid" style="margin-top:14px">${(data || []).map(card).join('') || '<div class="empty">Aucun devis disponible.</div>'}</div>`;
    host.querySelector('[data-quote-history]')?.remove();
    host.prepend(section);
    section.querySelectorAll('[data-quote-response]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { await respond(button.dataset.quoteId, button.dataset.quoteResponse); await renderQuotes(); }
      catch (error) { alert(error.message || 'Réponse impossible.'); }
      finally { button.disabled = false; }
    });
  }

  const schedule = () => setTimeout(() => renderQuotes().catch((error) => console.warn('EDM quotes unavailable', error)), 500);
  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
  window.__edmClientQuotes = true;
})();