(() => {
  const A = () => window.EDMAdmin;
  const esc = (value) => A().esc(value ?? '');
  const statusOptions = ['non_controle','conforme','surveiller','remplacer'];
  const statusLabels = { non_controle:'Non contrôlé', conforme:'Conforme', surveiller:'À surveiller', remplacer:'À remplacer' };

  const essentialControls = [
    { key:'freinage_visuel', label:'Système de freinage accessible - contrôle visuel', unit:'', group:'Freinage' },
    { key:'pression_av_g', label:'Pression pneu avant gauche', unit:'bar', group:'Pression des pneus' },
    { key:'pression_av_d', label:'Pression pneu avant droit', unit:'bar', group:'Pression des pneus' },
    { key:'pression_ar_g', label:'Pression pneu arrière gauche', unit:'bar', group:'Pression des pneus' },
    { key:'pression_ar_d', label:'Pression pneu arrière droit', unit:'bar', group:'Pression des pneus' }
  ];

  const extendedControls = [
    { key:'pneu_av_g', label:'État pneu avant gauche', unit:'mm', group:'Pneumatiques' },
    { key:'pneu_av_d', label:'État pneu avant droit', unit:'mm', group:'Pneumatiques' },
    { key:'pneu_ar_g', label:'État pneu arrière gauche', unit:'mm', group:'Pneumatiques' },
    { key:'pneu_ar_d', label:'État pneu arrière droit', unit:'mm', group:'Pneumatiques' },
    { key:'amortisseurs', label:'Amortisseurs', unit:'', group:'Liaison au sol' },
    { key:'rotules', label:'Rotules', unit:'', group:'Liaison au sol' },
    { key:'silentblocs', label:'Silentblocs', unit:'', group:'Liaison au sol' },
    { key:'roulements', label:'Roulements', unit:'', group:'Liaison au sol' },
    { key:'soufflets', label:'Soufflets et protections', unit:'', group:'Liaison au sol' },
    { key:'liquide_frein', label:'Niveau liquide de frein', unit:'', group:'Niveaux' },
    { key:'niveau_huile_moteur', label:'Niveau huile moteur', unit:'', group:'Niveaux' },
    { key:'niveau_liquide_refroidissement', label:'Niveau liquide de refroidissement', unit:'', group:'Niveaux' },
    { key:'niveau_lave_glace', label:'Niveau lave-glace', unit:'', group:'Niveaux' },
    { key:'essuie_glace_av', label:'Essuie-glaces avant', unit:'', group:'Équipements' },
    { key:'essuie_glace_ar', label:'Essuie-glace arrière', unit:'', group:'Équipements' },
    { key:'klaxon', label:'Klaxon', unit:'', group:'Équipements' },
    { key:'feu_position_av_g', label:'Feu de position avant gauche', unit:'', group:'Éclairage' },
    { key:'feu_position_av_d', label:'Feu de position avant droit', unit:'', group:'Éclairage' },
    { key:'feu_position_ar_g', label:'Feu de position arrière gauche', unit:'', group:'Éclairage' },
    { key:'feu_position_ar_d', label:'Feu de position arrière droit', unit:'', group:'Éclairage' },
    { key:'feu_croisement_g', label:'Feu de croisement gauche', unit:'', group:'Éclairage' },
    { key:'feu_croisement_d', label:'Feu de croisement droit', unit:'', group:'Éclairage' },
    { key:'feu_route_g', label:'Feu de route gauche', unit:'', group:'Éclairage' },
    { key:'feu_route_d', label:'Feu de route droit', unit:'', group:'Éclairage' },
    { key:'feu_stop_g', label:'Feu stop gauche', unit:'', group:'Éclairage' },
    { key:'feu_stop_d', label:'Feu stop droit', unit:'', group:'Éclairage' },
    { key:'feu_stop_central', label:'Troisième feu stop', unit:'', group:'Éclairage' },
    { key:'feu_recul_g', label:'Feu de recul gauche', unit:'', group:'Éclairage' },
    { key:'feu_recul_d', label:'Feu de recul droit', unit:'', group:'Éclairage' },
    { key:'antibrouillard_av_g', label:'Antibrouillard avant gauche', unit:'', group:'Éclairage' },
    { key:'antibrouillard_av_d', label:'Antibrouillard avant droit', unit:'', group:'Éclairage' },
    { key:'antibrouillard_ar', label:'Antibrouillard arrière', unit:'', group:'Éclairage' },
    { key:'eclairage_plaque_g', label:'Éclairage de plaque gauche', unit:'', group:'Éclairage' },
    { key:'eclairage_plaque_d', label:'Éclairage de plaque droit', unit:'', group:'Éclairage' },
    { key:'clignotant_av_g', label:'Clignotant avant gauche', unit:'', group:'Éclairage' },
    { key:'clignotant_av_d', label:'Clignotant avant droit', unit:'', group:'Éclairage' },
    { key:'clignotant_ar_g', label:'Clignotant arrière gauche', unit:'', group:'Éclairage' },
    { key:'clignotant_ar_d', label:'Clignotant arrière droit', unit:'', group:'Éclairage' },
    { key:'repetiteur_g', label:'Répétiteur latéral gauche', unit:'', group:'Éclairage' },
    { key:'repetiteur_d', label:'Répétiteur latéral droit', unit:'', group:'Éclairage' },
    { key:'feux_detresse', label:'Feux de détresse', unit:'', group:'Éclairage' }
  ];

  const controlsFor = (total) => Number(total || 0) >= 100 ? [...essentialControls, ...extendedControls] : essentialControls;
  const levelLabel = (total) => Number(total || 0) >= 100 ? 'Contrôle complet - 100 € TTC et plus' : 'Contrôle essentiel - moins de 100 € TTC';

  async function nextNumber() {
    const { data, error } = await A().db.rpc('next_document_number', { p_type: 'inspection' });
    if (error) throw error;
    return data;
  }

  async function ensureReport(order) {
    const existing = await A().db.from('inspection_reports').select('*').eq('repair_order_id', order.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
    const number = await nextNumber();
    const customer = order.profiles || {};
    const vehicle = order.vehicles || {};
    const quote = order.quotes || {};
    const request = order.service_requests || {};
    const created = await A().db.from('inspection_reports').insert({
      repair_order_id: order.id,
      user_id: order.user_id,
      vehicle_id: order.vehicle_id,
      appointment_id: order.appointment_id || null,
      report_number: number,
      mileage: order.mileage_in ?? vehicle.mileage ?? null,
      customer_request: request.notes || '',
      customer_snapshot: { first_name: customer.first_name, last_name: customer.last_name, email: customer.email, phone: customer.phone },
      vehicle_snapshot: { plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year, energy: vehicle.energy, engine: vehicle.engine, mileage: vehicle.mileage },
      quote_snapshot: { id: quote.id, number: quote.quote_number, title: quote.title, description: quote.description, total: quote.total, control_level: Number(quote.total || 0) >= 100 ? '100_plus' : 'under_100' },
      checks: {}, photo_paths: [], status: 'draft', visible_to_client: false
    }).select('*').single();
    if (created.error) throw created.error;
    return created.data;
  }

  function serviceChecks(order) {
    const values = {};
    const services = Array.isArray(order.service_requests?.services) ? order.service_requests.services : [];
    services.forEach((service) => {
      const id = typeof service === 'string' ? service : service?.id || service?.name || service?.label;
      if (!id) return;
      const key = `service_${String(id).replace(/[^a-z0-9_-]/gi, '_')}`;
      values[key] = { status: 'fait', measure: null, note: 'Prestation terminée avant le contrôle final.' };
    });
    return values;
  }

  function controlEditor(report, controls) {
    const values = report.checks || {};
    let group = '';
    return controls.map((control) => {
      const value = values[control.key] || {};
      const currentStatus = typeof value === 'string' ? value : value.status || 'non_controle';
      const measure = typeof value === 'object' ? value.measure ?? '' : '';
      const note = typeof value === 'object' ? value.note || '' : '';
      const heading = control.group !== group ? `<h3 style="margin-top:18px">${esc(control.group)}</h3>` : '';
      group = control.group;
      return `${heading}<article class="card" data-control="${control.key}" style="padding:12px;margin:8px 0">
        <strong>${esc(control.label)}</strong>
        <div class="toolbar" style="margin-top:8px">${statusOptions.map((status) => `<button type="button" class="btn ${currentStatus === status ? 'primary' : 'ghost'}" data-control-status="${status}">${statusLabels[status]}</button>`).join('')}</div>
        <div class="grid2" style="margin-top:8px">
          ${control.unit ? `<label>Mesure (${control.unit})<input data-control-measure type="number" min="0" step="0.1" value="${esc(measure)}"></label>` : '<div></div>'}
          <label>Observation<input data-control-note value="${esc(note)}" placeholder="Usure, jeu, fuite, valeur relevée…"></label>
        </div>
      </article>`;
    }).join('');
  }

  function readChecks(detail, order) {
    const values = serviceChecks(order);
    detail.querySelectorAll('[data-control]').forEach((row) => {
      const status = row.dataset.status || row.querySelector('[data-control-status].primary')?.dataset.controlStatus || 'non_controle';
      const measureInput = row.querySelector('[data-control-measure]');
      values[row.dataset.control] = {
        status,
        measure: measureInput && measureInput.value !== '' ? Number(measureInput.value) : null,
        note: row.querySelector('[data-control-note]').value.trim() || null
      };
    });
    return values;
  }

  async function uploadFiles(report, files) {
    const paths = [...(Array.isArray(report.photo_paths) ? report.photo_paths : [])];
    for (const file of [...files]) {
      if (!file.type.startsWith('image/')) throw new Error('Seules les images sont autorisées.');
      if (file.size > 8 * 1024 * 1024) throw new Error('Chaque photo doit faire moins de 8 Mo.');
      const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const path = `${report.user_id}/inspection/${report.id}/photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const upload = await A().db.storage.from('repair-documents').upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
      paths.push(path);
    }
    return paths;
  }

  function installSignature(canvas, clearButton) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let signed = false;
    const position = (event) => {
      const rect = canvas.getBoundingClientRect();
      const point = event.touches?.[0] || event;
      return { x: (point.clientX - rect.left) * canvas.width / rect.width, y: (point.clientY - rect.top) * canvas.height / rect.height };
    };
    const start = (event) => { event.preventDefault(); drawing = true; signed = true; const p = position(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (event) => { if (!drawing) return; event.preventDefault(); const p = position(event); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    clearButton.onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); signed = false; };
    return { isSigned: () => signed, blob: () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')) };
  }

  async function uploadSignature(report, signature) {
    if (!signature.isSigned()) return report.signature_path || null;
    const blob = await signature.blob();
    const path = `${report.user_id}/inspection/${report.id}/signature-${Date.now()}.png`;
    const upload = await A().db.storage.from('repair-documents').upload(path, blob, { contentType: 'image/png', upsert: false });
    if (upload.error) throw upload.error;
    return path;
  }

  async function previewPaths(paths, host) {
    host.innerHTML = '';
    for (const path of paths || []) {
      const { data } = await A().db.storage.from('repair-documents').createSignedUrl(path, 180);
      if (!data?.signedUrl) continue;
      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.style.padding = '8px';
      wrap.innerHTML = `<img src="${esc(data.signedUrl)}" alt="Photo contrôle" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px"><button class="btn ghost" type="button" data-remove-photo="${esc(path)}" style="margin-top:8px">Supprimer</button>`;
      host.appendChild(wrap);
    }
  }

  async function publishCompletedReport(order, report) {
    if (!window.EDMAdminDocumentPdf?.generateFor) throw new Error('Le générateur PDF de contrôle est indisponible.');
    const pdfPath = await window.EDMAdminDocumentPdf.generateFor('inspection', report);
    if (!pdfPath) throw new Error('Le PDF de contrôle n’a pas pu être généré.');
    const published = await A().db.from('inspection_reports')
      .update({ visible_to_client: true, updated_at: new Date().toISOString() })
      .eq('id', report.id)
      .eq('status', 'completed')
      .select('id,pdf_path');
    if (published.error || !published.data?.length) throw published.error || new Error('La fiche a changé pendant la publication.');

    const currentChecks = order.workshop_checks && typeof order.workshop_checks === 'object' ? order.workshop_checks : {};
    const completed = await A().db.from('repair_orders')
      .update({
        status: 'completed',
        mileage_in: report.mileage || order.mileage_in || null,
        workshop_checks: {
          ...currentChecks,
          checklist_completed_at: new Date().toISOString(),
          control_level: Number(order.quotes?.total || 0) >= 100 ? '100_plus' : 'under_100'
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .eq('status', 'in_progress')
      .select('id');
    if (completed.error || !completed.data?.length) throw completed.error || new Error('L’intervention a changé pendant la validation du contrôle.');
  }

  function render(rows) {
    const host = A().$('checklistList');
    host.innerHTML = rows.length ? rows.map((order) => {
      const client = [order.profiles?.first_name, order.profiles?.last_name].filter(Boolean).join(' ') || order.profiles?.email || 'Client';
      return `<article class="card" data-order="${order.id}" style="margin:12px 0">
        <div class="top"><div><span class="pill">À contrôler</span><h3>${esc(order.order_number || 'Intervention')}</h3>
        <p>${esc(client)} · ${esc(order.vehicles?.plate || '')}</p></div>
        <div style="text-align:right"><strong>${A().money(order.quotes?.total || 0)}</strong><p class="muted">${esc(levelLabel(order.quotes?.total))}</p></div></div>
        <button class="btn primary" type="button" data-open>Ouvrir la checklist</button>
        <div data-detail class="hidden"></div>
      </article>`;
    }).join('') : '<p class="muted">Aucune checklist en attente.</p>';

    host.querySelectorAll('[data-order]').forEach((card) => card.querySelector('[data-open]').onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const order = rows.find((row) => row.id === card.dataset.order);
        const controls = controlsFor(order.quotes?.total);
        const report = await ensureReport(order);
        const detail = card.querySelector('[data-detail]');
        detail.classList.remove('hidden');
        detail.innerHTML = `<hr><div class="top"><div><h3>${esc(levelLabel(order.quotes?.total))}</h3>
          <p class="muted">Cette liste est choisie automatiquement d’après le montant TTC de la prestation.</p></div><span class="pill">${esc(report.status)}</span></div>
          <div class="grid2"><label>Kilométrage de contrôle<input data-mileage type="number" min="0" value="${report.mileage ?? order.mileage_in ?? ''}"></label><label>Technicien<input data-tech value="${esc(report.technician_name || '')}"></label></div>
          ${controlEditor(report, controls)}
          <h3>Photos du contrôle</h3><label>Ajouter des photos<input data-photo-input type="file" accept="image/*" capture="environment" multiple></label><div data-photo-list class="grid2"></div>
          <h3>Signature</h3><canvas data-signature width="700" height="220" style="width:100%;height:180px;border:1px solid #d0d5dd;border-radius:12px;background:white;touch-action:none"></canvas><button type="button" class="btn ghost" data-clear-signature>Effacer la signature</button>
          <label>Observations générales<textarea data-observations rows="5">${esc(report.observations || '')}</textarea></label>
          <div class="toolbar"><button class="btn ghost" type="button" data-save>Enregistrer le brouillon</button><button class="btn primary" type="button" data-complete>${report.status === 'completed' ? 'Publier le contrôle et terminer' : 'Terminer la checklist'}</button></div>`;

        let photoPaths = Array.isArray(report.photo_paths) ? [...report.photo_paths] : [];
        const photoHost = detail.querySelector('[data-photo-list]');
        await previewPaths(photoPaths, photoHost);
        const signature = installSignature(detail.querySelector('[data-signature]'), detail.querySelector('[data-clear-signature]'));

        detail.querySelectorAll('[data-control-status]').forEach((choice) => choice.onclick = () => {
          const row = choice.closest('[data-control]');
          row.dataset.status = choice.dataset.controlStatus;
          row.querySelectorAll('[data-control-status]').forEach((item) => item.className = `btn ${item === choice ? 'primary' : 'ghost'}`);
        });

        const save = async (complete) => {
          const files = detail.querySelector('[data-photo-input]').files;
          if (files?.length) photoPaths = await uploadFiles(report, files);
          const signaturePath = await uploadSignature(report, signature);
          const checks = readChecks(detail, order);
          const missing = controls.filter((control) => checks[control.key]?.status === 'non_controle');
          if (complete && missing.length) throw new Error(`${missing.length} point(s) sont encore marqués « Non contrôlé ».`);
          const technician = detail.querySelector('[data-tech]').value.trim();
          if (complete && !technician) throw new Error('Le nom du technicien est obligatoire.');
          const patch = {
            mileage: Number(detail.querySelector('[data-mileage]').value) || null,
            technician_name: technician || null,
            observations: detail.querySelector('[data-observations]').value.trim() || null,
            checks,
            photo_paths: photoPaths,
            signature_path: signaturePath,
            updated_at: new Date().toISOString()
          };

          let fresh = report;
          if (report.status !== 'completed') {
            if (complete) Object.assign(patch, { status: 'completed', completed_at: new Date().toISOString(), visible_to_client: false, pdf_path: null });
            const saved = await A().db.from('inspection_reports').update(patch).eq('id', report.id).eq('status', 'draft').select('*').single();
            if (saved.error) throw saved.error;
            fresh = saved.data;
          } else if (!complete) {
            throw new Error('Cette checklist est déjà terminée.');
          }

          if (!complete) {
            A().status('checklistStatus', 'Brouillon de contrôle enregistré.');
            return;
          }
          await publishCompletedReport(order, fresh);
          A().status('checklistStatus', 'Checklist terminée et publiée. Le dossier est maintenant prêt pour la clôture.');
          await load();
          await A().overview();
          window.EDMAdminFinalization?.load();
        };

        detail.querySelector('[data-save]').onclick = () => save(false).catch((error) => A().status('checklistStatus', error.message, true));
        detail.querySelector('[data-complete]').onclick = () => save(true).catch((error) => A().status('checklistStatus', error.message, true));
      } catch (error) {
        A().status('checklistStatus', error.message || 'Checklist indisponible.', true);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function load() {
    const host = A()?.$('checklistList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('repair_orders')
      .select('id,user_id,vehicle_id,appointment_id,service_request_id,order_number,status,mileage_in,workshop_checks,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quotes(id,quote_number,title,description,total),service_requests(notes,services),appointments(starts_at,ends_at,status)')
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = (data || []).filter((order) => Boolean(order.workshop_checks?.intervention_completed_at));
    render(rows);
  }

  function bind() {
    document.querySelector('[data-page="checklist"]')?.addEventListener('click', () => load().catch((error) => A().status('checklistStatus', error.message, true)));
    document.getElementById('checklistRefresh')?.addEventListener('click', () => load().catch((error) => A().status('checklistStatus', error.message, true)));
  }

  window.EDMAdminChecklist = { load, controlsFor };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();