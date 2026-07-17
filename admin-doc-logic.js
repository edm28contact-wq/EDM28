(() => {
  const timer = setInterval(() => {
    const app = window.EDMAdmin;
    const btn = document.getElementById('createDraftBtn');
    const subtotal = document.getElementById('docSubtotal');
    if (!app || !btn || !subtotal) return;
    clearInterval(timer);
    btn.onclick = async () => {
      const userId = app.$('docClient').value;
      const vehicleId = app.$('docVehicle').value || null;
      const type = app.$('docType').value;
      const description = app.$('docDescription').value.trim();
      const sub = Number(subtotal.value || 0);
      const discount = Number(app.$('docDiscount').value || 0);
      const total = Math.max(0, sub - discount);
      const dueDate = app.$('docDueDate').value || null;
      const mileage = Number(app.$('docMileage').value || 0) || null;
      app.markRequired(app.$('docClient'), !userId);
      app.markRequired(app.$('docDescription'), !description);
      app.markRequired(subtotal, sub <= 0);
      if (!userId || !description || sub <= 0) return app.status('docStatus', 'Client, description et sous-total obligatoires.', true);
      const title = type === 'quote' ? 'Projet de devis' : type === 'invoice' ? 'Projet de facture' : 'Projet d’ordre de réparation';
      const { error } = await app.db.from('ai_drafts').insert({
        user_id: userId,
        vehicle_id: vehicleId,
        document_type: type,
        status: 'draft',
        source_snapshot: { source: 'admin', description, due_date: dueDate, mileage },
        draft_payload: { title, description, subtotal: sub, discount, total, due_date: dueDate, mileage, lines: [], validation_required: true }
      });
      if (error) return app.status('docStatus', error.message, true);
      app.status('docStatus', 'Brouillon structuré créé. Validation humaine obligatoire.');
      await window.EDMAdminDocs.list();
    };
  }, 100);
})();