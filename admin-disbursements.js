(() => {
  if (window.__edmAdminDisbursementsInstalled) return;
  window.__edmAdminDisbursementsInstalled = true;

  const A = () => window.EDMAdmin;
  const n = (value) => Number(value || 0);
  const date = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';
  const statusLabels = {
    awaiting_mandate: 'Mandat client à valider',
    authorized: 'Autorisé · achat possible',
    awaiting_reapproval: 'Nouveau plafond à valider',
    client_direct: 'Achat direct client',
    eligible: 'Justifié · à rembourser',
    reimbursed: 'Remboursé',
    cancelled: 'Annulé',
    rejected: 'Refusé',
    draft: 'Brouillon',
    purchased: 'Achat à contrôler'
  };

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard) return null;
    let button = nav.querySelector('[data-page="disbursements"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'btn ghost';
      button.dataset.page = 'disbursements';
      button.textContent = 'Débours';
      const operations = nav.querySelector('[data-page="operations"]');
      nav.insertBefore(button, operations || null);
      button.addEventListener('click', () => {
        A()?.page('disbursements');
        void load().catch((error) => A()?.status('disbursementStatus', error.message || 'Débours indisponibles.', true));
      });
    }

    let section = document.getElementById('disbursements');
    if (!section) {
      section = document.createElement('section');
      section.id = 'disbursements';
      section.className = 'page';
      section.innerHTML = `<div class="card">
        <div class="top"><div><h2>Débours client</h2><p class="muted">Mandat préalable, achat au nom et pour le compte du client, justificatif et remboursement exact sans marge.</p></div><button id="disbursementRefresh" class="btn ghost" type="button">Actualiser</button></div>
        <div class="status" style="margin-top:12px"><strong>Fonctionnement :</strong> 1) proposer un plafond sur une ligne de pièce d’un devis publié ; 2) le client accepte le devis puis choisit achat direct ou mandat EDM ; 3) si EDM est mandaté, ne pas acheter au-delà du plafond ; 4) enregistrer le montant réel et le justificatif au nom du client ; 5) le remboursement exact est séparé des prestations EDM.</div>
        <div id="disbursementKpis" class="grid" style="margin-top:14px"></div>
        <div id="disbursementStatus" class="status hidden"></div>
      </div>
      <div class="card" style="margin-top:14px"><h2>Proposer un débours</h2><p class="muted">Uniquement pour une pièce d’un devis déjà publié. Le montant saisi est un plafond d’autorisation, pas un prix de vente EDM.</p><div id="disbursementProposalList"></div></div>
      <div class="card" style="margin-top:14px"><h2>Suivi des débours</h2><div id="disbursementList"></div></div>`;
      const operations = document.getElementById('operations');
      dashboard.insertBefore(section, operations || null);
      section.querySelector('#disbursementRefresh')?.addEventListener('click', () => void load().catch((error) => A()?.status('disbursementStatus', error.message || 'Actualisation impossible.', true)));
    }
    return section;
  }

  function mandateText({ quote, item, limit, vehicle }) {
    const part = item.designation || item.description || 'pièce automobile';
    const plate = vehicle?.plate ? ` pour le véhicule ${vehicle.plate}` : '';
    return `Je mandate EDM pour acheter ${part}${plate}, en mon nom et pour mon compte, dans la limite de ${A().money(limit)}. Je rembourserai uniquement le montant réellement avancé figurant sur le justificatif fournisseur établi à mon nom. Aucune marge ne sera appliquée sur ce débours. Devis ${quote.quote_number || quote.id}.`;
  }

  async function createProposal(quote, item, root) {
    const limit = n(root.querySelector('[data-proposal-limit]').value);
    const supplier = root.querySelector('[data-proposal-supplier]').value.trim() || null;
    if (!(limit > 0)) throw new Error('Plafond positif obligatoire.');
    const description = item.designation || item.description || 'Pièce automobile';
    const inserted = await A().db.from('disbursements').insert({
      user_id: quote.user_id,
      vehicle_id: quote.vehicle_id,
      service_request_id: quote.service_request_id,
      quote_id: quote.id,
      quote_item_id: item.id,
      supplier,
      description,
      amount: null,
      authorized_limit: limit,
      requested_limit: null,
      client_choice: 'pending',
      mandate_text: mandateText({ quote, item, limit, vehicle: quote.vehicles }),
      mandate_version: 'edm28-debours-v1',
      mandate_signed: false,
      no_margin: true,
      status: 'awaiting_mandate'
    }).select('id').single();
    if (inserted.error) throw inserted.error;
    const note = `Proposition de débours : plafond ${A().money(limit)}, remboursement du montant réel sur justificatif, sans marge.`;
    const currentDescription = String(item.description || '').trim();
    const patch = {
      purchase_mode: 'disbursement',
      supplier,
      description: currentDescription.includes('Proposition de débours') ? currentDescription : [currentDescription, note].filter(Boolean).join(' — ')
    };
    const updated = await A().db.from('quote_items').update(patch).eq('id', item.id).eq('quote_id', quote.id).select('id');
    if (updated.error || !updated.data?.length) {
      await A().db.from('disbursements').delete().eq('id', inserted.data.id);
      throw updated.error || new Error('La ligne de devis a changé.');
    }
  }

  async function requestNewLimit(row, root) {
    const requested = n(root.querySelector('[data-new-limit]').value);
    if (!(requested > n(row.authorized_limit))) throw new Error('Le nouveau plafond doit être supérieur au plafond déjà accepté.');
    const updated = await A().db.from('disbursements').update({ requested_limit: requested, status: 'awaiting_reapproval' }).eq('id', row.id).eq('status', 'authorized').select('id');
    if (updated.error || !updated.data?.length) throw updated.error || new Error('Le débours a changé de statut.');
  }

  async function recordPurchase(row, root) {
    const supplier = root.querySelector('[data-purchase-supplier]').value.trim();
    const invoiceNumber = root.querySelector('[data-purchase-invoice]').value.trim() || null;
    const invoiceDate = root.querySelector('[data-purchase-date]').value || null;
    const amount = n(root.querySelector('[data-purchase-amount]').value);
    const paymentMethod = root.querySelector('[data-purchase-method]').value;
    const customerNameConfirmed = root.querySelector('[data-customer-name]').checked;
    const file = root.querySelector('[data-purchase-proof]').files?.[0];
    if (!supplier) throw new Error('Fournisseur obligatoire.');
    if (!(amount > 0)) throw new Error('Montant réel positif obligatoire.');
    if (amount > n(row.authorized_limit)) throw new Error('Montant supérieur au plafond : demandez une nouvelle autorisation avant tout achat.');
    if (!customerNameConfirmed) throw new Error('Confirmez que le justificatif fournisseur est établi au nom du client.');
    if (!file) throw new Error('Justificatif fournisseur obligatoire.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Le justificatif doit faire moins de 10 Mo.');

    const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const path = `${row.user_id}/disbursements/${row.id}-${Date.now()}.${ext}`;
    const upload = await A().db.storage.from('repair-documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upload.error) throw upload.error;
    try {
      const updated = await A().db.from('disbursements').update({
        supplier,
        supplier_invoice_number: invoiceNumber,
        supplier_invoice_date: invoiceDate,
        amount,
        payment_method: paymentMethod,
        proof_path: path,
        supplier_invoice_in_customer_name: true,
        purchase_recorded_at: new Date().toISOString(),
        no_margin: true,
        status: 'eligible'
      }).eq('id', row.id).eq('status', 'authorized').select('id');
      if (updated.error || !updated.data?.length) throw updated.error || new Error('Le débours a changé de statut.');
    } catch (error) {
      await A().db.storage.from('repair-documents').remove([path]).catch(() => {});
      throw error;
    }
  }

  async function cancel(row) {
    if (!['awaiting_mandate', 'authorized', 'awaiting_reapproval'].includes(row.status)) throw new Error('Ce débours ne peut plus être annulé ici.');
    const updated = await A().db.from('disbursements').update({ status: 'cancelled' }).eq('id', row.id).in('status', ['awaiting_mandate','authorized','awaiting_reapproval']).select('id');
    if (updated.error || !updated.data?.length) throw updated.error || new Error('Le débours a changé de statut.');
    if (row.quote_item_id) {
      const reset = await A().db.from('quote_items').update({ purchase_mode: 'resale' }).eq('id', row.quote_item_id).select('id');
      if (reset.error) throw reset.error;
    }
  }

  async function openProof(path) {
    const result = await A().db.storage.from('repair-documents').createSignedUrl(path, 120);
    if (result.error) throw result.error;
    window.open(result.data.signedUrl, '_blank', 'noopener');
  }

  function proposalCard(quote, item) {
    const defaultLimit = n(item.total) || n(item.quantity) * n(item.unit_price);
    return `<article class="card" data-proposal-item="${item.id}" style="margin:10px 0"><div class="top"><div><span class="pill">${A().esc(quote.status)}</span><h3>${A().esc(item.designation || item.description || 'Pièce')}</h3><p class="muted">${A().esc(quote.quote_number || 'Devis')} · ${A().esc(quote.profiles?.email || 'Client')} · ${A().esc(quote.vehicles?.plate || 'Véhicule')}</p></div><strong>${A().money(defaultLimit)}</strong></div><div class="grid2"><label>Plafond proposé<input data-proposal-limit type="number" min="0.01" step="0.01" value="${defaultLimit > 0 ? defaultLimit : ''}"></label><label>Fournisseur envisagé (facultatif)<input data-proposal-supplier value="${A().esc(item.supplier || '')}"></label></div><button class="btn primary" type="button" data-create-proposal="${item.id}">Envoyer la proposition de débours</button></article>`;
  }

  function workflowCard(row) {
    const quote = row.quotes || {};
    const item = row.quote_items || {};
    const vehicle = row.vehicles || {};
    const label = item.designation || item.description || row.description || 'Pièce';
    const proof = row.proof_path ? `<button class="btn ghost" type="button" data-open-proof="${A().esc(row.proof_path)}">Justificatif</button>` : '';
    let action = '';
    if (row.status === 'authorized') {
      action = `<div class="card" style="margin-top:12px;background:#f8fafc"><h4>Enregistrer l’achat</h4><p class="muted">Ne pas acheter au-delà de ${A().money(row.authorized_limit)}. Si le fournisseur annonce un prix supérieur, demandez d’abord un nouveau plafond.</p><div class="grid2"><label>Fournisseur<input data-purchase-supplier value="${A().esc(row.supplier || '')}"></label><label>N° facture / ticket<input data-purchase-invoice></label><label>Date du justificatif<input data-purchase-date type="date"></label><label>Montant réellement payé<input data-purchase-amount type="number" min="0.01" max="${n(row.authorized_limit)}" step="0.01"></label><label>Mode de paiement<select data-purchase-method><option value="card">Carte</option><option value="transfer">Virement</option><option value="cash">Espèces</option><option value="check">Chèque</option></select></label><label>Justificatif<input data-purchase-proof type="file" accept="application/pdf,image/*"></label></div><label style="display:flex;grid-template-columns:auto 1fr;gap:10px;align-items:start"><input data-customer-name type="checkbox" style="width:20px;min-height:20px"><span>Je confirme que le justificatif fournisseur est établi au nom du client.</span></label><div class="toolbar"><button class="btn primary" type="button" data-record-purchase="${row.id}">Enregistrer l’achat exact</button></div><hr><div class="grid2"><label>Nouveau plafond avant achat<input data-new-limit type="number" min="${n(row.authorized_limit) + 0.01}" step="0.01"></label><div style="align-self:end"><button class="btn ghost" type="button" data-request-limit="${row.id}">Demander une nouvelle autorisation</button></div></div></div>`;
    } else if (row.status === 'awaiting_mandate') {
      action = '<div class="status">Le client doit d’abord accepter le devis puis choisir achat direct ou mandat EDM dans son espace.</div>';
    } else if (row.status === 'awaiting_reapproval') {
      action = `<div class="status">Nouvelle autorisation client en attente : ${A().money(row.requested_limit)}. Aucun achat au-dessus de l’ancien plafond avant validation.</div>`;
    } else if (row.status === 'eligible') {
      action = `<div class="status ok">Débours conforme : ${A().money(row.amount)} à rembourser exactement. Il sera rattaché à la facture lors de la clôture.</div>`;
    } else if (row.status === 'client_direct') {
      action = '<div class="status ok">Le client commande et paie lui-même. Aucun flux financier de pièce ne doit passer par EDM.</div>';
    } else if (row.status === 'reimbursed') {
      action = `<div class="status ok">Remboursement exact enregistré le ${A().esc(date(row.reimbursed_at))}.</div>`;
    }
    const cancelButton = ['awaiting_mandate','authorized','awaiting_reapproval'].includes(row.status) ? `<button class="btn ghost" type="button" data-cancel-disbursement="${row.id}">Annuler la proposition</button>` : '';
    return `<article class="card" data-disbursement-id="${row.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(statusLabels[row.status] || row.status)}</span><h3>${A().esc(label)}</h3><p class="muted">${A().esc(quote.quote_number || 'Devis')} · ${A().esc(row.profiles?.email || 'Client')} · ${A().esc(vehicle.plate || 'Véhicule')}</p></div><strong>${row.amount != null ? A().money(row.amount) : A().money(row.requested_limit || row.authorized_limit || 0)}</strong></div><div class="grid2"><p><strong>Plafond accepté :</strong><br>${row.authorized_limit ? A().money(row.authorized_limit) : '—'}</p><p><strong>Montant réel :</strong><br>${row.amount != null ? A().money(row.amount) : '—'}</p><p><strong>Mandat :</strong><br>${row.mandate_signed ? `Accepté le ${A().esc(date(row.mandate_accepted_at))}` : 'En attente'}</p><p><strong>Marge sur débours :</strong><br>${row.no_margin ? '0 €' : 'NON CONFORME'}</p></div>${action}<div class="toolbar">${proof}${cancelButton}</div></article>`;
  }

  function renderKpis(rows) {
    const host = document.getElementById('disbursementKpis');
    if (!host) return;
    const advanced = rows.filter((row) => ['eligible','reimbursed'].includes(row.status)).reduce((sum, row) => sum + n(row.amount), 0);
    const outstanding = rows.filter((row) => row.status === 'eligible').reduce((sum, row) => sum + n(row.amount), 0);
    const reimbursed = rows.filter((row) => row.status === 'reimbursed').reduce((sum, row) => sum + n(row.amount), 0);
    host.innerHTML = [['Avancé en débours', advanced], ['À rembourser', outstanding], ['Remboursé', reimbursed]].map(([label, value]) => `<article class="card kpi"><span>${A().esc(label)}</span><strong>${A().money(value)}</strong></article>`).join('');
  }

  function bindWorkflow(rows) {
    const host = document.getElementById('disbursementList');
    host?.querySelectorAll('[data-record-purchase]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const row = rows.find((item) => item.id === button.dataset.recordPurchase); await recordPurchase(row, button.closest('[data-disbursement-id]')); A().status('disbursementStatus', 'Achat enregistré. Débours éligible au remboursement exact.'); await load(); }
      catch (error) { A().status('disbursementStatus', error.message || 'Achat impossible.', true); }
      finally { button.disabled = false; }
    });
    host?.querySelectorAll('[data-request-limit]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { const row = rows.find((item) => item.id === button.dataset.requestLimit); await requestNewLimit(row, button.closest('[data-disbursement-id]')); A().status('disbursementStatus', 'Nouvelle autorisation envoyée au client. Aucun achat au-dessus du plafond actuel avant validation.'); await load(); }
      catch (error) { A().status('disbursementStatus', error.message || 'Demande impossible.', true); }
      finally { button.disabled = false; }
    });
    host?.querySelectorAll('[data-open-proof]').forEach((button) => button.onclick = () => void openProof(button.dataset.openProof).catch((error) => A().status('disbursementStatus', error.message, true)));
    host?.querySelectorAll('[data-cancel-disbursement]').forEach((button) => button.onclick = async () => {
      const row = rows.find((item) => item.id === button.dataset.cancelDisbursement);
      if (!row || !confirm('Annuler cette proposition de débours ?')) return;
      button.disabled = true;
      try { await cancel(row); await load(); }
      catch (error) { A().status('disbursementStatus', error.message || 'Annulation impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    ensureUi();
    if (!A()?.db) return;
    const [disbursementsResult, quotesResult] = await Promise.all([
      A().db.from('disbursements').select('id,user_id,vehicle_id,service_request_id,quote_id,invoice_id,quote_item_id,supplier,supplier_invoice_number,supplier_invoice_date,description,amount,mandate_signed,supplier_invoice_in_customer_name,exact_reimbursement,no_margin,proof_path,status,reimbursed_at,authorized_limit,requested_limit,client_choice,mandate_text,mandate_version,mandate_accepted_at,purchase_recorded_at,payment_method,created_at,profiles(email),quotes(quote_number,status),quote_items(designation,description,purchase_mode),vehicles(plate)').order('created_at', { ascending: false }),
      A().db.from('quotes').select('id,user_id,vehicle_id,service_request_id,quote_number,status,profiles(email),vehicles(plate),quote_items(id,item_type,designation,description,quantity,unit_price,total,supplier,purchase_mode)').in('status', ['sent','accepted']).order('created_at', { ascending: false })
    ]);
    if (disbursementsResult.error) throw disbursementsResult.error;
    if (quotesResult.error) throw quotesResult.error;
    const rows = disbursementsResult.data || [];
    const linked = new Set(rows.map((row) => row.quote_item_id).filter(Boolean));
    const proposals = [];
    (quotesResult.data || []).forEach((quote) => (quote.quote_items || []).filter((item) => item.item_type === 'part' && !linked.has(item.id)).forEach((item) => proposals.push({ quote, item })));

    const proposalHost = document.getElementById('disbursementProposalList');
    proposalHost.innerHTML = proposals.length ? proposals.map(({ quote, item }) => proposalCard(quote, item)).join('') : '<p class="muted">Aucune ligne de pièce publiée disponible pour une nouvelle proposition.</p>';
    proposalHost.querySelectorAll('[data-create-proposal]').forEach((button) => button.onclick = async () => {
      const entry = proposals.find(({ item }) => item.id === button.dataset.createProposal);
      if (!entry) return;
      button.disabled = true;
      try { await createProposal(entry.quote, entry.item, button.closest('[data-proposal-item]')); A().status('disbursementStatus', 'Proposition créée. Le client la verra après acceptation du devis.'); await load(); }
      catch (error) { A().status('disbursementStatus', error.message || 'Création impossible.', true); }
      finally { button.disabled = false; }
    });

    const host = document.getElementById('disbursementList');
    host.innerHTML = rows.length ? rows.map(workflowCard).join('') : '<p class="muted">Aucun débours enregistré.</p>';
    renderKpis(rows);
    bindWorkflow(rows);
  }

  function install() { ensureUi(); }
  window.EDMAdminDisbursements = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();