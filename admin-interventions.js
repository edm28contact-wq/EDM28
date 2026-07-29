(() => {
  const A = () => window.EDMAdmin;
  const esc = (v) => A().esc(v ?? '');
  const statusOptions = ['non_controle','conforme','surveiller','remplacer'];
  const statusLabels = { non_controle:'Non contrôlé', conforme:'Conforme', surveiller:'À surveiller', remplacer:'À remplacer' };
  const controls = [
    { key:'plaquettes_av_g', label:'Plaquettes avant gauche', unit:'mm' },
    { key:'plaquettes_av_d', label:'Plaquettes avant droite', unit:'mm' },
    { key:'plaquettes_ar_g', label:'Plaquettes arrière gauche', unit:'mm' },
    { key:'plaquettes_ar_d', label:'Plaquettes arrière droite', unit:'mm' },
    { key:'disque_av_g', label:'Disque avant gauche', unit:'mm' },
    { key:'disque_av_d', label:'Disque avant droit', unit:'mm' },
    { key:'disque_ar_g', label:'Disque arrière gauche', unit:'mm' },
    { key:'disque_ar_d', label:'Disque arrière droit', unit:'mm' },
    { key:'pneu_av_g', label:'Pneu avant gauche', unit:'mm' },
    { key:'pneu_av_d', label:'Pneu avant droit', unit:'mm' },
    { key:'pneu_ar_g', label:'Pneu arrière gauche', unit:'mm' },
    { key:'pneu_ar_d', label:'Pneu arrière droit', unit:'mm' },
    { key:'pression_av_g', label:'Pression avant gauche', unit:'bar' },
    { key:'pression_av_d', label:'Pression avant droite', unit:'bar' },
    { key:'pression_ar_g', label:'Pression arrière gauche', unit:'bar' },
    { key:'pression_ar_d', label:'Pression arrière droite', unit:'bar' },
    { key:'liquide_frein', label:'Liquide de frein', unit:'' },
    { key:'flexibles', label:'Flexibles de frein', unit:'' },
    { key:'amortisseurs', label:'Amortisseurs', unit:'' },
    { key:'rotules', label:'Rotules', unit:'' },
    { key:'silentblocs', label:'Silentblocs', unit:'' },
    { key:'roulements', label:'Roulements', unit:'' },
    { key:'soufflets', label:'Soufflets', unit:'' },
    { key:'geometrie', label:'Géométrie', unit:'' }
  ];

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
      quote_snapshot: { id: quote.id, number: quote.quote_number, title: quote.title, description: quote.description, total: quote.total },
      checks: {}, photo_paths: [], status: 'draft'
    }).select('*').single();
    if (created.error) throw created.error;
    return created.data;
  }

  function controlEditor(report) {
    const values = report.checks || {};
    return controls.map((control) => {
      const value = values[control.key] || {};
      const currentStatus = typeof value === 'string' ? value : value.status || 'non_controle';
      const measure = typeof value === 'object' ? value.measure ?? '' : '';
      const note = typeof value === 'object' ? value.note || '' : '';
      return `<article class="card" data-control="${control.key}" style="padding:12px;margin:8px 0">
        <strong>${esc(control.label)}</strong>
        <div class="toolbar" style="margin-top:8px">${statusOptions.map((status) => `<button type="button" class="btn ${currentStatus === status ? 'primary' : 'ghost'}" data-control-status="${status}">${statusLabels[status]}</button>`).join('')}</div>
        <div class="grid2" style="margin-top:8px">
          ${control.unit ? `<label>Mesure (${control.unit})<input data-control-measure type="number" min="0" step="0.1" value="${esc(measure)}"></label>` : '<div></div>'}
          <label>Observation<input data-control-note value="${esc(note)}" placeholder="Jeu, fuite, usure, cote constructeur…"></label>
        </div>
      </article>`;
    }).join('');
  }

  function readChecks(detail) {
    const values = {};
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
    if (report.signature_path) await A().db.storage.from('repair-documents').remove([report.signature_path]);
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

  function render(rows) {
    const host = A().$('interventionList');
    host.innerHTML = rows.length ? rows.map((order) => `<article class="card" data-order="${order.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${esc(order.status)}</span><h3>${esc(order.order_number || 'Intervention')}</h3><p>${esc([order.profiles?.first_name,order.profiles?.last_name].filter(Boolean).join(' ') || order.profiles?.email || 'Client')} · ${esc([order.vehicles?.brand,order.vehicles?.model,order.vehicles?.plate].filter(Boolean).join(' '))}</p></div><strong>${A().money(order.quotes?.total || 0)}</strong></div><button class="btn primary" data-open="${order.id}">Ouvrir le dossier</button><div data-detail class="hidden"></div></article>`).join('') : '<p class="muted">Aucune intervention active.</p>';
    host.querySelectorAll('[data-open]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try {
        const order = rows.find((row) => row.id === button.dataset.open);
        const report = await ensureReport(order);
        const detail = button.closest('article').querySelector('[data-detail]');
        detail.classList.remove('hidden');
        detail.innerHTML = `<hr><div class="top"><div><h3>${esc(report.report_number)}</h3><p class="muted">Fiche de contrôle mobile</p></div><span class="pill">${esc(report.status)}</span></div>
          <div class="grid2"><p><strong>Client :</strong><br>${esc([order.profiles?.first_name,order.profiles?.last_name].filter(Boolean).join(' '))}<br>${esc(order.profiles?.phone)}<br>${esc(order.profiles?.email)}</p><p><strong>Véhicule :</strong><br>${esc(order.vehicles?.brand)} ${esc(order.vehicles?.model)}<br>${esc(order.vehicles?.plate)} · ${esc(order.vehicles?.mileage || '')} km</p></div>
          <p><strong>Demande :</strong> ${esc(order.service_requests?.notes || 'Non renseignée')}</p>
          <div class="grid2"><label>Kilométrage d’entrée<input data-mileage type="number" min="0" value="${report.mileage ?? ''}"></label><label>Technicien<input data-tech value="${esc(report.technician_name)}"></label></div>
          <h3>Mesures et contrôles</h3>${controlEditor(report)}
          <h3>Photos avant / après</h3><label>Ajouter des photos<input data-photo-input type="file" accept="image/*" capture="environment" multiple></label><div data-photo-list class="grid2"></div>
          <h3>Signature</h3><canvas data-signature width="700" height="220" style="width:100%;height:180px;border:1px solid #d0d5dd;border-radius:12px;background:white;touch-action:none"></canvas><button type="button" class="btn ghost" data-clear-signature>Effacer la signature</button>
          <label>Observations générales<textarea data-observations rows="5">${esc(report.observations)}</textarea></label>
          <div class="toolbar"><button class="btn ghost" data-booking>Ouvrir Google Agenda</button><button class="btn primary" data-save-report>Enregistrer</button><button class="btn primary" data-complete-report>Terminer et publier</button></div>`;
        let photoPaths = Array.isArray(report.photo_paths) ? [...report.photo_paths] : [];
        const photoHost = detail.querySelector('[data-photo-list]');
        await previewPaths(photoPaths, photoHost);
        const bindRemovePhotos = () => photoHost.querySelectorAll('[data-remove-photo]').forEach((remove) => remove.onclick = async () => {
          const path = remove.dataset.removePhoto;
          const storage = await A().db.storage.from('repair-documents').remove([path]);
          if (storage.error) return A().status('interventionStatus', storage.error.message, true);
          photoPaths = photoPaths.filter((item) => item !== path);
          const saved = await A().db.from('inspection_reports').update({ photo_paths: photoPaths, updated_at: new Date().toISOString() }).eq('id', report.id);
          if (saved.error) return A().status('interventionStatus', saved.error.message, true);
          await previewPaths(photoPaths, photoHost); bindRemovePhotos();
        });
        bindRemovePhotos();
        detail.querySelectorAll('[data-control-status]').forEach((choice) => choice.onclick = () => {
          const row = choice.closest('[data-control]');
          row.dataset.status = choice.dataset.controlStatus;
          row.querySelectorAll('[data-control-status]').forEach((button) => button.className = `btn ${button === choice ? 'primary' : 'ghost'}`);
        });
        const signature = installSignature(detail.querySelector('[data-signature]'), detail.querySelector('[data-clear-signature]'));
        detail.querySelector('[data-booking]').onclick = async () => {
          const cfg = await A().db.from('business_configuration').select('booking_url').eq('id', true).single();
          if (cfg.data?.booking_url) window.open(cfg.data.booking_url, '_blank', 'noopener');
          else A().status('interventionStatus', 'Lien Google Agenda non configuré.', true);
        };
        const save = async (complete) => {
          const uploadInput = detail.querySelector('[data-photo-input]');
          if (uploadInput.files?.length) photoPaths = await uploadFiles(report, uploadInput.files);
          const signaturePath = await uploadSignature(report, signature);
          const checks = readChecks(detail);
          const missingControls = controls.filter((control) => checks[control.key]?.status === 'non_controle');
          if (complete && missingControls.length) throw new Error(`${missingControls.length} contrôle(s) sont encore marqués non contrôlés.`);
          if (complete && !detail.querySelector('[data-tech]').value.trim()) throw new Error('Nom du technicien obligatoire avant clôture.');
          const patch = {
            mileage: Number(detail.querySelector('[data-mileage]').value) || null,
            technician_name: detail.querySelector('[data-tech]').value.trim() || null,
            observations: detail.querySelector('[data-observations]').value.trim() || null,
            checks,
            photo_paths: photoPaths,
            signature_path: signaturePath,
            pdf_path: null,
            updated_at: new Date().toISOString()
          };
          if (complete) Object.assign(patch, { status: 'completed', completed_at: new Date().toISOString(), visible_to_client: true });
          const result = await A().db.from('inspection_reports').update(patch).eq('id', report.id).select('id');
          if (result.error) throw result.error;
          if (!result.data?.length) throw new Error('Fiche modifiée par une autre opération.');
          if (complete) await A().db.from('repair_orders').update({ status: 'completed', mileage_in: patch.mileage, updated_at: new Date().toISOString() }).eq('id', order.id).in('status', ['ready','signed','in_progress']);
          A().status('interventionStatus', complete ? 'Contrôle terminé. Générez maintenant son PDF.' : 'Fiche de contrôle enregistrée.');
          await load();
          await A().overview();
        };
        detail.querySelector('[data-save-report]').onclick = () => save(false).catch((error) => A().status('interventionStatus', error.message, true));
        detail.querySelector('[data-complete-report]').onclick = () => save(true).catch((error) => A().status('interventionStatus', error.message, true));
      } catch (error) { A().status('interventionStatus', error.message || 'Dossier indisponible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = A()?.$('interventionList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('repair_orders').select('id,user_id,vehicle_id,appointment_id,order_number,status,mileage_in,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,energy,engine,mileage),quotes(id,quote_number,title,description,total),service_requests(notes,services),appointments(starts_at,ends_at,status)').in('status', ['ready','signed','in_progress','completed','invoiced']).order('updated_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }
  function bind() {
    document.querySelector('[data-page="interventions"]')?.addEventListener('click', () => load().catch((error) => A().status('interventionStatus', error.message, true)));
    document.getElementById('interventionRefresh')?.addEventListener('click', () => load().catch((error) => A().status('interventionStatus', error.message, true)));
  }
  window.EDMAdminInterventions = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();