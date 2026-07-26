(() => {
  const A = () => window.EDMAdmin;
  async function load() {
    const host = A()?.$('messageTemplateList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('message_templates').select('id,template_key,label,subject,body,enabled,updated_at').order('label');
    if (error) throw error;
    const rows = data || [];
    host.innerHTML = rows.map((t) => `<article class="card" data-template="${t.id}" style="margin:12px 0"><div class="top"><div><h3>${A().esc(t.label)}</h3><p class="muted">${A().esc(t.template_key)}</p></div><label><input data-enabled type="checkbox" ${t.enabled ? 'checked' : ''}> Actif</label></div><label>Objet<input data-subject value="${A().esc(t.subject)}"></label><label>Message<textarea data-body rows="6">${A().esc(t.body)}</textarea></label><button class="btn primary" data-save="${t.id}">Enregistrer</button></article>`).join('') || '<p class="muted">Aucun modèle.</p>';
    host.querySelectorAll('[data-save]').forEach((button) => button.onclick = async () => {
      const root = button.closest('article');
      button.disabled = true;
      const patch = { subject: root.querySelector('[data-subject]').value.trim(), body: root.querySelector('[data-body]').value.trim(), enabled: root.querySelector('[data-enabled]').checked, updated_at: new Date().toISOString() };
      try { const result = await A().db.from('message_templates').update(patch).eq('id', button.dataset.save); if (result.error) throw result.error; A().status('messageTemplateStatus', 'Modèle enregistré.'); }
      catch (e) { A().status('messageTemplateStatus', e.message || 'Enregistrement impossible.', true); }
      finally { button.disabled = false; }
    });
  }
  function bind(){document.querySelector('[data-page="message-templates"]')?.addEventListener('click',()=>load().catch(e=>A().status('messageTemplateStatus',e.message,true)));document.getElementById('messageTemplateRefresh')?.addEventListener('click',()=>load().catch(e=>A().status('messageTemplateStatus',e.message,true)));}
  window.EDMAdminMessageTemplates={load}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();