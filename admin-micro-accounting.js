(() => {
  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  const date = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';
  const datetimeLocal = () => new Date().toISOString().slice(0, 16);
  const feature = (key) => Boolean(A().backofficeConfiguration?.accounting_features?.[key]);

  const mod = {
    revenue: [], purchases: [], margins: [], jobs: [], cashflow: [], expenses: [], parameters: {}, obligations: [], cashSession: null, cashEntries: [],

    async load() {
      if (!A()?.$('microAccountingHost')) return;
      const queries = [
        A().db.from('admin_revenue_book').select('*').order('paid_at', { ascending: false }),
        A().db.from('admin_purchase_register').select('*').order('purchase_date', { ascending: false }),
        A().db.from('admin_part_margins').select('*').order('issued_at', { ascending: false }),
        A().db.from('admin_job_management_margin').select('*').order('issued_at', { ascending: false }),
        A().db.from('admin_cashflow').select('*').order('occurred_at', { ascending: false }),
        A().db.from('business_expenses').select('*').order('expense_date', { ascending: false }),
        A().db.from('accounting_parameters').select('*').eq('id', true).single(),
        A().db.from('tax_obligations').select('*').order('due_date'),
        A().db.from('cash_register_sessions').select('*').eq('status','open').maybeSingle()
      ];
      const results = await Promise.all(queries);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      [this.revenue,this.purchases,this.margins,this.jobs,this.cashflow,this.expenses] = results.slice(0,6).map((r) => r.data || []);
      this.parameters = results[6].data || {};
      this.obligations = results[7].data || [];
      this.cashSession = results[8].data || null;
      if (this.cashSession) {
        const entries = await A().db.from('cash_register_entries').select('*').eq('session_id', this.cashSession.id).order('occurred_at');
        if (entries.error) throw entries.error;
        this.cashEntries = entries.data || [];
      } else this.cashEntries = [];
      this.render();
    },

    totals() {
      const ca = this.revenue.reduce((sum,row) => sum + n(row.ca_collected),0);
      const sales = this.revenue.reduce((sum,row) => sum + n(row.sales_collected),0);
      const services = this.revenue.reduce((sum,row) => sum + n(row.service_collected),0);
      const disbursements = this.revenue.reduce((sum,row) => sum + n(row.disbursement_collected),0);
      const expenses = this.expenses.reduce((sum,row) => sum + n(row.amount),0) + this.purchases.reduce((sum,row) => sum + n(row.total),0);
      const cashIn = this.cashflow.filter((r) => r.direction === 'in').reduce((sum,row) => sum + n(row.amount),0);
      const cashOut = this.cashflow.filter((r) => r.direction === 'out').reduce((sum,row) => sum + n(row.amount),0);
      return { ca,sales,services,disbursements,expenses,cashIn,cashOut,balance:cashIn-cashOut };
    },

    reserve() {
      const totals = this.totals();
      const serviceRate = n(this.parameters.social_rate_services) + (A().backofficeConfiguration?.liberatory_tax_enabled ? n(this.parameters.liberatory_rate_services) : 0) + n(this.parameters.reserve_extra_rate);
      const salesRate = n(this.parameters.social_rate_sales) + (A().backofficeConfiguration?.liberatory_tax_enabled ? n(this.parameters.liberatory_rate_sales) : 0) + n(this.parameters.reserve_extra_rate);
      return (totals.services * serviceRate / 100) + (totals.sales * salesRate / 100);
    },

    render() {
      const totals = this.totals();
      const panels = [];
      panels.push(`<div class="grid"><article class="card kpi"><span>CA encaissé</span><strong>${A().money(totals.ca)}</strong></article><article class="card kpi"><span>Ventes encaissées</span><strong>${A().money(totals.sales)}</strong></article><article class="card kpi"><span>Prestations encaissées</span><strong>${A().money(totals.services)}</strong></article><article class="card kpi"><span>Débours remboursés</span><strong>${A().money(totals.disbursements)}</strong></article><article class="card kpi"><span>Dépenses réelles</span><strong>${A().money(totals.expenses)}</strong></article><article class="card kpi"><span>Trésorerie calculée</span><strong>${A().money(totals.balance)}</strong></article></div>`);
      panels.push(this.renderParameters());
      if (feature('revenue_book')) panels.push(this.renderRevenue());
      if (feature('purchase_register')) panels.push(this.renderPurchaseRegister());
      if (feature('expenses')) panels.push(this.renderExpenses());
      if (feature('urssaf_preparation') || feature('tax_reserve') || feature('cfe_tracking') || feature('vat_tracking')) panels.push(this.renderObligations());
      if (feature('part_margin')) panels.push(this.renderMargins());
      if (feature('job_profitability')) panels.push(this.renderJobs());
      if (feature('cashflow')) panels.push(this.renderCashflow());
      if (feature('cash_register')) panels.push(this.renderCashRegister());
      if (feature('annual_archive')) panels.push('<section class="card"><h3>Archivage annuel</h3><p class="muted">Utilise les exports CSV de chaque registre et conserve les PDF et justificatifs dans le stockage privé. L’export consolidé annuel sera généré après validation des paramètres comptables.</p></section>');
      A().$('microAccountingHost').innerHTML = panels.join('');
      this.bind();
    },

    renderParameters() {
      const p = this.parameters;
      return `<section class="card"><div class="top"><div><h3>Paramètres comptables</h3><p class="muted">Aucun taux n’est codé en dur. Renseigne les taux applicables à ta situation.</p></div><button class="btn primary" data-save-accounting-parameters>Enregistrer</button></div><div class="grid2">
        ${this.numberField('social_rate_services','Cotisations prestations (%)',p.social_rate_services)}
        ${this.numberField('social_rate_sales','Cotisations ventes (%)',p.social_rate_sales)}
        ${this.numberField('liberatory_rate_services','Versement libératoire prestations (%)',p.liberatory_rate_services)}
        ${this.numberField('liberatory_rate_sales','Versement libératoire ventes (%)',p.liberatory_rate_sales)}
        ${this.numberField('reserve_extra_rate','Marge de sécurité supplémentaire (%)',p.reserve_extra_rate)}
        ${this.numberField('default_vat_rate','TVA par défaut (%)',p.default_vat_rate)}
        ${this.numberField('cfe_expected_amount','CFE prévue (€)',p.cfe_expected_amount)}
        <label class="field"><span>Échéance CFE</span><input data-accounting-parameter="cfe_due_date" type="date" value="${A().esc(p.cfe_due_date || '')}"></label>
      </div><div class="status">Réserve estimée actuelle : <b>${A().money(this.reserve())}</b>. Cet indicateur sert au pilotage, pas à établir une déclaration officielle.</div></section>`;
    },

    numberField(key,label,value) { return `<label class="field"><span>${A().esc(label)}</span><input data-accounting-parameter="${key}" type="number" min="0" max="1000000" step="0.01" value="${value ?? ''}"></label>`; },

    renderRevenue() {
      return `<section class="card"><div class="top"><div><h3>Livre des recettes</h3><p class="muted">Chronologie des encaissements réels. Les débours sont isolés du CA de pilotage.</p></div><button class="btn ghost" data-export="revenue">Exporter CSV</button></div>${this.revenue.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Facture</th><th>Paiement</th><th>Montant</th><th>Prestations</th><th>Ventes</th><th>Débours</th><th>CA</th></tr></thead><tbody>${this.revenue.map((r) => `<tr><td>${date(r.collection_date)}</td><td>${A().esc(r.invoice_number || r.invoice_id)}</td><td>${A().esc(r.payment_method || '—')}</td><td>${A().money(r.amount)}</td><td>${A().money(r.service_collected)}</td><td>${A().money(r.sales_collected)}</td><td>${A().money(r.disbursement_collected)}</td><td>${A().money(r.ca_collected)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun encaissement.</p>'}</section>`;
    },

    renderPurchaseRegister() {
      return `<section class="card"><div class="top"><h3>Registre des achats</h3><button class="btn ghost" data-export="purchases">Exporter CSV</button></div>${this.purchases.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>N°</th><th>Fournisseur</th><th>Statut</th><th>Total</th><th>Justificatif</th></tr></thead><tbody>${this.purchases.map((r) => `<tr><td>${date(r.purchase_date)}</td><td>${A().esc(r.purchase_number)}</td><td>${A().esc(r.supplier_name || '—')}</td><td>${A().esc(r.status)}</td><td>${A().money(r.total)}</td><td>${r.document_path ? 'Présent' : 'Manquant'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun achat validé.</p>'}</section>`;
    },

    renderExpenses() {
      const byCategory = Object.entries(this.expenses.reduce((acc,row) => { acc[row.category] = (acc[row.category] || 0) + n(row.amount); return acc; },{}));
      return `<section class="card"><div class="top"><h3>Dépenses réelles</h3><button class="btn ghost" data-export="expenses">Exporter CSV</button></div>${byCategory.length ? `<div class="grid">${byCategory.map(([category,total]) => `<article class="card compact"><span>${A().esc(category)}</span><strong>${A().money(total)}</strong></article>`).join('')}</div>` : '<p class="muted">Aucune dépense.</p>'}</section>`;
    },

    renderObligations() {
      return `<section class="card"><div class="top"><div><h3>Urssaf, CFE, TVA et obligations</h3><p class="muted">Préparation interne avec validation humaine obligatoire.</p></div><button class="btn primary" data-add-obligation>Ajouter une échéance</button></div><div data-obligation-form class="hidden"></div>${this.obligations.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Type</th><th>Libellé</th><th>Période</th><th>Échéance</th><th>Prévu</th><th>Payé</th><th>Statut</th></tr></thead><tbody>${this.obligations.map((o) => `<tr><td>${A().esc(o.obligation_type)}</td><td>${A().esc(o.label)}</td><td>${date(o.period_start)} – ${date(o.period_end)}</td><td>${date(o.due_date)}</td><td>${A().money(o.expected_amount)}</td><td>${A().money(o.paid_amount)}</td><td>${A().esc(o.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune échéance enregistrée.</p>'}</section>`;
    },

    renderMargins() {
      const total = this.margins.reduce((sum,row) => sum + n(row.margin_amount),0);
      return `<section class="card"><h3>Marge sur les pièces</h3><div class="status">Marge de gestion cumulée : <b>${A().money(total)}</b></div>${this.margins.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Facture</th><th>Pièce</th><th>Vente</th><th>Coût</th><th>Marge</th><th>Taux</th></tr></thead><tbody>${this.margins.map((r) => `<tr><td>${A().esc(r.invoice_number || r.invoice_id)}</td><td>${A().esc(r.description)}</td><td>${A().money(n(r.quantity)*n(r.unit_price))}</td><td>${A().money(r.purchase_total)}</td><td>${A().money(r.margin_amount)}</td><td>${n(r.margin_rate).toLocaleString('fr-FR')} %</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune pièce revendue complète.</p>'}</section>`;
    },

    renderJobs() {
      return `<section class="card"><h3>Rentabilité par intervention</h3><p class="muted">Indicateur de gestion : facture moins débours et coût d’achat des pièces. Ce n’est pas un bénéfice fiscal.</p>${this.jobs.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Facture</th><th>Total</th><th>Débours</th><th>Coût pièces</th><th>Marge de gestion</th></tr></thead><tbody>${this.jobs.map((r) => `<tr><td>${A().esc(r.invoice_number || r.invoice_id)}</td><td>${A().money(r.total)}</td><td>${A().money(r.disbursements)}</td><td>${A().money(r.part_purchase_cost)}</td><td>${A().money(r.management_margin)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune intervention facturée.</p>'}</section>`;
    },

    renderCashflow() {
      const t = this.totals();
      return `<section class="card"><h3>Trésorerie</h3><div class="grid"><article class="card compact"><span>Entrées</span><strong>${A().money(t.cashIn)}</strong></article><article class="card compact"><span>Sorties</span><strong>${A().money(t.cashOut)}</strong></article><article class="card compact"><span>Solde calculé</span><strong>${A().money(t.balance)}</strong></article></div></section>`;
    },

    renderCashRegister() {
      if (!this.cashSession) return `<section class="card"><h3>Caisse espèces</h3><div class="toolbar"><input data-cash-opening type="number" min="0" step="0.01" placeholder="Fond de caisse"><input data-cash-note placeholder="Note"><button class="btn primary" data-open-cash>Ouvrir la caisse</button></div></section>`;
      const movements = this.cashEntries.reduce((sum,row) => sum + (row.direction === 'in' ? n(row.amount) : -n(row.amount)),0);
      const expected = n(this.cashSession.opening_balance) + movements;
      return `<section class="card"><h3>Caisse ouverte depuis le ${date(this.cashSession.opened_at)}</h3><div class="grid"><article class="card compact"><span>Fond initial</span><strong>${A().money(this.cashSession.opening_balance)}</strong></article><article class="card compact"><span>Mouvements</span><strong>${A().money(movements)}</strong></article><article class="card compact"><span>Solde attendu</span><strong>${A().money(expected)}</strong></article></div><div class="toolbar"><select data-cash-direction><option value="in">Entrée</option><option value="out">Sortie</option></select><input data-cash-amount type="number" min="0.01" step="0.01" placeholder="Montant"><input data-cash-reference placeholder="Référence"><button class="btn ghost" data-cash-adjust>Ajouter le mouvement</button></div><div class="toolbar"><input data-cash-actual type="number" min="0" step="0.01" placeholder="Solde réellement compté"><input data-cash-close-note placeholder="Note de clôture"><button class="btn danger" data-close-cash>Clôturer la caisse</button></div></section>`;
    },

    bind() {
      document.querySelector('[data-save-accounting-parameters]')?.addEventListener('click', () => this.saveParameters());
      document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => this.export(button.dataset.export)));
      document.querySelector('[data-add-obligation]')?.addEventListener('click', () => this.showObligationForm());
      document.querySelector('[data-open-cash]')?.addEventListener('click', () => this.openCash());
      document.querySelector('[data-cash-adjust]')?.addEventListener('click', () => this.adjustCash());
      document.querySelector('[data-close-cash]')?.addEventListener('click', () => this.closeCash());
    },

    async saveParameters() {
      const payload = { updated_by:A().profile.id, updated_at:new Date().toISOString() };
      document.querySelectorAll('[data-accounting-parameter]').forEach((node) => { payload[node.dataset.accountingParameter] = node.value === '' ? null : (node.type === 'number' ? Number(node.value) : node.value); });
      const { error } = await A().db.from('accounting_parameters').update(payload).eq('id',true);
      if (error) return A().status('microAccountingStatus',error.message,true);
      A().status('microAccountingStatus','Paramètres comptables enregistrés.');
      await this.load();
    },

    showObligationForm() {
      const host = document.querySelector('[data-obligation-form]');
      host.classList.remove('hidden');
      host.innerHTML = `<div class="grid2"><label class="field"><span>Type *</span><select data-o="obligation_type"><option value="urssaf">Urssaf</option><option value="cfe">CFE</option><option value="vat">TVA</option><option value="income_tax">Impôt sur le revenu</option><option value="other">Autre</option></select></label><label class="field"><span>Libellé *</span><input data-o="label"></label><label class="field"><span>Début période</span><input data-o="period_start" type="date"></label><label class="field"><span>Fin période</span><input data-o="period_end" type="date"></label><label class="field"><span>Échéance</span><input data-o="due_date" type="date"></label><label class="field"><span>Montant prévu</span><input data-o="expected_amount" type="number" min="0" step="0.01"></label></div><button class="btn primary" data-save-obligation>Enregistrer</button>`;
      host.querySelector('[data-save-obligation]').onclick = () => this.saveObligation(host);
    },

    async saveObligation(root) {
      const get = (key) => root.querySelector(`[data-o="${key}"]`).value.trim();
      const payload = { obligation_type:get('obligation_type'), label:get('label'), period_start:get('period_start') || null, period_end:get('period_end') || null, due_date:get('due_date') || null, expected_amount:get('expected_amount') ? Number(get('expected_amount')) : null, created_by:A().profile.id };
      if (!payload.label) return A().status('microAccountingStatus','Libellé obligatoire.',true);
      const { error } = await A().db.from('tax_obligations').insert(payload);
      if (error) return A().status('microAccountingStatus',error.message,true);
      A().status('microAccountingStatus','Échéance enregistrée.');
      await this.load();
    },

    async openCash() {
      const opening = Number(document.querySelector('[data-cash-opening]').value || 0);
      const note = document.querySelector('[data-cash-note]').value.trim();
      const { error } = await A().db.rpc('admin_open_cash_session',{ p_opening_balance:opening, p_notes:note || null });
      if (error) return A().status('microAccountingStatus',error.message,true);
      A().status('microAccountingStatus','Caisse ouverte.');
      await this.load();
    },

    async adjustCash() {
      const direction = document.querySelector('[data-cash-direction]').value;
      const amount = Number(document.querySelector('[data-cash-amount]').value || 0);
      const reference = document.querySelector('[data-cash-reference]').value.trim();
      const { error } = await A().db.rpc('admin_record_cash_adjustment',{ p_session_id:this.cashSession.id, p_direction:direction, p_amount:amount, p_reference:reference || null, p_notes:null });
      if (error) return A().status('microAccountingStatus',error.message,true);
      A().status('microAccountingStatus','Mouvement de caisse enregistré.');
      await this.load();
    },

    async closeCash() {
      const actual = Number(document.querySelector('[data-cash-actual]').value || -1);
      const note = document.querySelector('[data-cash-close-note]').value.trim();
      const { error } = await A().db.rpc('admin_close_cash_session',{ p_session_id:this.cashSession.id, p_actual_balance:actual, p_notes:note || null });
      if (error) return A().status('microAccountingStatus',error.message,true);
      A().status('microAccountingStatus','Caisse clôturée.');
      await this.load();
    },

    export(kind) {
      const maps = {
        revenue:[['Date','Facture','Paiement','Montant','Prestations','Ventes','Débours','CA'],this.revenue.map((r) => [r.collection_date,r.invoice_number,r.payment_method,r.amount,r.service_collected,r.sales_collected,r.disbursement_collected,r.ca_collected])],
        purchases:[['Date','Numéro','Fournisseur','Statut','Total','Justificatif'],this.purchases.map((r) => [r.purchase_date,r.purchase_number,r.supplier_name,r.status,r.total,r.document_path])],
        expenses:[['Date','Catégorie','Description','Montant','Paiement','Justificatif'],this.expenses.map((r) => [r.expense_date,r.category,r.description,r.amount,r.payment_method,r.document_path])]
      };
      const [headers,rows] = maps[kind];
      const quote = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;
      const csv = '\uFEFF' + [headers,...rows].map((row) => row.map(quote).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a'); link.href=url; link.download=`edm28-${kind}-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    }
  };

  window.EDMAdminMicroAccounting = mod;
})();