(() => {
  const A = () => window.EDMAdmin;
  const types = {
    quote: { table: 'quotes', fields: 'id,user_id,quote_number,status,title,description,total,pdf_path', statuses: ['sent','accepted','refused'] },
    order: { table: 'repair_orders', fields: 'id,user_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,pdf_path', statuses: ['ready','signed','in_progress','completed','invoiced'] },
    invoice: { table: 'invoices', fields: 'id,user_id,invoice_number,status,title,description,total,amount_paid,pdf_path', statuses: ['issued','partially_paid','paid','overdue'] }
  };
  const number = (r) => r.quote_number || r.order_number || r.invoice_number || r.id;
  const money = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' EUR';
  function content(type, r) {
    const out = ['EDM AUTO', type === 'quote' ? 'DEVIS' : type === 'order' ? 'ORDRE DE REPARATION' : 'FACTURE', `Numero : ${number(r)}`, `Date : ${new Date().toLocaleDateString('fr-FR')}`, '', r.title, r.description, `Statut : ${r.status}`].filter(Boolean);
    if (r.mileage_in != null) out.push(`Kilometrage entree : ${r.mileage_in} km`);
    if (r.visible_condition) out.push(`Etat visible : ${r.visible_condition}`);
    if (r.customer_items) out.push(`Objets client : ${r.customer_items}`);
    if (Array.isArray(r.authorized_work)) r.authorized_work.forEach((x) => out.push(`- ${x.name || x.id || x}`));
    if (r.total != null) out.push('', `Total : ${money(r.total)}`);
    if (r.amount_paid != null) out.push(`Regle : ${money(r.amount_paid)}`, `Reste : ${money(Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0)))}`);
    return out;
  }
  async function generate(type, row) {
    const path = `${row.user_id}/${type}/${row.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, EDMPdfLite.build(content(type, row)), { contentType: 'application/pdf' });
    if (upload.error) throw upload.error;
    const saved = await A().db.from(types[type].table).update({ pdf_path: path }).eq('id', row.id).select('id');
    if (saved.error || !saved.data?.length) { await A().db.storage.from('repair-documents').remove([path]); throw saved.error || new Error('Document modifie.'); }
  }
  async function load() {
    const host = A()?.$('documentPdfList'); if (!host) return;
    host.innerHTML = '<p class="muted">Chargement...</p>';
    const results = await Promise.all(Object.entries(types).map(async ([type, cfg]) => {
      const q = await A().db.from(cfg.table).select(cfg.fields).in('status', cfg.statuses);
      if (q.error) throw q.error; return (q.data || []).map((row) => ({ type, row }));
    }));
    const rows = results.flat();
    host.innerHTML = rows.map(({ type, row }) => `<article class="card" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(type)}</span><h3>${A().esc(number(row))}</h3></div><button class="btn primary" data-type="${type}" data-id="${row.id}">${row.pdf_path ? 'Regenerer' : 'Generer'} le PDF</button></div></article>`).join('') || '<p class="muted">Aucun document publiable.</p>';
    host.querySelectorAll('[data-id]').forEach((b) => b.onclick = async () => { b.disabled = true; try { const x = rows.find((v) => v.type === b.dataset.type && v.row.id === b.dataset.id); await generate(x.type, x.row); A().status('documentPdfStatus', 'PDF prive genere.'); await load(); } catch (e) { A().status('documentPdfStatus', e.message || 'Generation impossible.', true); } finally { b.disabled = false; } });
  }
  function bind() { document.querySelector('[data-page="document-pdf"]')?.addEventListener('click', () => load().catch((e) => A().status('documentPdfStatus', e.message, true))); document.getElementById('documentPdfRefresh')?.addEventListener('click', () => load().catch((e) => A().status('documentPdfStatus', e.message, true))); }
  window.EDMAdminDocumentPdf = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();