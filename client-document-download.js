(() => {
  async function open(path) {
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error || !data?.signedUrl) throw error || new Error('Lien indisponible.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function render() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const specs = [['quotes','quote_number','Devis'],['repair_orders','order_number','Ordre de réparation'],['invoices','invoice_number','Facture']];
    const results = await Promise.all(specs.map(async ([table, field, fallback]) => {
      const q = await supabaseClient.from(table).select(`id,${field},pdf_path`).eq('user_id', state.user.id).eq('visible_to_client', true).not('pdf_path', 'is', null);
      if (q.error) throw q.error;
      return (q.data || []).map((row) => ({ label: row[field] || fallback, path: row.pdf_path }));
    }));
    const rows = results.flat();
    const section = document.createElement('section');
    section.className = 'panel'; section.dataset.documentDownloads = 'true';
    section.innerHTML = `<h3>Mes documents PDF</h3><div class="grid" style="margin-top:14px">${rows.map((x) => `<article class="card"><div class="section-title"><h3>${escapeHtml(x.label)}</h3><button class="btn primary" data-path="${escapeHtml(x.path)}">Ouvrir</button></div></article>`).join('') || '<div class="empty">Aucun PDF disponible.</div>'}</div>`;
    host.querySelector('[data-document-downloads]')?.remove(); host.prepend(section);
    section.querySelectorAll('[data-path]').forEach((b) => b.onclick = async () => { b.disabled = true; try { await open(b.dataset.path); } catch (e) { alert(e.message || 'Téléchargement impossible.'); } finally { b.disabled = false; } });
  }
  const schedule = () => setTimeout(() => render().catch((e) => console.warn('EDM documents unavailable', e)), 900);
  document.querySelectorAll('[data-page="history"]').forEach((b) => b.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_e, s) => { if (s?.user) schedule(); });
})();