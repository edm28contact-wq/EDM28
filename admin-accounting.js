(() => {
  const mod = window.EDMAdminAccounting = {
    rows: [],
    payments: [],

    async load() {
      const app = window.EDMAdmin;
      if (!app?.$('accountingTable')) return;
      const [invoiceResult, paymentResult] = await Promise.all([
        app.db.from('invoices').select('id,invoice_number,status,title,total,amount_paid,payment_method,issued_at,due_at,paid_at,created_at,user_id').order('created_at', { ascending: false }),
        app.db.from('payments').select('id,invoice_id,amount,payment_method,reference,paid_at,created_at').order('paid_at', { ascending: false })
      ]);
      if (invoiceResult.error) return app.status('accountingStatus', invoiceResult.error.message, true);
      if (paymentResult.error) return app