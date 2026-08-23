(() => {
  if (window.__edmOrderMessageNotifyInstalled) return;
  window.__edmOrderMessageNotifyInstalled = true;

  const A = () => window.EDMAdmin;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function findOrder(orderId, quoteId) {
    const admin = A();
    if (!admin?.db) return null;
    let query = admin.db.from('repair_orders')
      .select('id,user_id,service_request_id,quote_id,order_number,status,visible_to_client,pdf_path,updated_at');
    if (orderId) query = query.eq('id', orderId);
    else if (quoteId) query = query.eq('quote_id', quoteId).order('created_at', { ascending:false }).limit(1);
    else return null;
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function ensureMessage({ orderId = '', quoteId = '' }) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const admin = A();
      if (!admin?.db) return;
      const order = await findOrder(orderId, quoteId);
      if (!order) {
        await sleep(500);
        continue;
      }

      if (order.visible_to_client === true && order.pdf_path) {
        const subject = `Ordre de réparation ${order.order_number || 'EDM28'} disponible`;
        const existing = await admin.db.from('client_messages')
          .select('id')
          .eq('user_id', order.user_id)
          .eq('service_request_id', order.service_request_id)
          .eq('subject', subject)
          .limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.length) return;

        const sent = await admin.db.rpc('admin_send_message', {
          p_user_id: order.user_id,
          p_body: `Votre ordre de réparation ${order.order_number || 'EDM28'} est disponible dans votre espace client. Vous pouvez le consulter dans le suivi de votre demande et dans votre historique de documents.`,
          p_service_request_id: order.service_request_id,
          p_subject: subject,
          p_ai_draft_id: null
        });
        if (sent.error) throw sent.error;
        return;
      }

      if (!['ready', 'signed', 'in_progress', 'completed', 'invoiced'].includes(order.status)) return;
      await sleep(500);
    }
  }

  document.addEventListener('click', (event) => {
    const ready = event.target.closest?.('[data-publish-ready]');
    const prepare = event.target.closest?.('[data-prepare]');
    if (!ready && !prepare) return;
    const target = ready
      ? { orderId: ready.dataset.publishReady || '' }
      : { quoteId: prepare.dataset.prepare || '' };
    window.setTimeout(() => ensureMessage(target).catch((error) => console.warn('EDM OR inbox notification unavailable', error)), 100);
  }, true);
})();
