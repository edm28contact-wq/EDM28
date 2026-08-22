(() => {
  if (window.__edmInterventionOrderPublishInstalled) return;
  window.__edmInterventionOrderPublishInstalled = true;

  const A = () => window.EDMAdmin;
  let pendingOrderId = '';
  let publishing = false;

  async function publishOrder(orderId) {
    if (!orderId || publishing || !A()?.db) return;
    publishing = true;
    try {
      const current = await A().db.from('repair_orders')
        .select('id,user_id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,pdf_path,visible_to_client,mileage_in,visible_condition,customer_items,authorized_work')
        .eq('id', orderId)
        .maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) throw new Error('Ordre de réparation introuvable.');
      if (!['completed','invoiced'].includes(current.data.status)) return;

      let pdfPath = current.data.pdf_path || '';
      if (!pdfPath) {
        pdfPath = await window.EDMAdminDocumentPdf?.generateFor('order', current.data);
        if (!pdfPath) throw new Error('Le PDF de l’ordre de réparation n’a pas pu être généré.');
      }

      const visible = await A().db.from('repair_orders')
        .update({ visible_to_client: true, pdf_path: pdfPath, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .in('status', ['completed','invoiced'])
        .select('id');
      if (visible.error || !visible.data?.length) throw visible.error || new Error('Publication de l’OR impossible.');

      A().status('interventionStatus', `Intervention terminée. L’OR ${current.data.order_number || ''} est publié au client avec son PDF.`);
    } catch (error) {
      A()?.status('interventionStatus', `Intervention enregistrée, mais publication de l’OR impossible : ${error.message || error}`, true);
    } finally {
      publishing = false;
      pendingOrderId = '';
    }
  }

  function install() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-complete-report]');
      if (!button) return;
      pendingOrderId = button.closest('[data-order]')?.dataset.order || '';
    }, true);

    const status = document.getElementById('interventionStatus');
    if (!status) return;
    const observer = new MutationObserver(() => {
      if (!pendingOrderId || publishing || status.classList.contains('error')) return;
      const text = String(status.textContent || '');
      if (/Contrôle terminé|intervention terminée/i.test(text)) {
        window.setTimeout(() => publishOrder(pendingOrderId), 0);
      }
    });
    observer.observe(status, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();