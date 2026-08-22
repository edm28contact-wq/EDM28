(() => {
  if (window.__edmQuoteMessageNotifyInstalled) return;
  window.__edmQuoteMessageNotifyInstalled = true;

  const A = () => window.EDMAdmin;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function ensureMessage(quoteId) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const admin = A();
      if (!admin?.db) return;

      const { data: quote, error } = await admin.db
        .from('quotes')
        .select('id,user_id,service_request_id,quote_number,status,total,visible_to_client')
        .eq('id', quoteId)
        .maybeSingle();
      if (error) throw error;

      if (quote?.status === 'sent' && quote.visible_to_client === true) {
        const subject = `Devis ${quote.quote_number || 'EDM28'} disponible`;
        const existing = await admin.db
          .from('client_messages')
          .select('id')
          .eq('user_id', quote.user_id)
          .eq('service_request_id', quote.service_request_id)
          .eq('direction', 'outbound')
          .eq('subject', subject)
          .limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.length) return;

        const total = Number(quote.total || 0).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
        const body = `Votre devis ${quote.quote_number || 'EDM28'} d’un montant de ${total} est disponible. Ouvrez « Préparer mon RDV » pour consulter le devis, l’accepter ou le refuser. Après acceptation, vous pourrez choisir directement votre créneau de rendez-vous.`;
        const sent = await admin.db.rpc('admin_send_message', {
          p_user_id: quote.user_id,
          p_body: body,
          p_service_request_id: quote.service_request_id,
          p_subject: subject,
          p_ai_draft_id: null
        });
        if (sent.error) throw sent.error;
        return;
      }

      if (quote && quote.status !== 'draft') return;
      await sleep(700);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-quote-id] [data-publish]');
    if (!button) return;
    const quoteId = button.closest('[data-quote-id]')?.dataset.quoteId;
    if (!quoteId) return;
    setTimeout(() => ensureMessage(quoteId).catch((error) => console.warn('EDM quote inbox notification unavailable', error)), 100);
  }, true);
})();