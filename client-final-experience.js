(() => {
  if (window.__edmClientFinalExperienceInstalled) return;
  window.__edmClientFinalExperienceInstalled = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const dateTime = (value) => {
    const d = new Date(value || 0);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR');
  };
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const BUCKET = 'repair-documents';
  let historyLoading = false;
  let messagesLoading = false;

  async function currentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function signedUrl(path, expires = 180) {
    const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrl(path, expires);
    if (error || !data?.signedUrl) throw error || new Error('Fichier indisponible.');
    return data.signedUrl;
  }

  async function openPath(path) {
    window.open(await signedUrl(path), '_blank', 'noopener,noreferrer');
  }

  async function downloadPath(path, filename) {
    const url = await signedUrl(path, 300);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}).`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || path.split('/').pop() || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function installStyles() {
    if ($('#edm-final-client-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-final-client-style';
    style.textContent = `
      #home h1 .edm-votre-black{color:#050505!important;text-shadow:none!important}
      .edm-history-vehicle,.edm-history-job,.edm-mail-row,.edm-faq-item{border:1px solid var(--border);border-radius:20px;background:#fff;overflow:hidden}
      .edm-history-vehicle+.edm-history-vehicle,.edm-history-job+.edm-history-job,.edm-mail-row+.edm-mail-row,.edm-faq-item+.edm-faq-item{margin-top:10px}
      .edm-full-button{width:100%;background:transparent;color:inherit;text-align:left;padding:16px;display:block}
      .edm-job-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .edm-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
      .edm-photo-card{border:1px solid var(--border);border-radius:16px;padding:8px;background:var(--surface-2)}
      .edm-photo-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block}
      .edm-mail-layout{display:grid;grid-template-columns:minmax(260px,.42fr) minmax(0,.58fr);gap:14px;min-height:520px}
      .edm-mail-list,.edm-mail-reader{border:1px solid var(--border);border-radius:22px;background:#fff;overflow:hidden}
      .edm-mail-list-head,.edm-mail-reader-head{padding:14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;justify-content:space-between}
      .edm-mail-scroll{max-height:610px;overflow:auto;padding:10px}
      .edm-mail-row{cursor:pointer;padding:14px}.edm-mail-row:hover{background:var(--surface-2)}.edm-mail-row.unread{border-left:4px solid var(--blue);font-weight:800}
      .edm-mail-subject{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.edm-mail-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-weight:500;margin-top:7px}
      .edm-reader-body{padding:18px;white-space:pre-wrap;line-height:1.65}.edm-compose{padding:18px}
      .edm-faq-question{width:100%;text-align:left;background:transparent;color:inherit;padding:16px;font-weight:900;display:flex;justify-content:space-between;gap:12px}.edm-faq-answer{padding:0 16px 16px;color:var(--muted);line-height:1.65}
      .edm-flow-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.edm-flow-card{border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff}
      @media(max-width:820px){.edm-mail-layout{grid-template-columns:1fr}.edm-mail-reader{min-height:380px}.edm-photo-grid,.edm-flow-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.edm-photo-grid,.edm-flow-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function patchHomeAndHelp() {
    const h1 = $('#home h1');
    if (h1) h1.innerHTML = '<span class="edm-votre-black">Votre</span> sécurité, notre expertise.';
    const homeAbout = $('#home [data-jump="about"]');
    if (homeAbout) homeAbout.textContent = 'Comment fonctionne EDM28';
    const aboutNav = $('[data-page="about"]');
    if (aboutNav) aboutNav.innerHTML = 'ℹ️ Comment fonctionne EDM28';

    const page = $('#about');
    if (!page) return;
    page.innerHTML = `<div class="panel">
      <div class="section-title"><div><h2>Comment fonctionne EDM28</h2><p class="lead">Du premier besoin jusqu’aux documents de fin d’intervention, votre dossier reste accessible depuis votre espace client.</p></div></div>
      <div class="edm-flow-grid">
        <article class="edm-flow-card"><span class="pill blue">1</span><h3 style="margin-top:10px">Compte et véhicule</h3><p>Vous créez votre compte, ajoutez votre véhicule et renseignez les informations nécessaires.</p></article>
        <article class="edm-flow-card"><span class="pill blue">2</span><h3 style="margin-top:10px">Demande et estimation</h3><p>Vous choisissez les prestations disponibles, le niveau de pièces et transmettez votre demande à EDM28.</p></article>
        <article class="edm-flow-card"><span class="pill blue">3</span><h3 style="margin-top:10px">Devis</h3><p>EDM28 contrôle votre demande, prépare le devis puis le publie dans votre espace. Vous pouvez le consulter avant acceptation.</p></article>
        <article class="edm-flow-card"><span class="pill blue">4</span><h3 style="margin-top:10px">Rendez-vous et OR</h3><p>Après acceptation, le rendez-vous est confirmé et l’ordre de réparation reprend les travaux autorisés.</p></article>
        <article class="edm-flow-card"><span class="pill blue">5</span><h3 style="margin-top:10px">Intervention transparente</h3><p>Les contrôles, mesures, observations et photos sont enregistrés pendant l’intervention.</p></article>
        <article class="edm-flow-card"><span class="pill blue">6</span><h3 style="margin-top:10px">Fin et historique</h3><p>Après clôture, vous retrouvez par véhicule le devis, l’OR, la fiche de contrôle, les photos et la facture.</p></article>
      </div>
      <div style="margin-top:24px"><h3>Questions fréquentes</h3><div id="edmFaq" style="margin-top:12px"></div></div>
    </div>`;

    const faqs = [
      ['L’estimation affichée sur le site est-elle le prix définitif ?', 'Non. L’estimation sert à préparer votre demande. Le montant définitif est celui du devis publié par EDM28 après vérification.'],
      ['Quand puis-je choisir mon rendez-vous ?', 'Le rendez-vous se prépare après validation du devis afin que la durée et les travaux prévus soient cohérents.'],
      ['Où retrouver mes documents ?', 'Dans Historique : choisissez votre véhicule, puis l’intervention. Vous pourrez ouvrir ou télécharger les documents disponibles et les photos du contrôle.'],
      ['Puis-je apporter mes propres pièces ?', 'Le traitement dépend de la prestation et des conditions indiquées lors de la demande. Les pièces doivent être compatibles avec le véhicule et les travaux prévus.'],
      ['Comment savoir ce qui a été contrôlé ?', 'La fiche de contrôle reprend les points vérifiés, les mesures, les statuts, les observations et, lorsqu’elles ont été ajoutées, les photos de l’intervention.'],
      ['Comment contacter EDM28 ?', 'Utilisez la Messagerie de votre espace client. Vous pouvez écrire un nouveau message et consulter les réponses liées à votre dossier.'],
      ['Puis-je télécharger mes documents ?', 'Oui. Dans l’historique d’une intervention, chaque document peut être ouvert ou téléchargé, et un bouton permet de télécharger tous les fichiers disponibles.']
    ];
    const faqHost = $('#edmFaq');
    if (faqHost) {
      faqHost.innerHTML = faqs.map(([q,a], index) => `<article class="edm-faq-item"><button class="edm-faq-question" type="button" data-faq="${index}"><span>${esc(q)}</span><span>+</span></button><div class="edm-faq-answer hidden" data-faq-answer="${index}">${esc(a)}</div></article>`).join('');
      $$('[data-faq]', faqHost).forEach((button) => button.addEventListener('click', () => {
        const answer = $(`[data-faq-answer="${button.dataset.faq}"]`, faqHost);
        answer?.classList.toggle('hidden');
        const icon = button.lastElementChild;
        if (icon) icon.textContent = answer?.classList.contains('hidden') ? '+' : '−';
      }));
    }
  }

  function historyShell() {
    const page = $('#history');
    if (!page) return null;
    page.innerHTML = `<div class="panel"><div class="section-title"><div><h2>Historique par véhicule</h2><p>Choisissez votre véhicule, puis une intervention pour retrouver tout le dossier.</p></div><button id="edmHistoryRefresh" class="btn btn-ghost" type="button">Actualiser</button></div><div id="edmHistoryStatus" class="small"></div><div id="edmVehicleHistory"></div></div>`;
    $('#edmHistoryRefresh')?.addEventListener('click', () => void renderHistory(true));
    return $('#edmVehicleHistory');
  }

  function docButtons(doc, jobId) {
    if (!doc?.path) return '';
    return `<button class="btn btn-ghost" data-open-path="${esc(doc.path)}" type="button">Ouvrir ${esc(doc.label)}</button><button class="btn btn-secondary" data-download-path="${esc(doc.path)}" data-download-name="${esc(doc.filename)}" type="button">Télécharger ${esc(doc.label)}</button>`;
  }

  async function renderHistory(force = false) {
    if (historyLoading && !force) return;
    const host = $('#edmVehicleHistory') || historyShell();
    if (!host) return;
    const user = await currentUser();
    if (!user) {
      host.innerHTML = '<div class="empty">Connectez-vous pour consulter votre historique.</div>';
      return;
    }
    historyLoading = true;
    host.innerHTML = '<div class="notice">Chargement de votre historique…</div>';
    try {
      const [vehicles, orders, quotes, invoices, inspections] = await Promise.all([
        supabaseClient.from('vehicles').select('id,plate,brand,model,year,energy,mileage').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabaseClient.from('repair_orders').select('id,vehicle_id,service_request_id,quote_id,order_number,status,signed_at,created_at,pdf_path,authorized_work').eq('user_id', user.id).eq('visible_to_client', true).order('created_at', { ascending:false }),
        supabaseClient.from('quotes').select('id,vehicle_id,service_request_id,quote_number,status,title,total,pdf_path,created_at').eq('user_id', user.id).eq('visible_to_client', true),
        supabaseClient.from('invoices').select('id,vehicle_id,quote_id,repair_order_id,invoice_number,status,total,pdf_path,issued_at,created_at').eq('user_id', user.id).eq('visible_to_client', true),
        supabaseClient.from('inspection_reports').select('id,vehicle_id,repair_order_id,report_number,status,pdf_path,photo_paths,completed_at,created_at,observations').eq('user_id', user.id).eq('visible_to_client', true)
      ]);
      const error = [vehicles, orders, quotes, invoices, inspections].find((r) => r.error)?.error;
      if (error) throw error;
      const quoteMap = new Map((quotes.data || []).map((q) => [q.id, q]));
      const invoiceByOrder = new Map((invoices.data || []).filter((i) => i.repair_order_id).map((i) => [i.repair_order_id, i]));
      const inspectionByOrder = new Map((inspections.data || []).filter((i) => i.repair_order_id).map((i) => [i.repair_order_id, i]));
      const ordersByVehicle = new Map();
      (orders.data || []).forEach((order) => {
        if (!ordersByVehicle.has(order.vehicle_id)) ordersByVehicle.set(order.vehicle_id, []);
        ordersByVehicle.get(order.vehicle_id).push(order);
      });

      host.innerHTML = (vehicles.data || []).map((vehicle) => {
        const jobs = ordersByVehicle.get(vehicle.id) || [];
        const vehicleTitle = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Véhicule';
        return `<article class="edm-history-vehicle" data-history-vehicle="${esc(vehicle.id)}">
          <button class="edm-full-button" data-history-vehicle-toggle="${esc(vehicle.id)}" type="button"><div class="section-title" style="margin:0"><div><span class="pill blue">${esc(vehicle.plate || 'Sans plaque')}</span><h3 style="margin-top:9px">${esc(vehicleTitle)}</h3><p class="small">${esc([vehicle.year, vehicle.energy, vehicle.mileage ? `${vehicle.mileage} km` : ''].filter(Boolean).join(' · '))}</p></div><strong>${jobs.length} intervention${jobs.length > 1 ? 's' : ''}</strong></div></button>
          <div class="hidden" data-history-vehicle-jobs="${esc(vehicle.id)}" style="padding:0 14px 14px">${jobs.length ? jobs.map((order) => {
            const quote = quoteMap.get(order.quote_id) || (quotes.data || []).find((q) => q.service_request_id && q.service_request_id === order.service_request_id);
            const invoice = invoiceByOrder.get(order.id);
            const inspection = inspectionByOrder.get(order.id);
            const docs = [
              quote?.pdf_path ? { label:'le devis', path:quote.pdf_path, filename:`${quote.quote_number || 'devis'}.pdf` } : null,
              order.pdf_path ? { label:'l’OR', path:order.pdf_path, filename:`${order.order_number || 'OR'}.pdf` } : null,
              inspection?.pdf_path ? { label:'la fiche de contrôle', path:inspection.pdf_path, filename:`${inspection.report_number || 'controle'}.pdf` } : null,
              invoice?.pdf_path ? { label:'la facture', path:invoice.pdf_path, filename:`${invoice.invoice_number || 'facture'}.pdf` } : null
            ].filter(Boolean);
            const photos = Array.isArray(inspection?.photo_paths) ? inspection.photo_paths : [];
            const files = [...docs.map((d) => ({ path:d.path, filename:d.filename })), ...photos.map((path, index) => ({ path, filename:`photo-${index + 1}.jpg` }))];
            return `<article class="edm-history-job" data-history-job="${esc(order.id)}"><button class="edm-full-button" data-history-job-toggle="${esc(order.id)}" type="button"><div class="section-title" style="margin:0"><div><span class="pill">Intervention</span><h3 style="margin-top:9px">${esc(order.order_number || 'Intervention')}</h3><p class="small">${esc(dateTime(order.signed_at || order.created_at))}</p></div><span class="pill green">${esc(order.status || '')}</span></div></button><div class="hidden" data-history-job-detail="${esc(order.id)}" style="padding:0 14px 14px"><div class="summary">${quote ? `<div class="summary-line"><span>Devis</span><strong>${esc(quote.quote_number || '')} · ${esc(money(quote.total))}</strong></div>` : ''}${invoice ? `<div class="summary-line"><span>Facture</span><strong>${esc(invoice.invoice_number || '')} · ${esc(money(invoice.total))}</strong></div>` : ''}${inspection?.observations ? `<div class="summary-line"><span>Observations</span><strong>${esc(inspection.observations)}</strong></div>` : ''}</div><div class="edm-job-tools">${docs.map((d) => docButtons(d, order.id)).join('')}${files.length ? `<button class="btn btn-primary" type="button" data-download-all='${esc(JSON.stringify(files))}'>Tout télécharger</button>` : ''}</div>${photos.length ? `<h3 style="margin-top:18px">Photos</h3><div class="edm-photo-grid">${photos.map((path, index) => `<article class="edm-photo-card" data-photo-card="${index}" data-photo-path="${esc(path)}"><div class="small">Photo ${index + 1}</div><div class="empty" style="margin-top:7px;padding:12px">Cliquer pour afficher</div><div class="btn-row" style="margin-top:8px"><button class="btn btn-ghost" type="button" data-photo-open="${esc(path)}">Ouvrir</button><button class="btn btn-secondary" type="button" data-photo-download="${esc(path)}" data-photo-name="photo-${index + 1}.jpg">Télécharger</button></div></article>`).join('')}</div>` : ''}</div></article>`;
          }).join('') : '<div class="empty">Aucune intervention publiée pour ce véhicule.</div>'}</div>
        </article>`;
      }).join('') || '<div class="empty">Aucun véhicule enregistré.</div>';

      $$('[data-history-vehicle-toggle]', host).forEach((button) => button.addEventListener('click', () => $(`[data-history-vehicle-jobs="${CSS.escape(button.dataset.historyVehicleToggle)}"]`, host)?.classList.toggle('hidden')));
      $$('[data-history-job-toggle]', host).forEach((button) => button.addEventListener('click', () => $(`[data-history-job-detail="${CSS.escape(button.dataset.historyJobToggle)}"]`, host)?.classList.toggle('hidden')));
      $$('[data-open-path]', host).forEach((button) => button.addEventListener('click', () => void openPath(button.dataset.openPath).catch((e) => toast?.(e.message))));
      $$('[data-download-path]', host).forEach((button) => button.addEventListener('click', () => void downloadPath(button.dataset.downloadPath, button.dataset.downloadName).catch((e) => toast?.(e.message))));
      $$('[data-photo-open]', host).forEach((button) => button.addEventListener('click', async () => {
        const card = button.closest('[data-photo-card]');
        const placeholder = $('.empty', card);
        if (card?.querySelector('img')) return openPath(button.dataset.photoOpen);
        try {
          const url = await signedUrl(button.dataset.photoOpen, 300);
          if (placeholder) placeholder.outerHTML = `<img src="${esc(url)}" alt="Photo intervention">`;
        } catch (e) { toast?.(e.message); }
      }));
      $$('[data-photo-download]', host).forEach((button) => button.addEventListener('click', () => void downloadPath(button.dataset.photoDownload, button.dataset.photoName).catch((e) => toast?.(e.message))));
      $$('[data-download-all]', host).forEach((button) => button.addEventListener('click', async () => {
        let files = [];
        try { files = JSON.parse(button.dataset.downloadAll || '[]'); } catch (_) {}
        button.disabled = true;
        const original = button.textContent;
        button.textContent = `Téléchargement 0/${files.length}`;
        try {
          for (let index = 0; index < files.length; index += 1) {
            button.textContent = `Téléchargement ${index + 1}/${files.length}`;
            await downloadPath(files[index].path, files[index].filename);
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        } catch (e) { toast?.(e.message); }
        finally { button.disabled = false; button.textContent = original; }
      }));
      const status = $('#edmHistoryStatus');
      if (status) status.textContent = 'Historique à jour.';
    } catch (error) {
      host.innerHTML = `<div class="errorbox">${esc(error.message || 'Historique indisponible.')}</div>`;
    } finally {
      historyLoading = false;
    }
  }

  function messagesShell() {
    let page = $('#messages');
    if (!page) {
      const about = $('#about');
      if (!about) return null;
      page = document.createElement('section');
      page.id = 'messages';
      page.className = 'page';
      about.before(page);
    }
    page.innerHTML = `<div class="panel"><div class="section-title"><div><h2>Messagerie</h2><p>Votre boîte de réception EDM28.</p></div><div class="btn-row" style="margin:0"><button id="edmComposeMessage" class="btn btn-primary" type="button">Nouveau message</button><button id="edmMailRefresh" class="btn btn-ghost" type="button">Actualiser</button></div></div><div id="edmMailStatus" class="small"></div><div class="edm-mail-layout"><section class="edm-mail-list"><div class="edm-mail-list-head"><strong>Boîte de réception</strong><span id="edmMailCount" class="pill"></span></div><div id="edmMailList" class="edm-mail-scroll"></div></section><section class="edm-mail-reader"><div id="edmMailReader"><div class="empty" style="margin:18px">Cliquez sur un message pour l’ouvrir.</div></div></section></div></div>`;
    $('#edmComposeMessage')?.addEventListener('click', () => renderCompose());
    $('#edmMailRefresh')?.addEventListener('click', () => void loadMailbox(true));
    return page;
  }

  async function relatedDocuments(requestId, userId) {
    if (!requestId) return [];
    const [quotes, orders] = await Promise.all([
      supabaseClient.from('quotes').select('id,quote_number,pdf_path').eq('user_id', userId).eq('service_request_id', requestId).eq('visible_to_client', true),
      supabaseClient.from('repair_orders').select('id,order_number,pdf_path').eq('user_id', userId).eq('service_request_id', requestId).eq('visible_to_client', true)
    ]);
    if (quotes.error) throw quotes.error;
    if (orders.error) throw orders.error;
    const orderIds = (orders.data || []).map((o) => o.id);
    const quoteIds = (quotes.data || []).map((q) => q.id);
    const [invoices, inspections] = await Promise.all([
      orderIds.length || quoteIds.length ? supabaseClient.from('invoices').select('invoice_number,pdf_path,repair_order_id,quote_id').eq('user_id', userId).eq('visible_to_client', true).or([orderIds.length ? `repair_order_id.in.(${orderIds.join(',')})` : '', quoteIds.length ? `quote_id.in.(${quoteIds.join(',')})` : ''].filter(Boolean).join(',')) : Promise.resolve({ data:[], error:null }),
      orderIds.length ? supabaseClient.from('inspection_reports').select('report_number,pdf_path,repair_order_id').eq('user_id', userId).eq('visible_to_client', true).in('repair_order_id', orderIds) : Promise.resolve({ data:[], error:null })
    ]);
    if (invoices.error) throw invoices.error;
    if (inspections.error) throw inspections.error;
    return [
      ...(quotes.data || []).filter((x) => x.pdf_path).map((x) => ({ label:x.quote_number || 'Devis', path:x.pdf_path })),
      ...(orders.data || []).filter((x) => x.pdf_path).map((x) => ({ label:x.order_number || 'Ordre de réparation', path:x.pdf_path })),
      ...(inspections.data || []).filter((x) => x.pdf_path).map((x) => ({ label:x.report_number || 'Fiche de contrôle', path:x.pdf_path })),
      ...(invoices.data || []).filter((x) => x.pdf_path).map((x) => ({ label:x.invoice_number || 'Facture', path:x.pdf_path }))
    ];
  }

  function renderCompose() {
    const reader = $('#edmMailReader');
    if (!reader) return;
    reader.innerHTML = `<div class="edm-mail-reader-head"><strong>Nouveau message</strong><button class="btn btn-ghost" id="edmComposeClose" type="button">Fermer</button></div><div class="edm-compose"><label>Objet<input id="edmComposeSubject" maxlength="160" placeholder="Objet du message"></label><label style="margin-top:12px">Message<textarea id="edmComposeBody" maxlength="4000" rows="10" placeholder="Écrivez votre message à EDM28..."></textarea></label><div class="btn-row"><button id="edmComposeSend" class="btn btn-primary" type="button">Envoyer</button></div><div id="edmComposeStatus" class="small"></div></div>`;
    $('#edmComposeClose')?.addEventListener('click', () => { reader.innerHTML = '<div class="empty" style="margin:18px">Cliquez sur un message pour l’ouvrir.</div>'; });
    $('#edmComposeSend')?.addEventListener('click', async () => {
      const body = $('#edmComposeBody')?.value.trim() || '';
      const subject = $('#edmComposeSubject')?.value.trim() || '';
      if (!body) return ($('#edmComposeStatus').textContent = 'Écrivez un message.');
      const button = $('#edmComposeSend');
      button.disabled = true;
      try {
        const { error } = await supabaseClient.rpc('client_send_message', { p_body:body, p_service_request_id:null, p_subject:subject || null });
        if (error) throw error;
        reader.innerHTML = '<div class="okbox" style="margin:18px">Message envoyé à EDM28.</div>';
        await loadMailbox(true);
      } catch (error) { $('#edmComposeStatus').textContent = error.message || 'Envoi impossible.'; }
      finally { if (button.isConnected) button.disabled = false; }
    });
  }

  async function openMessage(message, userId) {
    const reader = $('#edmMailReader');
    if (!reader) return;
    reader.innerHTML = '<div class="notice" style="margin:18px">Ouverture du message…</div>';
    try {
      const docs = await relatedDocuments(message.service_request_id, userId);
      reader.innerHTML = `<div class="edm-mail-reader-head"><div><strong>${esc(message.subject || 'Message EDM28')}</strong><div class="small">${esc(message.direction === 'inbound' ? 'Vous → EDM28' : 'EDM28 → Vous')} · ${esc(dateTime(message.created_at))}</div></div><button class="btn btn-danger" id="edmDeleteMessage" type="button">Supprimer</button></div><div class="edm-reader-body">${esc(message.body || '')}${docs.length ? `<div style="margin-top:22px"><h3>Pièces jointes / documents liés</h3><div class="edm-job-tools">${docs.map((doc) => `<button class="btn btn-ghost" type="button" data-mail-doc="${esc(doc.path)}">Ouvrir ${esc(doc.label)}</button><button class="btn btn-secondary" type="button" data-mail-download="${esc(doc.path)}" data-mail-name="${esc(doc.label)}.pdf">Télécharger</button>`).join('')}</div></div>` : ''}</div>`;
      $$('[data-mail-doc]', reader).forEach((button) => button.addEventListener('click', () => void openPath(button.dataset.mailDoc).catch((e) => toast?.(e.message))));
      $$('[data-mail-download]', reader).forEach((button) => button.addEventListener('click', () => void downloadPath(button.dataset.mailDownload, button.dataset.mailName).catch((e) => toast?.(e.message))));
      $('#edmDeleteMessage')?.addEventListener('click', async () => {
        if (!window.confirm('Supprimer ce message de votre boîte ?')) return;
        const { data, error } = await supabaseClient.rpc('client_delete_message', { p_message_id:message.id });
        if (error || !data) return toast?.(error?.message || 'Suppression impossible.');
        reader.innerHTML = '<div class="empty" style="margin:18px">Message supprimé de votre boîte.</div>';
        await loadMailbox(true);
      });
      if (message.direction !== 'inbound' && !message.read_by_client) {
        await supabaseClient.rpc('client_mark_messages_read', { p_message_ids:[message.id] }).catch(() => {});
      }
    } catch (error) {
      reader.innerHTML = `<div class="errorbox" style="margin:18px">${esc(error.message || 'Message indisponible.')}</div>`;
    }
  }

  async function loadMailbox(force = false) {
    if (messagesLoading && !force) return;
    messagesShell();
    const list = $('#edmMailList');
    const user = await currentUser();
    if (!user) {
      if (list) list.innerHTML = '<div class="empty">Connectez-vous pour consulter vos messages.</div>';
      return;
    }
    messagesLoading = true;
    if (list) list.innerHTML = '<div class="notice">Chargement…</div>';
    try {
      const { data, error } = await supabaseClient.from('client_messages').select('id,service_request_id,direction,subject,body,channel,read_by_client,read_by_admin,created_at,deleted_by_client_at').eq('user_id', user.id).eq('visible_to_client', true).is('deleted_by_client_at', null).order('created_at', { ascending:false }).limit(100);
      if (error) throw error;
      const messages = data || [];
      $('#edmMailCount').textContent = `${messages.length}`;
      list.innerHTML = messages.length ? messages.map((message) => `<article class="edm-mail-row ${message.direction !== 'inbound' && !message.read_by_client ? 'unread' : ''}" data-mail-id="${esc(message.id)}"><div class="edm-mail-subject"><span>${esc(message.subject || (message.direction === 'inbound' ? 'Message envoyé' : 'Message EDM28'))}</span><span class="small">${esc(new Date(message.created_at).toLocaleDateString('fr-FR'))}</span></div><div class="edm-mail-preview">${esc(message.body || '')}</div></article>`).join('') : '<div class="empty">Aucun message.</div>';
      $$('[data-mail-id]', list).forEach((row) => row.addEventListener('click', () => {
        const message = messages.find((item) => item.id === row.dataset.mailId);
        if (message) void openMessage(message, user.id);
      }));
      $('#edmMailStatus').textContent = 'Boîte à jour.';
    } catch (error) {
      list.innerHTML = `<div class="errorbox">${esc(error.message || 'Messagerie indisponible.')}</div>`;
    } finally { messagesLoading = false; }
  }

  function installNavigationHooks() {
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-page="history"]')) window.setTimeout(() => void renderHistory(true), 20);
      if (event.target.closest('[data-page="messages"]')) window.setTimeout(() => void loadMailbox(true), 20);
      if (event.target.closest('[data-page="about"],[data-jump="about"]')) window.setTimeout(patchHomeAndHelp, 20);
    });
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          window.setTimeout(() => { void renderHistory(true); void loadMailbox(true); }, 30);
        }
      });
    }
  }

  function install() {
    installStyles();
    patchHomeAndHelp();
    historyShell();
    messagesShell();
    installNavigationHooks();
    void renderHistory(true);
    void loadMailbox(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
