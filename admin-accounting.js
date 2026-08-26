(() => {
  const mod = window.EDMAdminAccounting = {
    rows: [],
    payments: [],
    expenses: [],
    disbursements: [],

    async load() {
      const app = window.EDMAdmin;
      if (!app?.$('accountingTable')) return;
      const [invoiceResult, paymentResult, expenseResult, disbursementResult] = await Promise.all([
        app.db.from('invoices').select('id,invoice_number,status,title,total,disbursement_total,amount_paid,payment_method,issued_at,due_at,paid_at,created_at,user_id').order('created_at', { ascending: false }),
        app.db.from('payments').select('id,invoice_id,amount,payment_method,reference,paid_at,created_at').order('paid_at', { ascending: false }),
        app.db.from('purchases').select('id,supplier,category,amount,purchase_date,payment_method,proof_path,notes,created_at,purchase_mode').eq('purchase_mode', 'business_purchase').order('purchase_date', { ascending: false }),
        app.db.from('disbursements').select('id,amount,status,reimbursed_at,invoice_id').in('status', ['eligible', 'reimbursed']).order('created_at', { ascending: false })
      ]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (expenseResult.error) throw expenseResult.error;
      if (disbursementResult.error) throw disbursementResult.error;
      this.rows = invoiceResult.data || [];
      this.payments = paymentResult.data || [];
      this.disbursements = disbursementResult.data || [];
      this.expenses = (expenseResult.data || []).map((row) => ({
        ...row,
        description: row.supplier,
        expense_date: row.purchase_date,
        document_path: row.proof_path
      }));
      this.installExpenseUi();
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
      app.status('accountingStatus', `${this.rows.length} facture(s), ${this.disbursements.length} débours et ${this.expenses.length} dépense(s) chargés.`);
    },

    installExpenseUi() {
      const app = window.EDMAdmin;
      const page = app.$('accounting');
      if (!page || app.$('expensePanel')) return;
      const panel = document.createElement('div');
      panel.id = 'expensePanel';
      panel.className = 'card';
      panel.style.marginTop = '14px';
      panel.innerHTML = `<div class="top"><div><h2>Dépenses professionnelles</h2><p class="muted">Achats de pièces, consommables, outils, assurance, carburant et autres charges. Les débours client sont suivis séparément et ne doivent pas être enregistrés ici.</p></div><button id="newExpenseBtn" class="btn primary" type="button">Ajouter une dépense</button></div>
        <div id="expenseEditor" class="hidden" style="margin-top:12px">
          <div class="grid2">
            <label>Catégorie<select id="expenseCategory"><option value="pieces">Pièces</option><option value="consommables">Consommables</option><option value="outillage">Outillage</option><option value="assurance">Assurance</option><option value="carburant">Carburant</option><option value="local">Local</option><option value="telecom">Télécom</option><option value="comptabilite">Comptabilité</option><option value="autre">Autre</option></select></label>
            <label>Date<input id="expenseDate" type="date"></label>
            <label>Fournisseur / bénéficiaire<input id="expenseDescription" placeholder="Ex. Fournisseur pièces, assurance, carburant"></label>
            <label>Montant TTC<input id="expenseAmount" type="number" min="0.01" step="0.01"></label>
            <label>Mode de paiement<select id="expenseMethod"><option value="card">Carte</option><option value="transfer">Virement</option><option value="cash">Espèces</option><option value="check">Chèque</option><option value="direct_debit">Prélèvement</option></select></label>
            <label>Justificatif<input id="expenseDocument" type="file" accept="application/pdf,image/*"></label>
          </div>
          <label>Notes<textarea id="expenseNotes" rows="3"></textarea></label>
          <div class="toolbar"><button id="saveExpenseBtn" class="btn primary" type="button">Enregistrer</button><button id="cancelExpenseBtn" class="btn ghost" type="button">Annuler</button></div>
          <div id="expenseStatus" class="status hidden"></div>
        </div>
        <div id="expenseTable" style="margin-top:12px"></div>`;
      page.appendChild(panel);
      app.$('newExpenseBtn').onclick = () => {
        app.$('expenseEditor').classList.remove('hidden');
        app.$('expenseDate').value = new Date().toISOString().slice(0, 10);
      };
      app.$('cancelExpenseBtn').onclick = () => app.$('expenseEditor').classList.add('hidden');
      app.$('saveExpenseBtn').onclick = () => this.saveExpense();
    },

    async saveExpense() {
      const app = window.EDMAdmin;
      const button = app.$('saveExpenseBtn');
      const supplier = app.$('expenseDescription').value.trim();
      const amount = Number(app.$('expenseAmount').value || 0);
      const expenseDate = app.$('expenseDate').value;
      if (!supplier) return app.status('expenseStatus', 'Fournisseur ou bénéficiaire obligatoire.', true);
      if (!(amount > 0)) return app.status('expenseStatus', 'Montant positif obligatoire.', true);
      if (!expenseDate) return app.status('expenseStatus', 'Date obligatoire.', true);
      button.disabled = true;
      let documentPath = null;
      try {
        const file = app.$('expenseDocument').files?.[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) throw new Error('Le justificatif doit faire moins de 10 Mo.');
          const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
          documentPath = `${app.profile.id}/expenses/${expenseDate}-${Date.now()}.${ext}`;
          const upload = await app.db.storage.from('repair-documents').upload(documentPath, file, { contentType: file.type || 'application/octet-stream' });
          if (upload.error) throw upload.error;
        }
        const inserted = await app.db.from('purchases').insert({
          supplier,
          category: app.$('expenseCategory').value,
          amount,
          purchase_date: expenseDate,
          payment_method: app.$('expenseMethod').value,
          proof_path: documentPath,
          notes: app.$('expenseNotes').value.trim() || null,
          purchase_mode: 'business_purchase'
        }).select('id').single();
        if (inserted.error) throw inserted.error;
        app.$('expenseDescription').value = '';
        app.$('expenseAmount').value = '';
        app.$('expenseNotes').value = '';
        app.$('expenseDocument').value = '';
        app.$('expenseEditor').classList.add('hidden');
        app.status('expenseStatus', 'Dépense enregistrée.');
        await this.load();
      } catch (error) {
        if (documentPath) await app.db.storage.from('repair-documents').remove([documentPath]).catch(() => {});
        app.status('expenseStatus', error.message || 'Enregistrement impossible.', true);
      } finally { button.disabled = false; }
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
        const disbursement = Number(row.disbursement_total || 0);
        const paid = Number(row.amount_paid || 0);
        acc.billedServices += Math.max(0, total - disbursement);
        acc.paidGross += paid;
        acc.outstanding += Math.max(0, total - paid);
        if (this.state(row) === 'overdue') acc.overdue += Math.max(0, total - paid);
        return acc;
      }, { billedServices: 0, paidGross: 0, outstanding: 0, overdue: 0 });
      const expenseTotal = this.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const reimbursedDisbursements = this.disbursements.filter((row) => row.status === 'reimbursed').reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const cashMargin = totals.paidGross - reimbursedDisbursements - expenseTotal;

      app.$('accountingKpis').innerHTML = [
        ['Prestations facturées', totals.billedServices],
        ['Encaissé brut', totals.paidGross],
        ['Débours remboursés', reimbursedDisbursements],
        ['Dépenses', expenseTotal],
        ['Marge de trésorerie hors débours', cashMargin],
        ['À encaisser', totals.outstanding],
        ['Échu', totals.overdue]
      ].map(([label, value]) => `<article class="card kpi"><span>${app.esc(label)}</span><strong>${app.money(value)}</strong></article>`).join('');

      app.$('accountingTable').innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Facture</th><th>Date</th><th>Échéance</th><th>Statut</th><th>Total</th><th>Dont débours</th><th>Payé</th><th>Reste</th><th>Paiement</th></tr></thead><tbody>${rows.map((row) => {
        const total = Number(row.total || 0);
        const disbursement = Number(row.disbursement_total || 0);
        const paid = Number(row.amount_paid || 0);
        const state = this.state(row);
        const labels = { paid: 'Soldée', unpaid: 'À encaisser', overdue: 'Échue' };
        return `<tr><td>${app.esc(row.invoice_number || row.title || row.id)}</td><td>${this.date(row.issued_at || row.created_at)}</td><td>${this.date(row.due_at)}</td><td>${app.esc(labels[state])}</td><td>${app.money(total)}</td><td>${app.money(disbursement)}</td><td>${app.money(paid)}</td><td>${app.money(Math.max(0, total - paid))}</td><td>${app.esc(row.payment_method || '—')}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="status">Aucune facture pour ce filtre.</div>';

      const expenseHost = app.$('expenseTable');
      if (expenseHost) expenseHost.innerHTML = this.expenses.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Catégorie</th><th>Fournisseur / bénéficiaire</th><th>Montant</th><th>Paiement</th><th>Justificatif</th><th></th></tr></thead><tbody>${this.expenses.map((row) => `<tr><td>${this.date(row.expense_date)}</td><td>${app.esc(row.category)}</td><td>${app.esc(row.description)}</td><td>${app.money(row.amount)}</td><td>${app.esc(row.payment_method || '—')}</td><td>${row.document_path ? `<button class="btn ghost" data-open-expense="${app.esc(row.document_path)}">Ouvrir</button>` : '—'}</td><td><button class="btn ghost" data-delete-expense="${row.id}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune dépense enregistrée.</p>';
      expenseHost?.querySelectorAll('[data-open-expense]').forEach((button) => button.onclick = async () => {
        const { data, error } = await app.db.storage.from('repair-documents').createSignedUrl(button.dataset.openExpense, 120);
        if (error) return app.status('expenseStatus', error.message, true);
        window.open(data.signedUrl, '_blank', 'noopener');
      });
      expenseHost?.querySelectorAll('[data-delete-expense]').forEach((button) => button.onclick = async () => {
        const row = this.expenses.find((item) => item.id === button.dataset.deleteExpense);
        if (!row || !confirm('Supprimer cette dépense ?')) return;
        button.disabled = true;
        try {
          const removed = await app.db.from('purchases').delete().eq('id', row.id).select('id');
          if (removed.error) throw removed.error;
          if (row.document_path) await app.db.storage.from('repair-documents').remove([row.document_path]);
          await this.load();
        } catch (error) { app.status('expenseStatus', error.message || 'Suppression impossible.', true); }
        finally { button.disabled = false; }
      });
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
        ['TYPE', 'Référence', 'Date', 'Échéance', 'Statut/Catégorie', 'Montant', 'Dont débours', 'Payé', 'Reste', 'Mode de paiement', 'Description'],
        ...rows.map((row) => {
          const total = Number(row.total || 0);
          const disbursement = Number(row.disbursement_total || 0);
          const paid = Number(row.amount_paid || 0);
          return ['FACTURE', row.invoice_number || row.title || row.id, this.date(row.issued_at || row.created_at), this.date(row.due_at), this.state(row), total.toFixed(2), disbursement.toFixed(2), paid.toFixed(2), Math.max(0, total - paid).toFixed(2), row.payment_method || '', row.title || ''];
        }),
        ...this.expenses.map((row) => ['DÉPENSE', row.id, this.date(row.expense_date), '', row.category, Number(row.amount || 0).toFixed(2), '', '', '', row.payment_method || '', row.description || '']),
        ...this.disbursements.map((row) => ['DÉBOURS', row.id, this.date(row.reimbursed_at), '', row.status, Number(row.amount || 0).toFixed(2), Number(row.amount || 0).toFixed(2), row.status === 'reimbursed' ? Number(row.amount || 0).toFixed(2) : '', '', '', 'Remboursement exact hors prestations EDM'])
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