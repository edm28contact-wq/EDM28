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
      if (invoiceResult.error) throw invoiceResult.error;
      if (paymentResult.error) throw paymentResult.error;
      this.rows = invoiceResult.data || [];
      this.payments = paymentResult.data || [];
      const filter = app.$('accountingFilter');
      const exportButton = app.$('accountingExport');
      if (filter && !filter.dataset.ready) {
        filter.dataset.ready = '1';
        filter.addEventListener('change', () => this.render());
      }
      if (exportButton && !exportButton.dataset.ready) {
        exportButton.dataset.ready = '1';
        exportButton.addEventListener('click', () => this.exportCsv());
      }
      this.render();
      app.status('accountingStatus', `${this.rows.length} facture(s) chargée(s).`);
    },

    state(row) {
      const total = Number(row.total || 0);
      const paid = Number(row.amount_paid || 0);
      if (row.status === 'paid' || paid >= total) return 'paid';
      if (row.due_at && new Date(row.due_at) < new Date()) return 'overdue';
      return 'unpaid';
    },

    filteredRows() {
      const selected = window.EDMAdmin?.$('accountingFilter')?.value || 'all';
      return selected === 'all' ? this.rows : this.rows.filter((row) => this.state(row) === selected);
    },

    render() {
      const app = window.EDMAdmin;
      if (!app) return;
      const rows = this.filteredRows();
      const totals = this.rows.reduce((acc, row) => {
        const total = Number(row.total || 0);
        const paid = Number(row.amount_paid || 0);
        acc.billed += total;
        acc.paid += paid;
        acc.outstanding += Math.max(0, total - paid);
        if (this.state(row) === 'overdue') acc.overdue += Math.max(0, total - paid);
        return acc;
      }, { billed: 0, paid: 0, outstanding: 0, overdue: 0 });

      app.$('accountingKpis').innerHTML = [
        ['Facturé', totals.billed],
        ['Encaissé', totals.paid],
        ['À encaisser', totals.outstanding],
        ['Échu', totals.overdue]
      ].map(([label, value]) => `<article class="card kpi"><span>${app.esc(label)}</span><strong>${app.money(value)}</strong></article>`).join('');

      if (!rows.length) {
        app.$('accountingTable').innerHTML = '<div class="status">Aucune facture pour ce filtre.</div>';
        return;
      }
      app.$('accountingTable').innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Facture</th><th>Date</th><th>Échéance</th><th>Statut</th><th>Total</th><th>Payé</th><th>Reste</th><th>Paiement</th></tr></thead><tbody>${rows.map((row) => {
        const total = Number(row.total || 0);
        const paid = Number(row.amount_paid || 0);
        const state = this.state(row);
        const labels = { paid: 'Soldée', unpaid: 'À encaisser', overdue: 'Échue' };
        return `<tr><td>${app.esc(row.invoice_number || row.title || row.id)}</td><td>${this.date(row.issued_at || row.created_at)}</td><td>${this.date(row.due_at)}</td><td>${app.esc(labels[state])}</td><td>${app.money(total)}</td><td>${app.money(paid)}</td><td>${app.money(Math.max(0, total - paid))}</td><td>${app.esc(row.payment_method || '—')}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    },

    date(value) {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
    },

    exportCsv() {
      const rows = this.filteredRows();
      const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['Facture', 'Date', 'Échéance', 'Statut', 'Total', 'Payé', 'Reste', 'Mode de paiement'],
        ...rows.map((row) => {
          const total = Number(row.total || 0);
          const paid = Number(row.amount_paid || 0);
          return [row.invoice_number || row.title || row.id, this.date(row.issued_at || row.created_at), this.date(row.due_at), this.state(row), total.toFixed(2), paid.toFixed(2), Math.max(0, total - paid).toFixed(2), row.payment_method || ''];
        })
      ];
      const csv = '\uFEFF' + lines.map((line) => line.map(quote).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `edm28-comptabilite-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };
})();
