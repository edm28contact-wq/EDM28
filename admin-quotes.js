(() => {
  const app = () => window.EDMAdmin;
  const currentDate = () => new Date().toISOString().slice(0, 10);
  const n = (v) => Number(v || 0);

  function serviceRange(service, basket) {
    const range = service?.parts?.[basket];
    if (!Array.isArray(range)) return [0, 0];
    return [n(range[0]), n(range[1] ?? range[0])];
  }

  function rangeText(range) {
    const [min, max] = range;
    if (!(max > 0)) return 'Prix à renseigner après identification de la pièce.';
    return `Estimation globale des pièces : ${app().money(min)} à ${app().money(max)}. Prix réel à renseigner.`;
  }

  function isDiscPadService(service) {
    const id = String(service?.id || '').toUpperCase();
    const name = String(service?.name || '');
    return id.includes('DISC_PLAQ') || /disques?\s*\+\s*plaquettes?/i.test(name);
  }

  function axleLabel(service) {
    const id = String(service?.id || '').toUpperCase();
    const name = String(service?.name || '').toLowerCase();
    if (id.endsWith('_AV_AR') || /avant\s*(et|\+)\s*arrière/.test(name)) return 'avant et arrière';
    if (id.endsWith('_AR') || /arrière/.test(name)) return 'arrière';
    return 'avant';
  }

  function brakePartItems(service, basket) {
    const axle = axleLabel(service);
    const complete = axle === 'avant et arrière';
    const note = rangeText(serviceRange(service, basket));
    return [
      {
        item_type: 'part',
        designation: `Disques de frein ${axle}`,
        description: `${note} Ligne réservée aux disques.`,
        quantity: complete ? 4 : 2,
        unit_price: 0,
        vat_rate: 0,
        purchase_total: 0,
        supplier_reference: ''
      },
      {
        item_type: 'part',
        designation: `Plaquettes de frein ${axle}`,
        description: `${note} Ligne réservée au jeu de plaquettes.`,
        quantity: complete ? 2 : 1,
        unit_price: 0,
        vat_rate: 0,
        purchase_total: 0,
        supplier_reference: ''
      }
    ];
  }

  function defaultItems(q) {
    const request = q.service_requests || {};
    const t = request.totals || {};
    const services = Array.isArray(request.services) ? request.services : [];
    const basket = request.selected_basket || 'standard';
    const items = [];
    const discount = n(q.discount || t.comboSaving || 0);
    const laborAfterDiscount = n(t.laborAfter || t.laborBase || 0);
    const laborBeforeDiscount = laborAfterDiscount + discount;

    if (laborBeforeDiscount > 0) {
      items.push({
        item_type: 'labor',
        designation: 'Main-d’œuvre et contrôle',
        description: services.map((s) => s.name || s.id).join(', ') || 'Main-d’œuvre',
        quantity: 1,
        unit_price: laborBeforeDiscount,
        vat_rate: 0,
        purchase_total: 0,
        supplier_reference: ''
      });
    }

    services.forEach((service) => {
      if (isDiscPadService(service)) {
        items.push(...brakePartItems(service, basket));
        return;
      }
      const range = serviceRange(service, basket);
      if (range[1] > 0) {
        items.push({
          item_type: 'part',
          designation: service.name || 'Pièce nécessaire',
          description: `Panier ${String(basket).toUpperCase()} · estimation ${app().money(range[0])} à ${app().money(range[1])}`,
          quantity: 1,
          unit_price: range[1],
          vat_rate: 0,
          purchase_total: 0,
          supplier_reference: ''
        });
      }
    });

    if (!services.length && n(t.partsMax) > 0) {
      items.push({ item_type: 'part', designation: 'Pièces nécessaires', description: 'Pièces selon intervention', quantity: 1, unit_price: n(t.partsMax), vat_rate: 0, purchase_total: 0, supplier_reference: '' });
    }
    if (!items.length) items.push({ item_type: 'labor', designation: 'Prestation', description: q.description || 'Prestation à préciser', quantity: 1, unit_price: n(q.total), vat_rate: 0, purchase_total: 0, supplier_reference: '' });
    return items;
  }

  function newLine(kind) {
    if (kind === 'disc') return { item_type: 'part', designation: 'Disques de frein', description: 'Disques de frein à préciser', quantity: 2, vat_rate: 0 };
    if (kind === 'pad') return { item_type: 'part', designation: 'Plaquettes de frein', description: 'Jeu de plaquettes à préciser', quantity: 1, vat_rate: 0 };
    if (kind === 'part') return { item_type: 'part', designation: 'Pièce', description: 'Pièce à préciser', quantity: 1, vat_rate: 0 };
    return { item_type: 'labor', designation: 'Main-d’œuvre', description: 'Prestation à préciser', quantity: 1, vat_rate: 0 };
  }

  function lineHtml(item = {}, locked = false) {
    const d = locked ? ' disabled' : '';
    return `<div class="card" data-quote-line style="padding:12px;margin:10px 0">
      <div class="grid2">
        <label>Type<select data-line="type"${d}><option value="labor" ${item.item_type==='labor'?'selected':''}>Main-d’œuvre</option><option value="part" ${item.item_type==='part'?'selected':''}>Pièce</option><option value="delivery" ${item.item_type==='delivery'?'selected':''}>Livraison</option><option value="other" ${!['labor','part','delivery'].includes(item.item_type)?'selected':''}>Autre</option></select></label>
        <label>Référence pièce<input data-line="reference" value="${app().esc(item.supplier_reference || '')}"${d}></label>
        <label>Désignation<input data-line="designation" value="${app().esc(item.designation || item.description || '')}"${d}></label>
        <label>Description<input data-line="description" value="${app().esc(item.description || '')}"${d}></label>
        <label>Quantité<input data-line="quantity" type="number" min="0.01" step="0.01" value="${n(item.quantity) || 1}"${d}></label>
        <label>Prix unitaire HT<input data-line="unit_price" type="number" min="0" step="0.01" value="${n(item.unit_price)}"${d}></label>
        <label>TVA %<input data-line="vat_rate" type="number" min="0" max="100" step="0.1" value="${n(item.vat_rate)}"${d}></label>
        <label>Coût d’achat interne<input data-line="purchase_total" type="number" min="0" step="0.01" value="${n(item.purchase_total)}"${d}></label>
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

  function validateBrakeParts(root) {
    if (root.dataset.brakeCombo !== 'true') return;
    const rows = [...root.querySelectorAll('[data-quote-line]')];
    const hasPriced = (pattern) => rows.some((line) => {
      const designation = line.querySelector('[data-line="designation"]')?.value || '';
      const type = line.querySelector('[data-line="type"]')?.value;
      const price = n(line.querySelector('[data-line="unit_price"]')?.value);
      return type === 'part' && pattern.test(designation) && price > 0;
    });
    if (!hasPriced(/disques?/i)) throw new Error('Renseignez le prix des disques sur une ligne séparée.');
    if (!hasPriced(/plaquettes?/i)) throw new Error('Renseignez le prix des plaquettes sur une ligne séparée.');
  }

  async function save(id, publish) {
    const root = document.querySelector(`[data-quote-id="${id}"]`);
    let quoteNumber = root.querySelector('[data-field="number"]').value.trim();
    const validUntil = root.querySelector('[data-field="validUntil"]').value || null;
    const items = readLines(root);
    recalculate(root);
    const subtotal = n(root.querySelector('[data-field="subtotal"]').value);
    const vat = n(root.querySelector('[data-field="vatTotal"]').value);
    const gross = subtotal + vat;
    const discount = n(root.querySelector('[data-field="discount"]').value);
    const total = n(root.querySelector('[data-field="total"]').value);
    if (!items.length) throw new Error('Ajoutez au moins une ligne au devis.');
    if (!Number.isFinite(discount) || discount < 0) throw new Error('La remise doit être un montant positif ou nul.');
    if (discount > gross) throw new Error('La remise ne peut pas dépasser le total TTC avant remise.');
    if (!quoteNumber) {
      const next = await app().db.rpc('next_document_number', { p_type: 'quote' });
      if (next.error) throw next.error;
      quoteNumber = next.data;
    }
    if (!(total > 0)) throw new Error('Montant positif obligatoire.');
    if (publish) validateBrakeParts(root);
    if (publish && (!validUntil || validUntil < currentDate())) throw new Error('Une date de validité future est obligatoire.');
    const patch = {
      quote_number: quoteNumber,
      title: root.querySelector('[data-field="title"]').value.trim() || 'Devis EDM28',
      description: root.querySelector('[data-field="description"]').value.trim() || null,
      subtotal,
      discount,
      total,
      valid_until: validUntil,
      pdf_path: null
    };
    if (publish) Object.assign(patch, { status: 'sent', visible_to_client: true });
    const updated = await app().db.from('quotes').update(patch).eq('id', id).eq('status', 'draft').select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) throw new Error('Seul un brouillon peut être modifié ou publié.');
    const removed = await app().db.from('quote_items').delete().eq('quote_id', id);
    if (removed.error) throw removed.error;
    const inserted = await app().db.from('quote_items').insert(items.map((x) => ({ ...x, quote_id: id })));
    if (inserted.error) throw inserted.error;
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
      const brakeCombo = services.some(isDiscPadService);
      const items = q.quote_items?.length ? q.quote_items : defaultItems(q);
      const actions = draft ? `<div class="toolbar"><button class="btn ghost" data-save="${q.id}">Enregistrer</button><button class="btn primary" data-publish="${q.id}">Publier au client</button></div>` : '<p class="muted">Devis verrouillé après publication.</p>';
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
        <h4>Lignes du devis</h4>
        ${draft && brakeCombo ? '<div class="status error">Les disques et les plaquettes doivent être chiffrés sur deux lignes distinctes avant publication.</div>' : ''}
        <div data-lines>${items.map((item) => lineHtml(item, !draft)).join('')}</div>
        ${draft ? '<div class="toolbar"><button type="button" class="btn ghost" data-add-line="labor">Ajouter main-d’œuvre</button><button type="button" class="btn ghost" data-add-line="part">Ajouter une pièce</button><button type="button" class="btn ghost" data-add-line="disc">Ajouter des disques</button><button type="button" class="btn ghost" data-add-line="pad">Ajouter des plaquettes</button></div>' : ''}
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
      try { await save(button.dataset.save || button.dataset.publish, Boolean(button.dataset.publish)); app().status('quoteStatus', button.dataset.publish ? 'Devis complet publié au client.' : 'Devis complet enregistré. Le PDF doit être régénéré.'); await load(); await app().overview(); }
      catch (error) { app().status('quoteStatus', error.message || 'Opération impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = app()?.$('quoteList'); if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('quotes').select('id,status,title,description,quote_number,subtotal,discount,total,valid_until,visible_to_client,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),service_requests(notes,services,totals,selected_basket),quote_items(id,item_type,supplier_reference,designation,description,quantity,unit_price,vat_rate,purchase_total,total,display_order)').in('status', ['draft','sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function appendScripts(sources) { return sources.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => { if (document.querySelector(`script[src^="${src.split('?')[0]}"]`)) return resolve(); const script = document.createElement('script'); script.src = src; script.async = false; script.onload = resolve; script.onerror = reject; document.body.appendChild(script); })), Promise.resolve()); }
  function addModule({ id, label, title, description, refreshId, statusId, listId, scripts, before }) { const nav=document.querySelector('.nav'); const dashboard=document.getElementById('dashboard'); if(!nav||!dashboard||document.getElementById(id)) return; const button=document.createElement('button'); button.className='btn ghost'; button.dataset.page=id; button.textContent=label; nav.insertBefore(button,nav.querySelector(`[data-page="${before}"]`)); const section=document.createElement('section'); section.id=id; section.className='page'; section.innerHTML=`<div class="card"><div class="top"><div><h2>${title}</h2><p class="muted">${description}</p></div><button id="${refreshId}" class="btn ghost">Actualiser</button></div><div id="${statusId}" class="status hidden"></div><div id="${listId}"></div></div>`; dashboard.appendChild(section); button.addEventListener('click',()=>app().page(id)); appendScripts(scripts).catch((e)=>app().status(statusId,e.message||'Module indisponible.',true)); }
  function bootstrapModules() { addModule({id:'operations',label:'Atelier',title:'Préparation atelier',description:'Planifier les devis acceptés et préparer l’ordre de réparation associé.',refreshId:'operationRefresh',statusId:'operationStatus',listId:'operationList',scripts:['/admin-operations.js?v=3'],before:'clients'}); addModule({id:'interventions',label:'Interventions',title:'Dossiers intervention',description:'Dossier unique, fiche de contrôle mobile, photos et avancement atelier.',refreshId:'interventionRefresh',statusId:'interventionStatus',listId:'interventionList',scripts:['/admin-interventions.js?v=2'],before:'clients'}); addModule({id:'finalization',label:'Clôture',title:'Clôture et facturation',description:'Clôturer les interventions terminées et générer une facture brouillon contrôlée.',refreshId:'finalizationRefresh',statusId:'finalizationStatus',listId:'finalizationList',scripts:['/admin-finalization.js?v=2'],before:'clients'}); addModule({id:'invoice-actions',label:'Encaissement',title:'Émission et règlements',description:'Émettre les factures brouillon puis enregistrer les paiements reçus.',refreshId:'invoiceActionRefresh',statusId:'invoiceActionStatus',listId:'invoiceActionList',scripts:['/admin-invoice-actions.js?v=1'],before:'clients'}); addModule({id:'message-templates',label:'Messages',title:'Modèles de messages',description:'Modifier les messages de confirmation, devis, rendez-vous, véhicule prêt, facture et relance.',refreshId:'messageTemplateRefresh',statusId:'messageTemplateStatus',listId:'messageTemplateList',scripts:['/admin-message-templates.js?v=1'],before:'clients'}); addModule({id:'document-pdf',label:'PDF',title:'Documents PDF',description:'Générer et stocker les devis, ordres de réparation, contrôles et factures dans le coffre privé.',refreshId:'documentPdfRefresh',statusId:'documentPdfStatus',listId:'documentPdfList',scripts:['/pdf-lite.js?v=1','/admin-document-pdf.js?v=2'],before:'clients'}); addModule({id:'audit-log',label:'Journal',title:'Journal des opérations',description:'Consulter les changements métier enregistrés automatiquement.',refreshId:'auditLogRefresh',statusId:'auditLogStatus',listId:'auditLogList',scripts:['/admin-audit-log.js?v=1'],before:'clients'}); }
  function bind() { bootstrapModules(); document.querySelector('[data-page="quotes"]')?.addEventListener('click',()=>load().catch((error)=>app().status('quoteStatus',error.message||'Devis indisponibles.',true))); document.getElementById('quoteRefresh')?.addEventListener('click',()=>load().catch((error)=>app().status('quoteStatus',error.message||'Actualisation impossible.',true))); }
  window.EDMAdminQuotes={load}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();