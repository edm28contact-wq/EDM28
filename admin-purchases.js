(() => {
  const A = () => window.EDMAdmin;
  const today = () => new Date().toISOString().slice(0, 10);
  const value = (root, name) => root.querySelector(`[data-field="${name}"]`)?.value?.trim() || '';
  const categories = [
    ['part','Pièce'],['consumable','Consommable'],['tooling','Outillage'],['fuel','Carburant'],
    ['travel','Déplacement'],['insurance','Assurance'],['rent','Local'],['software','Logiciel'],
    ['bank_fee','Frais bancaire'],['subcontracting','Sous-traitance'],['other','Autre']
  ];
  const expenseCategories = categories.filter(([key]) => key !== 'part').concat([['cfe','CFE'],['tax','Impôt / taxe']]);
  const paymentMethods = [['card','Carte'],['cash','Espèces'],['bank_transfer','Virement'],['check','Chèque'],['other','Autre']];
  const optionList = (rows, selected = '') => rows.map(([key,label]) => `<option value="${key}"${selected === key ? ' selected' : ''}>${A().esc(label)}</option>`).join('');

  const mod = {
    suppliers: [], purchases: [], expenses: [],

    async load() {
      if (!A()?.$('supplierList')) return;
      const [suppliers, purchases, expenses] = await Promise.all([
        A().db.from('suppliers').select('*').order('name'),
        A().db.from('admin_purchase_register').select('*').order('purchase_date', { ascending: false }),
        A().db.from('business_expenses').select('*,suppliers(name)').order('expense_date', { ascending: false }).limit(200)
      ]);
      if (suppliers.error) throw suppliers.error;
      if (purchases.error) throw purchases.error;
      if (expenses.error) throw expenses.error;
      this.suppliers = suppliers.data || [];
      this.purchases = purchases.data || [];
      this.expenses = expenses.data || [];
      this.renderSuppliers();
      this.renderPurchases();
      this.renderExpenses();
      this.bindForms();
    },

    supplierOptions() {
      return `<option value="">Choisir…</option>${this.suppliers.filter((s) => s.active).map((s) => `<option value="${s.id}">${A().esc(s.name)}</option>`).join('')}`;
    },

    renderSuppliers() {
      A().$('supplierForm').innerHTML = `<div class="grid2">
        <label class="field"><span>Nom *</span><input data-field="name"></label>
        <label class="field"><span>Contact</span><input data-field="contact_name"></label>
        <label class="field"><span>Email</span><input data-field="email" type="email"></label>
        <label class="field"><span>Téléphone</span><input data-field="phone"></label>
        <label class="field"><span>N° TVA</span><input data-field="vat_number"></label>
        <label class="field"><span>Adresse</span><textarea data-field="address"></textarea></label>
      </div><label class="field"><span>Notes</span><textarea data-field="notes"></textarea></label>
      <button class="btn primary" data-save-supplier>Enregistrer le fournisseur</button>`;
      A().$('supplierList').innerHTML = this.suppliers.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Fournisseur</th><th>Contact</th><th>Email</th><th>Téléphone</th><th>État</th></tr></thead><tbody>${this.suppliers.map((s) => `<tr><td>${A().esc(s.name)}</td><td>${A().esc(s.contact_name || '—')}</td><td>${A().esc(s.email || '—')}</td><td>${A().esc(s.phone || '—')}</td><td>${s.active ? 'Actif' : 'Inactif'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun fournisseur.</p>';
    },

    purchaseLine(index = 0) {
      return `<div class="card compact" data-purchase-line><div class="grid2">
        <label class="field"><span>Catégorie *</span><select data-field="category">${optionList(categories,'part')}</select></label>
        <label class="field"><span>Description *</span><input data-field="description"></label>
        <label class="field"><span>Quantité *</span><input data-field="quantity" type="number" min="0.01" step="0.01" value="1"></label>
        <label class="field"><span>Coût unitaire *</span><input data-field="unit_cost" type="number" min="0" step="0.01"></label>
        <label class="field"><span>Référence pièce</span><input data-field="part_reference"></label>
        <label class="field"><span>Référence fournisseur</span><input data-field="supplier_reference"></label>
      </div>${index ? '<button type="button" class="btn danger" data-remove-purchase-line>Supprimer cette ligne</button>' : ''}</div>`;
    },

    renderPurchases() {
      A().$('purchaseForm').innerHTML = `<div class="grid2">
        <label class="field"><span>Fournisseur *</span><select data-field="supplier_id">${this.supplierOptions()}</select></label>
        <label class="field"><span>N° facture / achat *</span><input data-field="purchase_number"></label>
        <label class="field"><span>Date achat *</span><input data-field="purchase_date" type="date" value="${today()}"></label>
        <label class="field"><span>Date facture</span><input data-field="invoice_date" type="date"></label>
        <label class="field"><span>Statut</span><select data-field="status"><option value="draft">Brouillon</option><option value="validated">Validé</option><option value="paid">Payé</option></select></label>
        <label class="field"><span>Paiement</span><select data-field="payment_method"><option value="">Choisir…</option>${optionList(paymentMethods)}</select></label>
        <label class="field"><span>Chemin facture fournisseur *</span><input data-field="document_path" placeholder="repair-documents/.../facture-fournisseur.pdf"></label>
        <label class="field"><span>Payé le</span><input data-field="paid_at" type="datetime-local"></label>
      </div><label class="field"><span>Notes</span><textarea data-field="notes"></textarea></label>
      <h3>Lignes d’achat</h3><div data-purchase-lines>${this.purchaseLine()}</div>
      <div class="toolbar"><button type="button" class="btn ghost" data-add-purchase-line>Ajouter une ligne</button><button class="btn primary" data-save-purchase>Enregistrer l’achat</button></div>`;
      A().$('purchaseList').innerHTML = this.purchases.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>N°</th><th>Fournisseur</th><th>Statut</th><th>Lignes</th><th>Total</th><th>Justificatif</th></tr></thead><tbody>${this.purchases.map((p) => `<tr><td>${A().esc(p.purchase_date || '—')}</td><td>${A().esc(p.purchase_number || 'Brouillon')}</td><td>${A().esc(p.supplier_name || '—')}</td><td>${A().esc(p.status)}</td><td>${Number(p.item_count || 0)}</td><td>${A().money(p.item_total || p.total)}</td><td>${p.document_path ? 'Présent' : 'Manquant'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun achat validé.</p>';
    },

    renderExpenses() {
      A().$('expenseForm').innerHTML = `<div class="grid2">
        <label class="field"><span>Catégorie *</span><select data-field="category">${optionList(expenseCategories,'consumable')}</select></label>
        <label class="field"><span>Fournisseur</span><select data-field="supplier_id">${this.supplierOptions()}</select></label>
        <label class="field"><span>Description *</span><input data-field="description"></label>
        <label class="field"><span>Montant *</span><input data-field="amount" type="number" min="0.01" step="0.01"></label>
        <label class="field"><span>Date *</span><input data-field="expense_date" type="date" value="${today()}"></label>
        <label class="field"><span>Paiement</span><select data-field="payment_method"><option value="">Choisir…</option>${optionList(paymentMethods)}</select></label>
        <label class="field"><span>Chemin justificatif</span><input data-field="document_path"></label>
        <label class="field"><span>Notes</span><textarea data-field="notes"></textarea></label>
      </div><button class="btn primary" data-save-expense>Enregistrer la dépense</button>`;
      A().$('expenseList').innerHTML = this.expenses.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Fournisseur</th><th>Montant</th><th>Justificatif</th></tr></thead><tbody>${this.expenses.map((e) => `<tr><td>${A().esc(e.expense_date)}</td><td>${A().esc(e.category)}</td><td>${A().esc(e.description)}</td><td>${A().esc(e.suppliers?.name || '—')}</td><td>${A().money(e.amount)}</td><td>${e.document_path ? 'Présent' : 'Manquant'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune dépense.</p>';
    },

    bindForms() {
      A().$('supplierForm').querySelector('[data-save-supplier]').onclick = () => this.saveSupplier();
      A().$('purchaseForm').querySelector('[data-add-purchase-line]').onclick = () => {
        const host = A().$('purchaseForm').querySelector('[data-purchase-lines]');
        host.insertAdjacentHTML('beforeend', this.purchaseLine(host.children.length));
        host.querySelectorAll('[data-remove-purchase-line]').forEach((button) => button.onclick = () => button.closest('[data-purchase-line]').remove());
      };
      A().$('purchaseForm').querySelector('[data-save-purchase]').onclick = () => this.savePurchase();
      A().$('expenseForm').querySelector('[data-save-expense]').onclick = () => this.saveExpense();
    },

    async saveSupplier() {
      const root = A().$('supplierForm');
      const name = value(root,'name');
      if (!name) return A().status('purchasesStatus','Nom fournisseur obligatoire.',true);
      const payload = { name, contact_name:value(root,'contact_name'), email:value(root,'email'), phone:value(root,'phone'), address:value(root,'address'), vat_number:value(root,'vat_number'), notes:value(root,'notes'), active:true };
      const { error } = await A().db.rpc('admin_save_supplier', { p_supplier: payload });
      if (error) return A().status('purchasesStatus',error.message,true);
      A().status('purchasesStatus','Fournisseur enregistré.');
      await this.load();
    },

    async savePurchase() {
      const root = A().$('purchaseForm');
      const status = value(root,'status');
      const payload = {
        supplier_id:value(root,'supplier_id'), purchase_number:value(root,'purchase_number'), purchase_date:value(root,'purchase_date'),
        invoice_date:value(root,'invoice_date'), status, payment_method:value(root,'payment_method'), document_path:value(root,'document_path'),
        paid_at:value(root,'paid_at') ? new Date(value(root,'paid_at')).toISOString() : '', notes:value(root,'notes')
      };
      if (!payload.purchase_date) return A().status('purchasesStatus','Date d’achat obligatoire.',true);
      if (status !== 'draft' && (!payload.supplier_id || !payload.purchase_number || !payload.document_path)) return A().status('purchasesStatus','Fournisseur, numéro et facture fournisseur obligatoires pour valider.',true);
      const items = [...root.querySelectorAll('[data-purchase-line]')].map((line) => ({
        category:value(line,'category'), description:value(line,'description'), quantity:Number(value(line,'quantity') || 0), unit_cost:Number(value(line,'unit_cost') || -1),
        part_reference:value(line,'part_reference'), supplier_reference:value(line,'supplier_reference')
      }));
      if (items.some((item) => !item.description || !(item.quantity > 0) || item.unit_cost < 0)) return A().status('purchasesStatus','Chaque ligne doit avoir une description, une quantité et un coût valides.',true);
      const { error } = await A().db.rpc('admin_save_purchase', { p_purchase:payload, p_items:items });
      if (error) return A().status('purchasesStatus',error.message,true);
      A().status('purchasesStatus','Achat enregistré.');
      await this.load();
    },

    async saveExpense() {
      const root = A().$('expenseForm');
      const payload = { category:value(root,'category'), supplier_id:value(root,'supplier_id'), description:value(root,'description'), amount:Number(value(root,'amount') || 0), expense_date:value(root,'expense_date'), payment_method:value(root,'payment_method'), document_path:value(root,'document_path'), notes:value(root,'notes') };
      if (!payload.description || !(payload.amount > 0) || !payload.expense_date) return A().status('purchasesStatus','Description, montant et date obligatoires.',true);
      const { error } = await A().db.rpc('admin_save_expense', { p_expense:payload });
      if (error) return A().status('purchasesStatus',error.message,true);
      A().status('purchasesStatus','Dépense enregistrée.');
      await this.load();
    }
  };

  window.EDMAdminPurchases = mod;
})();