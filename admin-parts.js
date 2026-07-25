(() => {
  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  const modes = [['resale','Revente EDM28'],['customer_supplied','Pièce fournie par le client'],['disbursement','Débours strict']];

  const mod = {
    documents: [], items: [], selectedType: 'quote', selectedId: '',

    async load() {
      if (!A()?.$('partsDocument')) return;
      const config = A().backofficeConfiguration || await A().loadBackofficeConfiguration();
      if (config?.enabled_modules?.parts === false) throw new Error('Module pièces désactivé dans Gestion.');
      const [quotes,invoices] = await Promise.all([
        A().db.from('quotes').select('id,quote_number,title,status,total,created_at').eq('status','draft').order('created_at',{ascending:false}),
        A().db.from('invoices').select('id,invoice_number,title,status,total,created_at').eq('status','draft').order('created_at',{ascending:false})
      ]);
      if (quotes.error) throw quotes.error;
      if (invoices.error) throw invoices.error;
      this.documents = [
        ...(quotes.data || []).map((row) => ({...row,type:'quote',number:row.quote_number})),
        ...(invoices.data || []).map((row) => ({...row,type:'invoice',number:row.invoice_number}))
      ];
      this.renderSelector();
      if (!this.selectedId && this.documents.length) {
        this.selectedType = this.documents[0].type;
        this.selectedId = this.documents[0].id;
      }
      await this.loadItems();
    },

    renderSelector() {
      const options = this.documents.map((doc) => `<option value="${doc.type}:${doc.id}"${doc.id === this.selectedId && doc.type === this.selectedType ? ' selected' : ''}>${doc.type === 'quote' ? 'Devis' : 'Facture'} · ${A().esc(doc.number || doc.title || doc.id)} · ${A().money(doc.total)}</option>`).join('');
      A().$('partsDocument').innerHTML = `<label class="field"><span>Document brouillon</span><select data-parts-document><option value="">Choisir…</option>${options}</select></label>`;
      A().$('partsDocument').querySelector('[data-parts-document]').onchange = async (event) => {
        const [type,id] = event.target.value.split(':');
        this.selectedType = type || 'quote'; this.selectedId = id || '';
        await this.loadItems();
      };
    },

    async loadItems() {
      if (!this.selectedId) {
        A().$('partsList').innerHTML = '<p class="muted">Aucun devis ou facture brouillon.</p>';
        A().$('partsEditor').innerHTML = '';
        return;
      }
      const table = this.selectedType === 'quote' ? 'quote_items' : 'invoice_items';
      const foreign = this.selectedType === 'quote' ? 'quote_id' : 'invoice_id';
      const { data,error } = await A().db.from(table).select('*').eq(foreign,this.selectedId).in('item_type',['part','disbursement']).order('display_order');
      if (error) throw error;
      this.items = data || [];
      this.renderList();
      this.renderEditor();
    },

    renderList() {
      A().$('partsList').innerHTML = this.items.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Mode</th><th>Description</th><th>Qté</th><th>Vente / remboursement</th><th>Coût</th><th>Marge</th><th>Justificatifs</th><th></th></tr></thead><tbody>${this.items.map((item) => {
        const sale = n(item.quantity) * n(item.unit_price);
        const margin = item.part_handling_mode === 'resale' ? sale - n(item.purchase_total) : 0;
        const docs = [item.supplier_document_path,item.customer_mandate_path].filter(Boolean).length;
        return `<tr><td>${A().esc(item.part_handling_mode || '—')}</td><td>${A().esc(item.description)}</td><td>${n(item.quantity).toLocaleString('fr-FR')}</td><td>${A().money(sale)}</td><td>${A().money(item.purchase_total)}</td><td>${A().money(margin)}</td><td>${docs}/2</td><td><div class="toolbar"><button class="btn ghost" data-edit-part="${item.id}">Modifier</button><button class="btn danger" data-delete-part="${item.id}">Supprimer</button></div></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted">Aucune ligne de pièce.</p>';
      A().$('partsList').querySelectorAll('[data-edit-part]').forEach((button) => button.onclick = () => this.renderEditor(this.items.find((item) => item.id === button.dataset.editPart)));
      A().$('partsList').querySelectorAll('[data-delete-part]').forEach((button) => button.onclick = () => this.remove(button.dataset.deletePart));
    },

    allowedModes() {
      const c = A().backofficeConfiguration || {};
      return modes.filter(([mode]) => (mode === 'resale' && c.allow_part_resale) || (mode === 'customer_supplied' && c.allow_customer_supplied_parts) || (mode === 'disbursement' && c.allow_disbursements));
    },

    renderEditor(item = null) {
      const config = A().backofficeConfiguration || {};
      const defaultMode = item?.part_handling_mode || config.part_default_mode || 'resale';
      const modeOptions = this.allowedModes().map(([key,label]) => `<option value="${key}"${defaultMode === key ? ' selected' : ''}>${A().esc(label)}</option>`).join('');
      A().$('partsEditor').innerHTML = `<div class="card"><div class="top"><div><h3>${item ? 'Modifier' : 'Ajouter'} une ligne de pièce</h3><p class="muted">Les fichiers sont stockés dans le coffre privé Supabase.</p></div>${item ? '<button class="btn ghost" data-new-part>Nouvelle ligne</button>' : ''}</div>
        <div class="grid2">
          <label class="field"><span>Mode *</span><select data-part="part_handling_mode">${modeOptions}</select></label>
          <label class="field"><span>Description *</span><input data-part="description" value="${A().esc(item?.description || '')}"></label>
          <label class="field"><span>Quantité *</span><input data-part="quantity" type="number" min="0.01" step="0.01" value="${n(item?.quantity || 1)}"></label>
          <label class="field"><span>Prix facturé / remboursé *</span><input data-part="unit_price" type="number" min="0" step="0.01" value="${n(item?.unit_price)}"></label>
          <label class="field" data-resale-disbursement><span>Coût d’achat total *</span><input data-part="purchase_total" type="number" min="0" step="0.01" value="${item?.purchase_total ?? ''}"></label>
          <label class="field"><span>Référence pièce</span><input data-part="supplier_reference" value="${A().esc(item?.supplier_reference || '')}"></label>
          <label class="field" data-resale><span>Référence achat EDM28 *</span><input data-part="business_purchase_reference" value="${A().esc(item?.business_purchase_reference || '')}"></label>
          <label class="field" data-disbursement><span>Référence mandat client *</span><input data-part="customer_mandate_reference" value="${A().esc(item?.customer_mandate_reference || '')}"></label>
          <label class="field"><span>Taux de TVA (%)</span><input data-part="vat_rate" type="number" min="0" max="100" step="0.01" value="${item?.vat_rate ?? ''}"></label>
          <label class="field" data-resale-disbursement><span>Facture fournisseur *</span><input data-file="supplier" type="file" accept="application/pdf,image/*"><small>${A().esc(item?.supplier_document_path || 'Aucun fichier')}</small></label>
          <label class="field" data-disbursement><span>Mandat signé *</span><input data-file="mandate" type="file" accept="application/pdf,image/*"><small>${A().esc(item?.customer_mandate_path || 'Aucun fichier')}</small></label>
        </div>
        <div data-part-warning class="status"></div>
        <button class="btn primary" data-save-part>${item ? 'Enregistrer les modifications' : 'Ajouter la ligne'}</button>
      </div>`;
      const root = A().$('partsEditor');
      root.querySelector('[data-new-part]')?.addEventListener('click', () => this.renderEditor());
      root.querySelector('[data-part="part_handling_mode"]').addEventListener('change', () => this.syncMode(root));
      root.querySelector('[data-save-part]').addEventListener('click', () => this.save(item,root));
      this.syncMode(root);
    },

    syncMode(root) {
      const mode = root.querySelector('[data-part="part_handling_mode"]').value;
      root.querySelectorAll('[data-resale]').forEach((node) => node.classList.toggle('hidden',mode !== 'resale'));
      root.querySelectorAll('[data-disbursement]').forEach((node) => node.classList.toggle('hidden',mode !== 'disbursement'));
      root.querySelectorAll('[data-resale-disbursement]').forEach((node) => node.classList.toggle('hidden',mode === 'customer_supplied'));
      const price = root.querySelector('[data-part="unit_price"]');
      const purchase = root.querySelector('[data-part="purchase_total"]');
      if (mode === 'customer_supplied') { price.value='0'; price.disabled=true; if (purchase) purchase.value='0'; }
      else price.disabled=false;
      const text = mode === 'resale' ? 'Revente : facture fournisseur au nom d’EDM28, coût et référence d’achat obligatoires.' : mode === 'customer_supplied' ? 'Pièce client : prix de pièce obligatoirement égal à 0 €.' : 'Débours : facture au nom du client, mandat signé, justificatif et remboursement exact sans marge.';
      root.querySelector('[data-part-warning]').textContent = text;
    },

    async upload(file,kind) {
      if (!file) return null;
      const extension = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi,'').toLowerCase();
      const path = `admin/${A().profile.id}/parts/${this.selectedType}/${this.selectedId}/${crypto.randomUUID()}-${kind}.${extension}`;
      const { error } = await A().db.storage.from('repair-documents').upload(path,file,{contentType:file.type || 'application/octet-stream',upsert:false});
      if (error) throw error;
      return path;
    },

    async save(item,root) {
      const get = (key) => root.querySelector(`[data-part="${key}"]`)?.value?.trim() || '';
      const mode = get('part_handling_mode');
      const quantity = n(get('quantity'));
      const unitPrice = n(get('unit_price'));
      const purchaseTotal = get('purchase_total') === '' ? null : n(get('purchase_total'));
      const description = get('description');
      if (!description || !(quantity > 0) || unitPrice < 0) return A().status('partsStatus','Description, quantité et prix valides obligatoires.',true);
      if (mode === 'customer_supplied' && (unitPrice !== 0 || n(purchaseTotal) !== 0)) return A().status('partsStatus','Une pièce client doit rester à 0 €.',true);
      if (mode === 'disbursement' && purchaseTotal !== quantity * unitPrice) return A().status('partsStatus','Le débours doit être remboursé au centime exact, sans marge.',true);
      const supplierFile = root.querySelector('[data-file="supplier"]').files[0];
      const mandateFile = root.querySelector('[data-file="mandate"]')?.files[0];
      const supplierPath = supplierFile ? await this.upload(supplierFile,'supplier') : item?.supplier_document_path || '';
      const mandatePath = mandateFile ? await this.upload(mandateFile,'mandate') : item?.customer_mandate_path || '';
      const payload = {
        part_handling_mode:mode, description, quantity, unit_price:unitPrice, purchase_total:purchaseTotal,
        supplier_invoice_holder:mode === 'resale' ? 'business' : mode === 'disbursement' ? 'customer' : '',
        customer_mandate_reference:get('customer_mandate_reference'), customer_mandate_path:mandatePath,
        supplier_document_path:supplierPath, business_purchase_reference:get('business_purchase_reference'),
        supplier_reference:get('supplier_reference'), vat_rate:get('vat_rate'), display_order:item?.display_order || this.items.length
      };
      if (this.selectedType === 'invoice' && mode === 'resale' && (!purchaseTotal && purchaseTotal !== 0 || !payload.business_purchase_reference || !supplierPath)) return A().status('partsStatus','Coût, référence d’achat et facture fournisseur obligatoires.',true);
      if (mode === 'disbursement' && (!payload.customer_mandate_reference || !mandatePath || !supplierPath)) return A().status('partsStatus','Mandat, référence du mandat et facture fournisseur client obligatoires.',true);
      const { error } = await A().db.rpc('admin_save_document_item',{ p_document_type:this.selectedType, p_document_id:this.selectedId, p_item_id:item?.id || null, p_payload:payload });
      if (error) return A().status('partsStatus',error.message,true);
      A().status('partsStatus','Ligne enregistrée et document recalculé.');
      await this.loadItems();
      window.EDMAdminAccounting?.load();
    },

    async remove(id) {
      if (!confirm('Supprimer cette ligne de pièce ?')) return;
      const { error } = await A().db.rpc('admin_delete_document_item',{ p_document_type:this.selectedType, p_document_id:this.selectedId, p_item_id:id });
      if (error) return A().status('partsStatus',error.message,true);
      A().status('partsStatus','Ligne supprimée.');
      await this.loadItems();
    }
  };

  window.EDMAdminParts = mod;
})();