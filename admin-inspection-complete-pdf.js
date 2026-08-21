(() => {
  if (window.__edmCompleteInspectionPdfInstalled) return;
  window.__edmCompleteInspectionPdfInstalled = true;

  const A = () => window.EDMAdmin;
  const BUCKET = 'repair-documents';
  const RED = [206, 13, 20];
  const DARK = [22, 27, 34];
  const MUTED = [100, 108, 120];
  const LIGHT = [244, 246, 248];
  const BLUE = [224, 234, 247];

  const controlMeta = {
    plaquettes_av_g: ['Freinage', 'Plaquettes avant gauche', 'mm'],
    plaquettes_av_d: ['Freinage', 'Plaquettes avant droite', 'mm'],
    plaquettes_ar_g: ['Freinage', 'Plaquettes arrière gauche', 'mm'],
    plaquettes_ar_d: ['Freinage', 'Plaquettes arrière droite', 'mm'],
    disque_av_g: ['Freinage', 'Disque avant gauche', 'mm'],
    disque_av_d: ['Freinage', 'Disque avant droit', 'mm'],
    disque_ar_g: ['Freinage', 'Disque arrière gauche', 'mm'],
    disque_ar_d: ['Freinage', 'Disque arrière droit', 'mm'],
    liquide_frein: ['Contrôles complémentaires - niveaux', 'Niveau liquide de frein', ''],
    flexibles: ['Freinage', 'Flexibles de frein', ''],
    pneu_av_g: ['Pneumatiques - état', 'Pneu avant gauche', 'mm'],
    pneu_av_d: ['Pneumatiques - état', 'Pneu avant droit', 'mm'],
    pneu_ar_g: ['Pneumatiques - état', 'Pneu arrière gauche', 'mm'],
    pneu_ar_d: ['Pneumatiques - état', 'Pneu arrière droit', 'mm'],
    pression_av_g: ['Contrôles complémentaires - pression des pneus', 'Pression avant gauche', 'bar'],
    pression_av_d: ['Contrôles complémentaires - pression des pneus', 'Pression avant droite', 'bar'],
    pression_ar_g: ['Contrôles complémentaires - pression des pneus', 'Pression arrière gauche', 'bar'],
    pression_ar_d: ['Contrôles complémentaires - pression des pneus', 'Pression arrière droite', 'bar'],
    amortisseurs: ['Liaison au sol', 'Amortisseurs', ''],
    rotules: ['Liaison au sol', 'Rotules', ''],
    silentblocs: ['Liaison au sol', 'Silentblocs', ''],
    roulements: ['Liaison au sol', 'Roulements', ''],
    soufflets: ['Liaison au sol', 'Soufflets', ''],
    geometrie: ['Liaison au sol', 'Géométrie', ''],
    niveau_huile_moteur: ['Contrôles complémentaires - niveaux', 'Niveau huile moteur', ''],
    niveau_liquide_refroidissement: ['Contrôles complémentaires - niveaux', 'Niveau liquide de refroidissement', ''],
    niveau_lave_glace: ['Contrôles complémentaires - niveaux', 'Niveau lave-glace', ''],
    essuie_glace_av: ['Contrôles complémentaires - équipements et éclairage', 'Essuie-glaces avant', ''],
    essuie_glace_ar: ['Contrôles complémentaires - équipements et éclairage', 'Essuie-glace arrière', ''],
    klaxon: ['Contrôles complémentaires - équipements et éclairage', 'Klaxon', ''],
    feu_position_av_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu de position avant gauche', ''],
    feu_position_av_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu de position avant droit', ''],
    feu_position_ar_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu de position arrière gauche', ''],
    feu_position_ar_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu de position arrière droit', ''],
    feu_croisement_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu de croisement gauche', ''],
    feu_croisement_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu de croisement droit', ''],
    feu_route_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu de route gauche', ''],
    feu_route_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu de route droit', ''],
    feu_stop_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu stop gauche', ''],
    feu_stop_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu stop droit', ''],
    feu_stop_central: ['Contrôles complémentaires - équipements et éclairage', 'Troisième feu stop', ''],
    feu_recul_g: ['Contrôles complémentaires - équipements et éclairage', 'Feu de recul gauche', ''],
    feu_recul_d: ['Contrôles complémentaires - équipements et éclairage', 'Feu de recul droit', ''],
    antibrouillard_av_g: ['Contrôles complémentaires - équipements et éclairage', 'Antibrouillard avant gauche', ''],
    antibrouillard_av_d: ['Contrôles complémentaires - équipements et éclairage', 'Antibrouillard avant droit', ''],
    antibrouillard_ar: ['Contrôles complémentaires - équipements et éclairage', 'Antibrouillard arrière', ''],
    eclairage_plaque_g: ['Contrôles complémentaires - équipements et éclairage', 'Éclairage de plaque gauche', ''],
    eclairage_plaque_d: ['Contrôles complémentaires - équipements et éclairage', 'Éclairage de plaque droit', ''],
    clignotant_av_g: ['Contrôles complémentaires - équipements et éclairage', 'Clignotant avant gauche', ''],
    clignotant_av_d: ['Contrôles complémentaires - équipements et éclairage', 'Clignotant avant droit', ''],
    clignotant_ar_g: ['Contrôles complémentaires - équipements et éclairage', 'Clignotant arrière gauche', ''],
    clignotant_ar_d: ['Contrôles complémentaires - équipements et éclairage', 'Clignotant arrière droit', ''],
    repetiteur_g: ['Contrôles complémentaires - équipements et éclairage', 'Répétiteur latéral gauche', ''],
    repetiteur_d: ['Contrôles complémentaires - équipements et éclairage', 'Répétiteur latéral droit', ''],
    feux_detresse: ['Contrôles complémentaires - équipements et éclairage', 'Feux de détresse', '']
  };

  const serviceControlMap = {
    FR_PLAQ_AV: ['plaquettes_av_g', 'plaquettes_av_d'],
    FR_PLAQ_AR: ['plaquettes_ar_g', 'plaquettes_ar_d'],
    FR_PLAQ_AV_AR: ['plaquettes_av_g', 'plaquettes_av_d', 'plaquettes_ar_g', 'plaquettes_ar_d'],
    FR_DISC_PLAQ_AV: ['disque_av_g', 'disque_av_d', 'plaquettes_av_g', 'plaquettes_av_d'],
    FR_DISC_PLAQ_AR: ['disque_ar_g', 'disque_ar_d', 'plaquettes_ar_g', 'plaquettes_ar_d'],
    FR_DISC_PLAQ_AV_AR: ['disque_av_g', 'disque_av_d', 'disque_ar_g', 'disque_ar_d', 'plaquettes_av_g', 'plaquettes_av_d', 'plaquettes_ar_g', 'plaquettes_ar_d'],
    FR_PURGE: ['liquide_frein']
  };

  const statusLabels = {
    non_controle: 'Non contrôlé',
    conforme: 'Conforme',
    non_conforme: 'Non conforme',
    surveiller: 'À surveiller',
    remplacer: 'À remplacer',
    a_faire: 'À faire',
    fait: 'Fait',
    todo: 'À faire',
    done: 'Fait',
    replace: 'À remplacer',
    ok: 'Conforme',
    action: 'À corriger'
  };

  const groupOrder = [
    'Prestations EDM28',
    'Freinage',
    'Pneumatiques - état',
    'Liaison au sol',
    'Contrôles complémentaires - niveaux',
    'Contrôles complémentaires - pression des pneus',
    'Contrôles complémentaires - équipements et éclairage',
    'Autres contrôles'
  ];

  const fmtDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  };

  const humanize = (key) => String(key || '').replace(/^service_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const valueOf = (value) => value && typeof value === 'object' ? value : { status: value };

  async function one(table, id) {
    if (!id) return null;
    const result = await A().db.from(table).select('*').eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function completeData(seed) {
    const report = await one('inspection_reports', seed?.id) || seed;
    if (!report?.id) throw new Error('Fiche de contrôle introuvable.');
    const order = await one('repair_orders', report.repair_order_id);
    const [profile, vehicle, request, cfg] = await Promise.all([
      one('profiles', report.user_id || order?.user_id),
      one('vehicles', report.vehicle_id || order?.vehicle_id),
      one('service_requests', order?.service_request_id),
      A().db.from('business_configuration').select('*').eq('id', true).single().then((result) => {
        if (result.error) throw result.error;
        return result.data || {};
      })
    ]);
    return {
      report,
      order: order || {},
      profile: profile || report.customer_snapshot || {},
      vehicle: vehicle || report.vehicle_snapshot || {},
      request: request || {},
      cfg
    };
  }

  function serviceNames(request) {
    return (Array.isArray(request?.services) ? request.services : []).map((service) => ({
      id: String(service?.id || ''),
      name: String(service?.name || service?.label || service?.id || 'Prestation')
    })).filter((service) => service.id || service.name);
  }

  function hiddenCompletedControls(checks, request) {
    const hidden = new Set();
    for (const service of serviceNames(request)) {
      const key = `service_${service.id.replace(/[^a-z0-9_-]/gi, '_')}`;
      const status = valueOf(checks?.[key]).status;
      if (status === 'fait' || status === 'done') {
        (serviceControlMap[service.id] || []).forEach((controlKey) => hidden.add(controlKey));
      }
    }
    return hidden;
  }

  function groupedChecks(checks, request) {
    const serviceMap = new Map(serviceNames(request).map((service) => [`service_${service.id.replace(/[^a-z0-9_-]/gi, '_')}`, service]));
    const hidden = hiddenCompletedControls(checks, request);
    const groups = new Map(groupOrder.map((name) => [name, []]));

    Object.entries(checks || {}).forEach(([key, raw]) => {
      if (hidden.has(key)) return;
      const value = valueOf(raw);
      const service = serviceMap.get(key);
      let group;
      let label;
      let unit = '';
      if (service) {
        group = 'Prestations EDM28';
        label = service.name;
      } else if (controlMeta[key]) {
        [group, label, unit] = controlMeta[key];
      } else {
        group = 'Autres contrôles';
        label = humanize(key);
      }
      if (!groups.has(group)) groups.set(group, []);
      const status = statusLabels[value.status] || humanize(value.status || 'non renseigné');
      const measure = value.measure === null || value.measure === undefined || value.measure === '' ? '' : `${value.measure}${unit ? ` ${unit}` : ''}`;
      const note = String(value.note || '').trim();
      groups.get(group).push([label, status, measure, note]);
    });

    for (const service of serviceNames(request)) {
      const key = `service_${service.id.replace(/[^a-z0-9_-]/gi, '_')}`;
      if (!Object.prototype.hasOwnProperty.call(checks || {}, key)) {
        groups.get('Prestations EDM28').push([service.name, 'À faire', '', '']);
      }
    }

    return groups;
  }

  function drawHeader(doc, data, subtitle = '') {
    const { cfg, report } = data;
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('EDM', 14, 16);
    doc.setTextColor(...RED);
    doc.text('28', 29, 16);
    doc.setTextColor(...DARK);
    doc.setFontSize(17);
    doc.text('FICHE DE CONTRÔLE', 105, 16, { align: 'center' });
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.8);
    doc.line(14, 21, 196, 21);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(String(cfg.business_name || cfg.legal_name || 'EDM28'), 14, 27);
    doc.text(String(report.report_number || ''), 196, 27, { align: 'right' });
    if (subtitle) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.setFontSize(9);
      doc.text(subtitle, 14, 34);
    }
  }

  function footer(doc, data) {
    const pages = doc.getNumberOfPages();
    const cfg = data.cfg || {};
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.3);
      doc.line(14, 286, 196, 286);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const contact = [cfg.phone, cfg.email, cfg.website].filter(Boolean).join(' - ');
      doc.text(`${cfg.business_name || 'EDM28'}${contact ? ` - ${contact}` : ''}`, 14, 291);
      doc.text(`Page ${i}/${pages}`, 196, 291, { align: 'right' });
    }
  }

  function infoBlock(doc, data) {
    const { report, order, profile, vehicle, request } = data;
    const client = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Client';
    const vehicleName = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ');
    const rows = [
      ['Date du contrôle', fmtDate(report.completed_at || report.created_at), 'Technicien', report.technician_name || ''],
      ['Client', client, 'Téléphone', profile.phone || ''],
      ['Véhicule', vehicleName, 'Immatriculation', vehicle.plate || ''],
      ['Kilométrage', report.mileage != null ? `${Number(report.mileage).toLocaleString('fr-FR')} km` : '', 'Ordre de réparation', order.order_number || '']
    ];
    doc.autoTable({
      startY: 38,
      body: rows,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2.4, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.2 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 32 }, 1: { cellWidth: 58 }, 2: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 32 }, 3: { cellWidth: 58 } }
    });
    let y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Demande client / travaux prévus', 14, y);
    y += 4;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(14, y, 182, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const requested = serviceNames(request).map((service) => service.name).join(', ');
    const requestText = [request.notes, requested ? `Prestations : ${requested}` : '', report.customer_request].filter(Boolean).join(' - ');
    const lines = doc.splitTextToSize(requestText || 'Aucune précision complémentaire.', 174).slice(0, 5);
    doc.text(lines, 18, y + 6);
    return y + 28;
  }

  function drawControlTables(doc, data, startY) {
    const groups = groupedChecks(data.report.checks || {}, data.request);
    let y = startY;
    for (const groupName of groupOrder) {
      const rows = groups.get(groupName) || [];
      if (!rows.length) continue;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      if (y > 255) {
        doc.addPage();
        drawHeader(doc, data, 'Contrôles - suite');
        y = 40;
      }
      doc.text(groupName, 14, y);
      doc.autoTable({
        startY: y + 3,
        head: [['Point contrôlé', 'Statut', 'Mesure', 'Observation']],
        body: rows,
        theme: 'grid',
        margin: { left: 14, right: 14, bottom: 18 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.2, textColor: DARK, lineColor: [210, 214, 220], lineWidth: 0.2, valign: 'middle' },
        headStyles: { fillColor: BLUE, textColor: DARK, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 31, halign: 'center' }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 60 } },
        didDrawPage: () => {
          if (doc.lastAutoTable?.pageNumber > 1) drawHeader(doc, data, 'Contrôles - suite');
        }
      });
      y = doc.lastAutoTable.finalY + 7;
    }
    return y;
  }

  function ensureSpace(doc, data, y, needed, subtitle = 'Synthèse') {
    if (y + needed <= 278) return y;
    doc.addPage();
    drawHeader(doc, data, subtitle);
    return 42;
  }

  async function fileBlob(path) {
    const direct = await A().db.storage.from(BUCKET).download(path);
    if (!direct.error && direct.data) return direct.data;
    const signed = await A().db.storage.from(BUCKET).createSignedUrl(path, 300);
    if (signed.error || !signed.data?.signedUrl) throw direct.error || signed.error || new Error('Image inaccessible.');
    const response = await fetch(signed.data.signedUrl);
    if (!response.ok) throw new Error(`Image inaccessible (${response.status}).`);
    return response.blob();
  }

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Lecture image impossible.'));
    reader.readAsDataURL(blob);
  });

  async function imageData(path) {
    const blob = await fileBlob(path);
    const dataUrl = await blobToDataUrl(blob);
    let width = 4;
    let height = 3;
    try {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width || width;
      height = bitmap.height || height;
      bitmap.close?.();
    } catch {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { width = img.naturalWidth || width; height = img.naturalHeight || height; resolve(); };
        img.onerror = resolve;
        img.src = dataUrl;
      });
    }
    const type = String(blob.type || '').toLowerCase().includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, width, height, type };
  }

  function fitImage(image, boxX, boxY, boxW, boxH) {
    const ratio = Math.min(boxW / image.width, boxH / image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
  }

  async function addSummaryAndSignature(doc, data, y) {
    const report = data.report;
    y = ensureSpace(doc, data, y, report.signature_path ? 62 : 45, 'Synthèse');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.text('Observations générales', 14, y);
    y += 4;
    const observationLines = doc.splitTextToSize(report.observations || 'Aucune observation générale.', 174);
    const observationHeight = Math.max(22, Math.min(52, observationLines.length * 4.2 + 8));
    doc.setFillColor(...LIGHT);
    doc.roundedRect(14, y, 182, observationHeight, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(observationLines.slice(0, 10), 18, y + 6);
    y += observationHeight + 7;

    if (report.signature_path) {
      y = ensureSpace(doc, data, y, 45, 'Signature');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Signature numérique', 14, y);
      try {
        const signature = await imageData(report.signature_path);
        const box = fitImage(signature, 14, y + 4, 75, 32);
        doc.setDrawColor(200, 204, 210);
        doc.rect(14, y + 4, 75, 32);
        doc.addImage(signature.dataUrl, signature.type, box.x, box.y, box.w, box.h, undefined, 'FAST');
      } catch (error) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Signature enregistrée mais non intégrable : ${error.message}`, 14, y + 10);
      }
      y += 42;
    }
    return y;
  }

  async function addPhotos(doc, data) {
    const paths = Array.isArray(data.report.photo_paths) ? data.report.photo_paths : [];
    if (!paths.length) return;
    const images = [];
    for (let i = 0; i < paths.length; i += 1) {
      try {
        images.push({ index: i + 1, ...(await imageData(paths[i])) });
      } catch (error) {
        images.push({ index: i + 1, error: error.message });
      }
    }

    for (let offset = 0; offset < images.length; offset += 2) {
      doc.addPage();
      drawHeader(doc, data, 'Photos du contrôle');
      const batch = images.slice(offset, offset + 2);
      const boxes = batch.length === 1
        ? [{ x: 18, y: 45, w: 174, h: 215 }]
        : [{ x: 18, y: 45, w: 174, h: 103 }, { x: 18, y: 158, w: 174, h: 103 }];
      batch.forEach((image, index) => {
        const box = boxes[index];
        doc.setDrawColor(190, 195, 202);
        doc.rect(box.x, box.y, box.w, box.h);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...DARK);
        doc.text(`Photo ${image.index}`, box.x + 3, box.y + 5);
        if (image.error) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          doc.text(doc.splitTextToSize(`Photo enregistrée mais non intégrable : ${image.error}`, box.w - 10), box.x + 5, box.y + 15);
          return;
        }
        const fitted = fitImage(image, box.x + 4, box.y + 9, box.w - 8, box.h - 13);
        doc.addImage(image.dataUrl, image.type, fitted.x, fitted.y, fitted.w, fitted.h, undefined, 'FAST');
      });
    }
  }

  async function buildBlob(seed) {
    const data = await completeData(seed);
    if (!window.jspdf?.jsPDF) throw new Error('Le moteur PDF complet n’est pas chargé. Rechargez le back-office.');
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    if (typeof doc.autoTable !== 'function') throw new Error('Le moteur de tableaux PDF n’est pas chargé. Rechargez le back-office.');

    drawHeader(doc, data);
    let y = infoBlock(doc, data);
    y = drawControlTables(doc, data, y);
    await addSummaryAndSignature(doc, data, y);
    await addPhotos(doc, data);
    footer(doc, data);
    return { blob: doc.output('blob'), data };
  }

  async function generateInspection(seed) {
    const { blob, data } = await buildBlob(seed);
    const report = data.report;
    const path = `${report.user_id}/inspection/${report.id}-${Date.now()}-complete.pdf`;
    const upload = await A().db.storage.from(BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
    const saved = await A().db.from('inspection_reports').update({ pdf_path: path, updated_at: new Date().toISOString() }).eq('id', report.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from(BUCKET).remove([path]);
      throw saved.error || new Error('La fiche a changé pendant la génération.');
    }
    if (report.pdf_path && report.pdf_path !== path) A().db.storage.from(BUCKET).remove([report.pdf_path]).catch(() => {});
    return path;
  }

  function installGenerateOverride() {
    const api = window.EDMAdminDocumentPdf;
    if (!api?.generateFor || api.generateFor.__completeInspectionWrapped) return Boolean(api?.generateFor?.__completeInspectionWrapped);
    const original = api.generateFor.bind(api);
    const wrapped = async (type, row) => type === 'inspection' ? generateInspection(row) : original(type, row);
    wrapped.__completeInspectionWrapped = true;
    api.generateFor = wrapped;
    return true;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('#documentPdfList [data-type="inspection"][data-id]');
    if (!button || !A()?.profile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Génération complète…';
    try {
      await generateInspection({ id: button.dataset.id });
      A().status('documentPdfStatus', 'Fiche de contrôle complète régénérée avec tous les contrôles, la signature et les photos.');
      await window.EDMAdminDocumentPdf?.load?.();
    } catch (error) {
      A().status('documentPdfStatus', error.message || 'Génération complète impossible.', true);
      button.disabled = false;
      button.textContent = originalText;
    }
  }, true);

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installGenerateOverride() || attempts > 100) window.clearInterval(timer);
  }, 100);
})();
