(() => {
  if (window.__edmInspectionPdfInstalled) return;
  window.__edmInspectionPdfInstalled = true;

  const A = () => window.EDMAdmin;
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function completedReport(orderId) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = await A().db.from('inspection_reports')
        .select('id,user_id,repair_order_id,report_number,status,mileage,technician_name,customer_request,vehicle_snapshot,customer_snapshot,checks,observations,photo_paths,signature_path,completed_at,pdf_path,created_at')
        .eq('repair_order_id', orderId)
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data?.status === 'completed') return result.data;
      await wait(250);
    }
    return null;
  }

  async function generateAfterCompletion(button) {
    const orderId = button.closest('[data-order]')?.dataset.order;
    if (!orderId || !A()?.profile) return;
    const report = await completedReport(orderId);
    if (!report) return;

    try {
      A().status('interventionStatus', 'Contrôle terminé. Génération du PDF EDM28 prérempli…');
      const pdfPath = await window.EDMAdminDocumentPdf?.generateFor('inspection', report);
      if (!pdfPath) throw new Error('Le modèle PDF de la fiche de contrôle n’a pas pu être généré.');
      const published = await A().db.from('inspection_reports')
        .update({ visible_to_client: true, pdf_path: pdfPath, updated_at: new Date().toISOString() })
        .eq('id', report.id)
        .eq('status', 'completed')
        .select('id');
      if (published.error || !published.data?.length) throw published.error || new Error('La fiche a changé pendant sa publication.');
      A().status('interventionStatus', 'Fiche de contrôle préremplie, PDF généré et publiée dans l’espace client.');
    } catch (error) {
      await A().db.from('inspection_reports')
        .update({ visible_to_client: false, updated_at: new Date().toISOString() })
        .eq('id', report.id)
        .eq('status', 'completed');
      A().status('interventionStatus', `Fiche terminée mais non publiée : ${error.message || 'PDF impossible.'}`, true);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-complete-report]');
    if (!button) return;
    generateAfterCompletion(button).catch((error) => A()?.status('interventionStatus', error.message || 'Publication de la fiche impossible.', true));
  });
})();