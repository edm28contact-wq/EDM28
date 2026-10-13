(() => {
  async function render() {
    const host = document.getElementById('historyList');
    if (!host || !state.user?.id || typeof supabaseClient === 'undefined') return;
    const [orders, profile] = await Promise.all([
      supabaseClient.from('repair_orders')
        .select('id,order_number,status,authorized_work,appointment_id,pdf_path,signed_at,client_signature_name,appointments(starts_at,status)')
        .eq('user_id', state.user.id).eq('visible_to_client', true)
        .order('created_at', { ascending: false }),
      supabaseClient.from('profiles')
        .select('first_name,last_name').eq('id',state.user.id).maybeSingle()
    ]);
    if (orders.error || profile.error) throw orders.error || profile.error;
    const profileName = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(' ');
    const cards = (orders.data || []).map((o) => {
      const work = Array.isArray(o.authorized_work) ? o.authorized_work.map(x => x.name || x.id).filter(Boolean).join(' · ') : '';
      const date = o.appointments?.starts_at ? new Date(o.appointments.starts_at).toLocaleString('fr-FR') : 'À confirmer';
      const signed = o.signed_at ? `<div class="status ok">Accord signé électroniquement par ${escapeHtml(o.client_signature_name || profileName)} le ${escapeHtml(new Date(o.signed_at).toLocaleString('fr-FR'))}.</div>` : '';
      const canSign = !o.signed_at && o.pdf_path && ['ready','signed'].includes(o.status);
      const consent = canSign ? `
        <div class="card" style="margin:12px 0;padding:12px">
          <strong>Signature de l’ordre de réparation</strong>
          <p class="small">Lisez le PDF avant de signer. Votre accord sera enregistré avec votre compte, votre nom et la date. La signature est définitive pour cette version du document.</p>
          <label>Prénom et nom du signataire<input data-order-name maxlength="160" value="${escapeHtml(profileName)}" autocomplete="name"></label>
          <label style="display:flex;gap:8px;align-items:flex-start"><input data-order-consent type="checkbox"> J’ai lu l’OR et j’accepte expressément les travaux et le montant indiqués.</label>
          <button type="button" class="btn btn-primary" data-sign-order="${escapeHtml(o.id)}">Signer électroniquement</button>
          <p class="small" data-order-sign-status aria-live="polite"></p>
        </div>` : '';
      const pdf = o.pdf_path ? `<button class="btn btn-ghost" type="button" data-order-pdf="${escapeHtml(o.pdf_path)}">Consulter l’OR PDF</button>` : '';
      return `<article class="card"><div class="section-title"><h3>${escapeHtml(o.order_number || 'Ordre de réparation')}</h3><span class="pill orange">${escapeHtml(o.status)}</span></div><p>Rendez-vous : ${escapeHtml(date)}</p><p class="small">${escapeHtml(work || 'Travaux autorisés à confirmer')}</p>${pdf}${signed}${consent}</article>`;
    }).join('');
    const section = document.createElement('section');
    section.className = 'panel';
    section.dataset.operationHistory = 'true';
    section.innerHTML = `<h3>Prise en charge atelier</h3><div class="grid" style="margin-top:14px">${cards || '<div class="empty">Aucune intervention planifiée.</div>'}</div>`;
    host.querySelector('[data-operation-history]')?.remove();
    host.prepend(section);
    section.querySelectorAll('[data-order-pdf]').forEach(button => {
      button.addEventListener('click',async () => {
        const {data,error} = await supabaseClient.storage.from('repair-documents').createSignedUrl(button.dataset.orderPdf, 90);
        if (error || !data?.signedUrl) { window.alert(error?.message || 'Document indisponible.'); return; }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      });
    });
    section.querySelectorAll('[data-sign-order]').forEach(button => {
      button.addEventListener('click',async () => {
        const card = button.closest('.card');
        const checked = card.querySelector('[data-order-consent]')?.checked;
        const name = card.querySelector('[data-order-name]')?.value.trim();
        const status = card.querySelector('[data-order-sign-status]');
        if (!checked || !name) { status.textContent = 'Cochez votre accord et renseignez votre nom pour signer.'; return; }
        button.disabled = true;
        try {
          const {error} = await supabaseClient.rpc('client_sign_repair_order',{
            p_order_id:button.dataset.signOrder,p_name:name,p_accept:true
          });
          if (error) throw error;
          await render();
        } catch (error) {
          status.textContent = error.message || 'Signature impossible.';
          button.disabled = false;
        }
      });
    });
  }
  const schedule = () => setTimeout(() => render().catch(e => console.warn('EDM operations unavailable', e)), 650);
  document.querySelectorAll('[data-page="history"]').forEach(button => button.addEventListener('click', schedule));
  if (typeof supabaseClient !== 'undefined') supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user) schedule(); });
})();
