(() => {
  const app = () => window.EDMAdmin;

  async function save(id, publish) {
    const root = document.querySelector(`[data-quote-id="${id}"]`);
    const quoteNumber = root.querySelector('[data-field="number"]').value.trim();
    const total = Number(root.querySelector('[data-field="total"]').value || 0);
    const validUntil = root.querySelector('[data-field="validUntil"]').value || null;
    if (!quoteNumber || !Number.isFinite(total) || total <= 0) throw new Error('Numéro et montant positif obligatoires.');
    const patch = { quote_number: quoteNumber, total, valid_until: validUntil };
    if (publish) Object.assign(patch, { status: 'sent', visible_to_client: true });
    const query = app().db.from('quotes').update(patch).eq('id', id);
    if (publish) query.eq('status', 'draft');
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Le devis a déjà changé de statut.');
  }

  function render(rows) {
    const host = app().$('quoteList');
    host.innerHTML = rows.length ? rows.map((q) => `<article class="card" data-quote-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${app().esc(q.status)}</span><h3>${app().esc(q.title || 'Devis EDM AUTO')}</h3></div><strong>${app().money(q.total)}</strong></div><p>${app().esc(q.profiles?.email || 'Client')} · ${app().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Numéro<input data-field="number" value="${app().esc(q.quote_number || '')}"></label><label>Montant TTC<input data-field="total" type="number" min="0" step="0.01" value="${Number(q.total || 0)}"></label><label>Valable jusqu’au<input data-field="validUntil" type="date" value="${app().esc(q.valid_until || '')}"></label><div class="toolbar"><button class="btn ghost" data-save="${q.id}">Enregistrer</button>${q.status === 'draft' ? `<button class="btn primary" data-publish="${q.id}">Publier au client</button>` : ''}</div></article>`).join('') : '<p class="muted">Aucun devis.</p>';
    host.querySelectorAll('[data-save],[data-publish]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { await save(button.dataset.save || button.dataset.publish, Boolean(button.dataset.publish)); app().status('quoteStatus', button.dataset.publish ? 'Devis publié au client.' : 'Devis enregistré.'); await load(); }
      catch (error) { app().status('quoteStatus', error.message || 'Opération impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = app().$('quoteList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('quotes').select('id,status,title,quote_number,total,valid_until,visible_to_client,created_at,profiles(email),vehicles(plate)').in('status', ['draft','sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  window.EDMAdminQuotes = { load };
})();