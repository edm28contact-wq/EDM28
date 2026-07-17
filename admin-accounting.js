(() => {
  const mod = window.EDMAdminAccounting = {
    rows: [],
    async load() {
      const app = window.EDMAdmin;
      if (!app?.$('accountingTable')) return;
      const { data, error } = await app.db.from('invoices').select('id,invoice_number,status,title,total,amount_paid,payment_method,issued_at,due_at,paid_at,created_at,user_id').order('created_at', { ascending: false });
      if (error) return app.status('accountingStatus', error.message, true);
      this.rows = data || [];
      this.render();
      app.$('accountingFilter').onchange = () => this.render();
      app.$('accountingExport').onclick = () => this.exportCsv();
    },
    filtered() {
      const app = window.EDMAdmin;
      const filter = app.$('accountingFilter')?.value || 'all';
      const now = Date.now();
      return this.rows.filter((r) => {
        const due = r.due_at ? new Date(r.due_at).getTime() : null;
        const remaining = Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0));
        if (filter === 'paid') return remaining === 0 && Number(r.total || 0) > 0;
        if (filter === 'unpaid') return remaining > 0;
        if (filter === 'overdue') return remaining > 0 && due && due < now;
        return true;
      });
    },
    render() {
      const app = window.EDMAdmin;
      const rows = this.filtered();
      const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
      const paid = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
      const due = Math.max(0, total - paid);
      app.$('accountingKpis').innerHTML = `<article class="card kpi"><span>Facturé</span><strong>${app.money(total)}</strong></article><article class="card kpi"><span>Encaissé</span><strong>${app.money(paid)}</strong></article><article class="card kpi"><span>Restant dû</span><strong>${app.money(due)}</strong></article>`;
      app.$('accountingTable').innerHTML = rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Facture</th><th>Statut</th><th>Total</th><th>Payé</th><th>Reste</th><th>Échéance</th><th>Action</th></tr></thead><tbody>${rows.map((r) => {
        const remaining = Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0));
        return `<tr><td>${app.esc(r.invoice_number || r.title || 'Brouillon')}</td><td>${app.esc(r.status)}</td><td>${app.money(r.total)}</td><td>${app.money(r.amount_paid)}</td><td>${app.money(remaining)}</td><td>${r.due_at ? new Date(r.due_at).toLocaleDateString('fr-FR') : '-'}</td><td>${remaining > 0 ? `<button class="btn success" data-pay="${r.id}">Enregistrer paiement</button>` : '<span class="pill">Soldée</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted">Aucune facture pour ce filtre.</p>';
      document.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => this.recordPayment(b.dataset.pay));
    },
    async recordPayment(id) {
      const app = window.EDMAdmin;
      const row = this.rows.find((r) => r.id === id);
      if (!row) return;
      const remaining = Math.max(0, Number(row.total || 0) - Number(row.amount_paid || 0));
      const raw = prompt(`Montant reçu, maximum ${remaining.toFixed(2)} €`, remaining.toFixed(2));
      if (raw === null) return;
      const amount = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) return alert('Montant de paiement invalide.');
      const paid = Number(row.amount_paid || 0) + amount;
      const status = paid >= Number(row.total || 0) ? 'paid' : 'partially_paid';
      const { error } = await app.db.from('invoices').update({ amount_paid: paid, status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', id);
      if (error) return app.status('accountingStatus', error.message, true);
      app.status('accountingStatus', 'Paiement enregistré.');
      await this.load();
    },
    exportCsv() {
      const rows = this.filtered();
      const header = ['Facture','Statut','Total','Paye','Reste','Echeance'];
      const data = rows.map((r) => [r.invoice_number || '', r.status || '', Number(r.total || 0).toFixed(2), Number(r.amount_paid || 0).toFixed(2), Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0)).toFixed(2), r.due_at || '']);
      const csv = [header, ...data].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `edm28-comptabilite-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    }
  };
})();