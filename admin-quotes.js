(() => {
  const app = () => window.EDMAdmin;
  const currentDate = () => new Date().toISOString().slice(0, 10);
  const n = (v) => Number(v || 0);

  function defaultItems(q) {
    if (!window.EDMSupplierBasketPolicy) throw new Error('Rechargez le module de prestations.');
    return window.EDMSupplierBasketPolicy.defaultItems(q);
  }

  function newLine() {
    return { item_type: 'labor', designation: 'Prestation', description: 'Consommables d\u2019atelier inclus, hors pi\u00e8ces.', quantity: 1, unit_price: 0, vat_rate: 0, purchase_total: 0 };
  }

  function lineHtml(item = {}, locked = false) {
    const d = locked ? ' disabled' : '';
    return `<div class="card" data-quote-line style="padding:12px;margin:10px 0">
      <div class="grid2">
        <label>Type<select data-line="type"${d}><option value="labor" ${item.item_type==='labor'?'selected':''}>Prestation (consommables inclus)</option>${locked || item.item_type==='part' ? `<option value="part" ${item.item_type==='part'?'selected':''}>Pi\u00e8ce - ancien document</option>` : ''}${locked ? `<option value="delivery" ${item.item_type==='delivery'?'selected':''}>Livraison - ancien document</option>` : ''}<option value="other" ${!['labor','part','delivery'].includes(item.item_type)?'selected':''}>Autre</option></select></label>
        <label${locked ? '' : ' hidden'}>Référence du document<input data-line="reference" value="${app().esc(item.supplier_reference || '')}"${d}></label>
        <label>Désignation<input data-line="designation" value="${app().esc(item.designation || item.description || '')}"${d}></label>
        <label>Description<input data-line="description" value="${app().esc(item.description || '')}"${d}></label>
        <label>Quantité<input data-line="quantity" type="number" min="0.01" step="0.01" value="${n(item.quantity) || 1}"${d}></label>
        <label>Tarif par prestation HT<input data-line="unit_price" type="number" min="0" step="0.01" value="${n(item.unit_price)}"${d}></label>
        <label>TVA %<input data-line="vat_rate" type="number" min="0" max="100" step="0.1" value="${n(item.vat_rate)}"${d}></label>
        <input data-line="purchase_total" type="hidden" value="${locked ? n(item.purchase_total) : 0}">
      </div>
      <div class="top"><span class="muted" data-line-total></span>${locked ? '' : '<button type="button" class="btn ghost" data-remove-line>Supprimer</button>'}</div>
    </div>`;
  }

  function readLines(root) {
    return [...root.querySelectorAll('[data-quote-line]')].map((line, index) => {
      const quantity = n(line.querySelector('[data-line="quantity"]').value);
      const unitPrice = n(line.querySelector('[data-line="unit_price"]').value);
      const vatRate = n(line.querySelector('[data-line="vat_rate"]').value);
      return {
        item_type: line.querySelector('[data-line="type"]').value,
        supplier_reference: line.querySelector('[data-line="reference"]').value.trim() || null,
        designation: line.querySelector('[data-line="designation"]').value.trim() || null,
        description: line.querySelector('[data-line="description"]').value.trim() || line.querySelector('[data-line="designation"]').value.trim() || 'Ligne de devis',
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        purchase_total: n(line.querySelector('[data-line="purchase_total"]').value),
        total: quantity * unitPrice,
        display_order: index
      };
    }).filter((x) => x.quantity > 0 && x.unit_price >= 0);
  }

  function recalculate(root) {
    const items = readLines(root);
    const subtotal = items.reduce((s, x) => s + x.total, 0);
    const vat = items.reduce((s, x) => s + x.total * x.vat_rate / 100, 0);
    const gross = subtotal + vat;
    const discount = Math.max(0, n(root.querySelector('[data-field="discount"]')?.value));
    const total = Math.max(0, gross - discount);
    root.querySelector('[data-field="subtotal"]').value = subtotal.toFixed(2);
    root.querySelector('[data-field="vatTotal"]').value = vat.toFixed(2);
    root.querySelector('[data-field="total"]').value = total.toFixed(2);
    const display = root.querySelector('[data-total-display]');
    if (display) display.textContent = app().money(total);
    root.querySelectorAll('[data-quote-line]').forEach((line) => {
      const q = n(line.querySelector('[data-line="quantity"]').value);
      const p = n(line.querySelector('[data-line="unit_price"]').value);
      const rate = n(line.querySelector('[data-line="vat_rate"]').value);
      line.querySelector('[data-line-total]').textContent = `Total TTC ligne : ${app().money(q * p * (1 + rate / 100))}`;
    });
  }

  async function save(id, publish) {
    const root = document.querySelector(`[data-quote-id="${id}"]`);
    const workflow = window.EDMAdminSupplierBasket;
    if (!workflow) throw new Error('Rechargez le module de panier fournisseur.');
    if (publish) return workflow.publish(root.querySelector('[data-publish]'));
    return workflow.saveDraft(root);
  }

  function bindEditor(root, locked) {
    if (locked) return;
    const lines = root.querySelector('[data-lines]');
    root.querySelectorAll('[data-add-line]').forEach((button) => {
      button.onclick = () => {
        lines.insertAdjacentHTML('beforeend', lineHtml(newLine(button.dataset.addLine), false));
        bindEditor(root, false);
        recalculate(root);
      };
    });
    root.querySelectorAll('[data-remove-line]').forEach((b) => b.onclick = () => { b.closest('[data-quote-line]').remove(); recalculate(root); });
    root.querySelectorAll('[data-line],[data-field="discount"]').forEach((input) => input.oninput = () => recalculate(root));
    recalculate(root);
  }

  function render(rows) {
    const host = app().$('quoteList');
    host.innerHTML = rows.length ? rows.map((q) => {
      const draft = q.status === 'draft';
      const locked = draft ? '' : ' disabled';
      const clientName = [q.profiles?.first_name, q.profiles?.last_name].filter(Boolean).join(' ') || q.profiles?.email || 'Client';
      const vehicle = [q.vehicles?.brand, q.vehicles?.model, q.vehicles?.year, q.vehicles?.plate].filter(Boolean).join(' · ') || 'Véhicule';
      const services = Array.isArray(q.service_requests?.services) ? q.service_requests.services : [];
      const serviceNames = services.map((s) => s.name || s.id).join(' · ');
      const brakeCombo = false;
      const items = q.quote_items?.length ? q.quote_items : defaultItems(q);
      const actions = draft ? `<div class="toolbar"><button class="btn ghost" data-save="${q.id}">Enregistrer</button><button class="btn primary" data-publish="${q.id}">Envoyer devis + panier</button></div>` : '<p class="muted">Devis verrouillé après publication.</p>';
      return `<article class="card" data-quote-id="${q.id}" data-brake-combo="${brakeCombo}" style="margin:12px 0">
        <div class="top"><div><span class="pill">${app().esc(q.status)}</span><h3>${app().esc(q.quote_number || 'Nouveau devis')}</h3></div><strong data-total-display>${app().money(q.total)}</strong></div>
        <div class="grid2">
          <div><h4>Client</h4><p><strong>${app().esc(clientName)}</strong><br>${app().esc(q.profiles?.phone || 'Téléphone non renseigné')}<br>${app().esc(q.profiles?.email || '')}</p></div>
          <div><h4>Véhicule</h4><p><strong>${app().esc(vehicle)}</strong><br>${app().esc(q.vehicles?.energy || 'Énergie non renseignée')} · ${app().esc(q.vehicles?.mileage || 'Kilométrage non renseigné')} km</p></div>
        </div>
        <p><strong>Demande :</strong> ${app().esc(serviceNames || q.service_requests?.notes || 'Non renseignée')}</p>
        <div class="grid2">
          <label>Titre<input data-field="title" value="${app().esc(q.title || 'Devis EDM28')}"${locked}></label>
          <label>Numéro<input data-field="number" placeholder="Généré automatiquement" value="${app().esc(q.quote_number || '')}"${locked}></label>
        </div>
        <label>Description<textarea data-field="description" rows="3"${locked}>${app().esc(q.description || '')}</textarea></label>
        ${window.EDMAdminSupplierBasket?.editor(q) || ''}
        <h4>Prestations facturées par EDM28</h4>
        <div data-lines>${items.map((item) => lineHtml(item, !draft)).join('')}</div>
        ${draft ? '<div class="toolbar"><button type="button" class="btn ghost" data-add-line="labor">Ajouter une prestation</button></div>' : ''}
        <div class="grid2" style="margin-top:12px">
          <label>Total HT<input data-field="subtotal" readonly value="${n(q.subtotal).toFixed(2)}"></label>
          <label>TVA<input data-field="vatTotal" readonly value="0.00"></label>
          <label>Remise (€)<input data-field="discount" type="number" min="0" step="0.01" value="${n(q.discount).toFixed(2)}"${locked}></label>
          <label>Total TTC après remise<input data-field="total" readonly value="${n(q.total).toFixed(2)}"></label>
          <label>Valable jusqu’au<input data-field="validUntil" type="date" value="${app().esc(q.valid_until || '')}"${locked}></label>
        </div>${actions}
      </article>`;
    }).join('') : '<p class="muted">Aucun devis.</p>';
    rows.forEach((q) => bindEditor(host.querySelector(`[data-quote-id="${q.id}"]`), q.status !== 'draft'));
    host.querySelectorAll('[data-save],[data-publish]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { if (button.dataset.publish) { await save(button.dataset.publish, true); return; } await save(button.dataset.save, false); app().status('quoteStatus', 'Devis et panier enregistrés. Le PDF sera généré avant envoi.'); await load(); await app().overview(); }
      catch (error) { app().status('quoteStatus', error.message || 'Opération impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = app()?.$('quoteList'); if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('quotes').select('id,commercial_model,quote_parts_baskets(requires_parts,supplier_url,recommended_parts,revision),status,title,description,quote_number,subtotal,discount,total,valid_until,visible_to_client,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),service_requests(notes,services,totals,selected_basket),quote_items(id,item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,purchase_total,total,display_order)').in('status', ['draft','sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function appendScripts(sources) { return sources.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => { if (document.querySelector(`script[src^="${src.split('?')[0]}"]`)) return resolve(); const script = document.createElement('script'); script.src = src; script.async = false; script.onload = resolve; script.onerror = reject; document.body.appendChild(script); })), Promise.resolve()); }
  function addModule({ id, label, title, description, refreshId, statusId, listId, scripts, before }) { const nav=document.querySelector('.nav'); const dashboard=document.getElementById('dashboard'); if(!nav||!dashboard||document.getElementById(id)) return; const button=document.createElement('button'); button.className='btn ghost'; button.dataset.page=id; button.textContent=label; nav.insertBefore(button,nav.querySelector(`[data-page="${before}"]`)); const section=document.createElement('section'); section.id=id; section.className='page'; section.innerHTML=`<div class="card"><div class="top"><div><h2>${title}</h2><p class="muted">${description}</p></div><button id="${refreshId}" class="btn ghost">Actualiser</button></div><div id="${statusId}" class="status hidden"></div><div id="${listId}"></div></div>`; dashboard.appendChild(section); button.addEventListener('click',()=>app().page(id)); appendScripts(scripts).catch((e)=>app().status(statusId,e.message||'Module indisponible.',true)); }
  function bootstrapModules() { addModule({id:'operations',label:'Atelier',title:'Préparation atelier',description:'Planifier les devis acceptés et préparer l’ordre de réparation associé.',refreshId:'operationRefresh',statusId:'operationStatus',listId:'operationList',scripts:['/admin-operations.js?v=3'],before:'clients'}); addModule({id:'interventions',label:'Interventions',title:'Dossiers intervention',description:'Dossier unique, fiche de contrôle mobile, photos et avancement atelier.',refreshId:'interventionRefresh',statusId:'interventionStatus',listId:'interventionList',scripts:['/admin-interventions.js?v=2'],before:'clients'}); addModule({id:'finalization',label:'Clôture',title:'Clôture et facturation',description:'Clôturer les interventions terminées et générer une facture brouillon contrôlée.',refreshId:'finalizationRefresh',statusId:'finalizationStatus',listId:'finalizationList',scripts:['/admin-finalization.js?v=2'],before:'clients'}); addModule({id:'invoice-actions',label:'Encaissement',title:'Émission et règlements',description:'Émettre les factures brouillon puis enregistrer les paiements reçus.',refreshId:'invoiceActionRefresh',statusId:'invoiceActionStatus',listId:'invoiceActionList',scripts:['/admin-invoice-actions.js?v=1'],before:'clients'}); addModule({id:'message-templates',label:'Messages',title:'Modèles de messages',description:'Modifier les messages de confirmation, devis, rendez-vous, véhicule prêt, facture et relance.',refreshId:'messageTemplateRefresh',statusId:'messageTemplateStatus',listId:'messageTemplateList',scripts:['/admin-message-templates.js?v=1'],before:'clients'}); addModule({id:'document-pdf',label:'PDF',title:'Documents PDF',description:'Générer et stocker les devis, ordres de réparation, contrôles et factures dans le coffre privé.',refreshId:'documentPdfRefresh',statusId:'documentPdfStatus',listId:'documentPdfList',scripts:['/pdf-lite.js?v=1','/admin-document-pdf.js?v=2'],before:'clients'}); addModule({id:'audit-log',label:'Journal',title:'Journal des opérations',description:'Consulter les changements métier enregistrés automatiquement.',refreshId:'auditLogRefresh',statusId:'auditLogStatus',listId:'auditLogList',scripts:['/admin-audit-log.js?v=1'],before:'clients'}); }
  function bind() { bootstrapModules(); document.querySelector('[data-page="quotes"]')?.addEventListener('click',()=>load().catch((error)=>app().status('quoteStatus',error.message||'Devis indisponibles.',true))); document.getElementById('quoteRefresh')?.addEventListener('click',()=>load().catch((error)=>app().status('quoteStatus',error.message||'Actualisation impossible.',true))); }
  window.EDMAdminQuotes={load}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();