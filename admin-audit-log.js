(() => {
  const A = () => window.EDMAdmin;
  async function load() {
    const host = A()?.$('auditLogList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('audit_log').select('id,actor_id,entity_type,entity_id,action,metadata,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    host.innerHTML = (data || []).map((row) => `<article class="card compact" style="margin:10px 0"><div class="top"><div><span class="pill">${A().esc(row.entity_type)}</span><b>${A().esc(row.action)}</b></div><span class="muted">${new Date(row.created_at).toLocaleString('fr-FR')}</span></div><p class="muted">${A().esc(row.entity_id || '—')} · acteur ${A().esc(row.actor_id || 'système')}</p></article>`).join('') || '<p class="muted">Aucun événement audité.</p>';
  }
  function bind() {
    document.querySelector('[data-page="audit-log"]')?.addEventListener('click', () => load().catch((e) => A().status('auditLogStatus', e.message || 'Journal indisponible.', true)));
    document.getElementById('auditLogRefresh')?.addEventListener('click', () => load().catch((e) => A().status('auditLogStatus', e.message || 'Actualisation impossible.', true)));
  }
  window.EDMAdminAuditLog = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();