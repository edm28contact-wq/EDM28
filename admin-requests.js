(() => {
  const labels = { draft: 'Brouillon', submitted: 'Reçue', reviewed: 'Étudiée', quoted: 'Devis créé', confirmed: 'Confirmée', cancelled: 'Annulée' };
  const A = () => window.EDMAdmin;
  const fmt = (v) => v ? new Date(v).toLocaleString('fr-FR') : '-';
  const total = (r) => Number(r?.totals?.totalAllMin ?? r?.totals?.laborAfter ?? 0);
  const maxTotal = (r) => Number(r?.totals?.totalAllMax ?? total(r));

  async function updateStatus(id, status) {
    if (!['reviewed', 'cancelled'].includes(status)) return;
    const { error } = await A().db.from('service_requests').update({ status }).eq('id', id).in('status', ['submitted',