(() => {
  if (window.__edmClientDisbursementsInstalled) return;
  window.__edmClientDisbursementsInstalled = true;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const dateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
  };

  const statusLabels = {
    draft: 'Brouillon',
    awaiting_mandate: 'Choix client requis',
    authorized: 'Mandat accepté · achat à effectuer',
    awaiting_reapproval: 'Nouvelle autorisation requise',
    client_direct: 'Achat direct par le client',
    purchased: 'Achat à contrôler',
    eligible: 'Débours justifié · remboursement à venir',
    reimbursed: 'Remboursé et archivé',
    rejected: 'Refusé',
    cancelled: 'Annulé'
  };

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const main = document.querySelector('main.main');
    if (!nav || !main) return null;

    let button = nav.querySelector('[data-page="disbursements"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = 'disbursements';
      button.textContent = '🧾 Débours & pièces';
      const history = nav.querySelector('[data-page="history"]');
      nav.insertBefore(button, history || null);
      button.addEventListener('click', () => {
        if (typeof showPage === 'function') showPage('disbursements');
        void load().catch((error) => renderError(error));
      });
    }

    let section = document.getElementById('disbursements');
    if (!section) {
      section = document.createElement('section');
      section.id = 'disbursements';
      section.className = 'page';
      section.innerHTML = `
        <div class="panel">
          <div class="section-title"><div><span class="pill orange">Pièces & débours</span><h2 style="margin-top:12px">Comment ça fonctionne ?</h2><p>EDM distingue toujours le prix de sa prestation du financement des pièces. Un débours n’est jamais une revente de pièce déguisée.</p></div></div>
          <div class="grid-3" style="margin-top:16px">
            <article class="card"><h3>1 · Achat direct client</h3><p>Vous achetez et payez vous-même la pièce. EDM peut fournir la référence utile. Aucun remboursement de pièce ne transite par EDM.</p></article>
            <article class="card"><h3>2 · Débours EDM</h3><p>Vous mandatez EDM avant l’achat. L’achat est fait en votre nom et pour votre compte, dans la limite autorisée. Vous remboursez uniquement le montant réel du justificatif, sans marge.</p></article>
            <article class="card"><h3>3 · Vente de pièce par EDM</h3><p>Si une pièce est vendue par EDM comme une vente classique, elle reste une ligne commerciale normale. Elle n’est pas traitée comme un débours.</p></article>
          </div>
          <div class="notice" style="margin-top:16px"><strong>Règle de transparence :</strong> une proposition de débours affiche un plafond avant achat. Le montant remboursable devient ensuite le montant exact du justificatif fournisseur. Si le prix dépasse le plafond accepté, EDM doit demander une nouvelle autorisation avant l’achat.</div>
        </div>
        <div class="panel">
          <div class="section-title"><div><h2>Mes pièces et débours</h2><p>Mandats, achats, justificatifs et remboursements associés à vos devis.</p></div><button id="clientDisbursementRefresh" class="btn btn-ghost" type="button">Actualiser</button></div>
          <div id="clientDisbursementStatus"></div>
          <div id="clientDisbursementList"></div>
        </div>`;
      const historyPage = document.getElementById('history');
      main.insertBefore(section, historyPage || null);
      section.querySelector('#clientDisbursementRefresh')?.addEventListener('click', () => void load().catch((error) => renderError(error)));
    }
    return section;
  }

  function renderError(error) {
    const host = document.getElementById('clientDisbursementStatus');
    if (host) host.innerHTML = `<div class="errorbox">${esc(error?.message || 'Débours indisponibles.')}</div>`;
  }

  async function currentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function choose(id, choice) {
    const result = await supabaseClient.rpc('client_choose_disbursement', {
      p_disbursement_id: id,
      p_choice: choice
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function openProof(path) {
    if (!path) return;
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  function details(row) {
    const item = row.quote_items || {};
    const quote = row.quotes || {};
    const vehicle = row.vehicles || {};
    const label = item.designation || item.description || row.description || 'Pièce';
    const vehicleLabel = [vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(' · ') || 'Véhicule';
    const currentLimit = row.status === 'awaiting_reapproval' ? row.requested_limit : row.authorized_limit;
    return { item, quote, label, vehicleLabel, currentLimit };
  }

  function mandateActions(row) {
    const { currentLimit } = details(row);
    const reapproval = row.status === 'awaiting_reapproval';
    const checkId = `mandate-${row.id}`;
    return `<div class="notice" style="margin-top:12px">
      <strong>${reapproval ? 'Nouvelle autorisation demandée' : 'Deux choix possibles avant achat'}</strong>
      <p style="margin:8px 0">${esc(row.mandate_text || 'Mandat de débours EDM28.')}</p>
      <p><strong>Plafond à autoriser : ${money(currentLimit)}</strong></p>
      <label style="display:flex;grid-template-columns:auto 1fr;align-items:flex-start;gap:10px;font-weight:700"><input id="${checkId}" data-mandate-check="${row.id}" type="checkbox" style="width:20px;min-height:20px;margin-top:3px"><span>J’ai lu le mandat. Je comprends qu’EDM agit pour cet achat en mon nom et pour mon compte, sans marge, et que je rembourserai le montant exact du justificatif dans la limite autorisée.</span></label>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" data-accept-mandate="${row.id}" disabled>${reapproval ? 'Autoriser le nouveau plafond' : 'Je mandate EDM pour l’achat'}</button>
        ${reapproval ? '' : `<button class="btn btn-secondary" type="button" data-client-direct="${row.id}">Je commande et paie moi-même</button>`}
      </div>
    </div>`;
  }

  function card(row) {
    const { quote, label, vehicleLabel, currentLimit } = details(row);
    const actual = row.amount != null ? money(row.amount) : 'Pas encore acheté';
    const proof = row.proof_path ? `<button class="btn btn-ghost" type="button" data-proof="${esc(row.proof_path)}">Voir le justificatif fournisseur</button>` : '';
    const mandate = ['awaiting_mandate', 'awaiting_reapproval'].includes(row.status) ? mandateActions(row) : '';
    const direct = row.status === 'client_direct' ? '<div class="okbox"><strong>Achat direct choisi.</strong><br>Vous achetez et payez la pièce directement. Cette pièce ne sera pas remboursée à EDM comme débours.</div>' : '';
    const authorized = row.status === 'authorized' ? `<div class="infobox"><strong>Mandat accepté.</strong><br>EDM peut acheter la pièce dans la limite de ${money(row.authorized_limit)}. Le montant final sera celui du justificatif réel.</div>` : '';
    const eligible = row.status === 'eligible' ? `<div class="okbox"><strong>Débours justifié.</strong><br>Montant exact à rembourser : ${money(row.amount)}. Aucune marge n’est appliquée.</div>` : '';
    const reimbursed = row.status === 'reimbursed' ? `<div class="okbox"><strong>Débours remboursé.</strong><br>Le remboursement exact de ${money(row.amount)} a été enregistré le ${esc(dateTime(row.reimbursed_at))}.</div>` : '';

    return `<article class="card" data-client-disbursement="${row.id}" style="margin:12px 0">
      <div class="section-title"><div><span class="pill orange">${esc(statusLabels[row.status] || row.status)}</span><h3 style="margin-top:10px">${esc(label)}</h3><p>${esc(quote.quote_number || 'Devis')} · ${esc(vehicleLabel)}</p></div><strong>${currentLimit ? `Plafond ${money(currentLimit)}` : actual}</strong></div>
      <div class="summary">
        <div class="summary-line"><span>Montant réellement avancé</span><strong>${actual}</strong></div>
        <div class="summary-line"><span>Fournisseur</span><strong>${esc(row.supplier || 'À renseigner après achat')}</strong></div>
        <div class="summary-line"><span>Facture au nom du client</span><strong>${row.supplier_invoice_in_customer_name ? 'Oui' : 'En attente'}</strong></div>
        <div class="summary-line"><span>Marge EDM sur le débours</span><strong>${row.no_margin ? '0 €' : 'Non conforme'}</strong></div>
      </div>
      ${mandate}${direct}${authorized}${eligible}${reimbursed}
      ${proof ? `<div class="btn-row">${proof}</div>` : ''}
    </article>`;
  }

  function bindActions(section) {
    section.querySelectorAll('[data-mandate-check]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const button = section.querySelector(`[data-accept-mandate="${CSS.escape(checkbox.dataset.mandateCheck)}"]`);
        if (button) button.disabled = !checkbox.checked;
      });
    });
    section.querySelectorAll('[data-accept-mandate]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await choose(button.dataset.acceptMandate, 'edm_disbursement'); await load(); }
      catch (error) { renderError(error); }
      finally { button.disabled = false; }
    }));
    section.querySelectorAll('[data-client-direct]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Confirmer que vous commandez et payez cette pièce vous-même ?')) return;
      button.disabled = true;
      try { await choose(button.dataset.clientDirect, 'client_direct'); await load(); }
      catch (error) { renderError(error); }
      finally { button.disabled = false; }
    }));
    section.querySelectorAll('[data-proof]').forEach((button) => button.addEventListener('click', () => {
      void openProof(button.dataset.proof).catch((error) => renderError(error));
    }));
  }

  async function load() {
    const section = ensureUi();
    const host = document.getElementById('clientDisbursementList');
    const status = document.getElementById('clientDisbursementStatus');
    if (!section || !host) return;
    const user = await currentUser();
    if (!user) {
      host.innerHTML = '<div class="notice">Connectez-vous pour consulter vos débours.</div>';
      return;
    }
    if (status) status.innerHTML = '';
    host.innerHTML = '<div class="notice">Chargement…</div>';
    const { data, error } = await supabaseClient.from('disbursements')
      .select('id,user_id,vehicle_id,service_request_id,quote_id,invoice_id,quote_item_id,supplier,supplier_invoice_number,supplier_invoice_date,description,amount,mandate_signed,supplier_invoice_in_customer_name,exact_reimbursement,no_margin,proof_path,status,reimbursed_at,authorized_limit,requested_limit,client_choice,mandate_text,mandate_version,mandate_accepted_at,purchase_recorded_at,payment_method,created_at,quotes(quote_number,status),quote_items(designation,description,supplier_reference,purchase_mode),vehicles(plate,brand,model)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    host.innerHTML = (data || []).map(card).join('') || '<div class="empty">Aucun débours ou achat de pièce à traiter.</div>';
    bindActions(section);
  }

  function install() {
    ensureUi();
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user && document.getElementById('disbursements')?.classList.contains('active')) void load().catch(renderError);
      });
    }
  }

  window.EDMClientDisbursements = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();