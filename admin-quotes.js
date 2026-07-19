(() => {
  const app = () => window.EDMAdmin;
  const currentDate = () => new Date().toISOString().slice(0, 10);

  async function save(id, publish) {
    const root = document.querySelector(`[data-quote-id="${id}"]`);
    const quoteNumber = root.querySelector('[data-field="number"]').value.trim();
    const total = Number(root.querySelector('[data-field="total"]').value || 0);
    const validUntil = root.querySelector('[data-field="validUntil"]').value || null;
    if (!quoteNumber || !Number.isFinite(total) || total <= 0) throw new Error('Numéro et montant positif obligatoires.');
    if (publish && (!validUntil || validUntil < currentDate())) throw new Error('Une date de validité future est obligatoire.');
    const patch = { quote_number: quoteNumber, total, valid_until: validUntil };
    if (publish) Object.assign(patch, { status: 'sent', visible_to_client: true });
    const { data, error } = await app().db.from('quotes').update(patch).eq('id', id).eq('status', 'draft').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Seul un brouillon peut être modifié ou publié.');
  }

  function render(rows) {
    const host = app().$('quoteList');
    host.innerHTML = rows.length ? rows.map((q) => {
      const draft = q.status === 'draft';
      const locked = draft ? '' : ' disabled';
      const actions = draft ? `<div class="toolbar"><button class="btn ghost" data-save="${q.id}">Enregistrer</button><button class="btn primary" data-publish="${q.id}">Publier au client</button></div>` : '<p class="muted">Devis verrouillé après publication.</p>';
      return `<article class="card" data-quote-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${app().esc(q.status)}</span><h3>${app().esc(q.title || 'Devis EDM AUTO')}</h3></div><strong>${app().money(q.total)}</strong></div><p>${app().esc(q.profiles?.email || 'Client')} · ${app().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Numéro<input data-field="number" value="${app().esc(q.quote_number || '')}"${locked}></label><label>Montant TTC<input data-field="total" type="number" min="0" step="0.01" value="${Number(q.total || 0)}"${locked}></label><label>Valable jusqu’au<input data-field="validUntil" type="date" value="${app().esc(q.valid_until || '')}"${locked}></label>${actions}</article>`;
    }).join('') : '<p class="muted">Aucun devis.</p>';
    host.querySelectorAll('[data-save],[data-publish]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { await save(button.dataset.save || button.dataset.publish, Boolean(button.dataset.publish)); app().status('quoteStatus', button.dataset.publish ? 'Devis publié au client.' : 'Devis enregistré.'); await load(); await app().overview(); }
      catch (error) { app().status('quoteStatus', error.message || 'Opération impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = app()?.$('quoteList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('quotes').select('id,status,title,quote_number,total,valid_until,visible_to_client,created_at,profiles(email),vehicles(plate)').in('status', ['draft','sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function bind() {
    document.querySelector('[data-page="quotes"]')?.addEventListener('click', () => load().catch((error) => app().status('quoteStatus', error.message || 'Devis indisponibles.', true)));
    document.getElementById('quoteRefresh')?.addEventListener('click', () => load().catch((error) => app().status('quoteStatus', error.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminQuotes = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();