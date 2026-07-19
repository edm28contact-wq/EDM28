(() => {
  const labels = { issued: 'À régler', partially_paid: 'Partiellement réglée', paid: 'Réglée', overdue: 'Échue' };
  const money = (v) => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  async function renderInvoices() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const { data, error } = await supabaseClient.from('invoices').select('id,invoice_number,status,title,description,total,amount_paid,issued_at,due_at,pdf_path').eq('user_id', state.user.id).eq('visible_to_client', true).in('status', ['issued','partially_paid','paid','overdue']).order('issued_at', { ascending: false });
    if (error) throw error;
    const cards = (data || []).map((i) => {
      const balance = Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0));
      const due = i.due_at ? new Date(i.due_at).toLocaleDateString('fr-FR') : 'À confirmer';
      return `<article class="card"><div class="section-title"><div><span class="pill orange">${escapeHtml(labels[i.status] || i.status)}</span><h3 style="margin-top:10px">${escapeHtml(i.invoice_number || i.title || 'Facture')}</h3></div><strong>${money(i.total)}</strong></div><p>${escapeHtml(i.description || 'Prestations réalisées par EDM AUTO')}</p><p>Payé : ${money(i.amount_paid)} · Reste : ${money(balance)}</p><p class="small">Échéance : ${escapeHtml(due)}</p></article>`;
    }).join('');
    const section = document.createElement('section');
    section.className = 'panel';
    section.dataset.invoiceHistory = 'true';
    section.innerHTML = `<h3>Mes factures</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune facture disponible.</div>'}</div>`;
    host.querySelector('[data-invoice-history]')?.remove();
    host.prepend(section);
  }

  const schedule = () => setTimeout(() => renderInvoices().catch((e) => console.warn('EDM invoices unavailable', e)), 800);
  document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
})();