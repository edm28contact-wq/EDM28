(() => {
  if (window.__edmPersonalizedOrderPdfInstalled) return;
  window.__edmPersonalizedOrderPdfInstalled = true;

  const A = () => window.EDMAdmin;
  const clean = (value) => String(value ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const dateTime = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const date = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleDateString('fr-FR');
  };
  const serviceNames = (request) => (Array.isArray(request?.services) ? request.services : [])
    .map((service) => typeof service === 'string' ? service : service?.name || service?.label || service?.id)
    .filter(Boolean);
  const itemType = (value) => ({ labor: 'Main-d’œuvre', part: 'Pièce', delivery: 'Livraison', other: 'Autre' }[value] || 'Prestation');

  async function one(table, id) {
    if (!id) return null;
    const result = await A().db.from(table).select('*').eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function many(table, foreignKey, id) {
    if (!id) return [];
    const result = await A().db.from(table).select('*').eq(foreignKey, id).order('display_order', { ascending: true });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function business() {
    const result = await A().db.from('business_configuration').select('*').eq('id', true).single();
    if (result.error) throw result.error;
    return result.data || {};
  }

  async function hydrate(seed) {
    const base = await one('repair_orders', seed?.id) || seed || {};
    const [profile, vehicle, request, appointment, quote] = await Promise.all([
      one('profiles', base.user_id),
      one('vehicles', base.vehicle_id),
      one('service_requests', base.service_request_id),
      one('appointments', base.appointment_id),
      one('quotes', base.quote_id)
    ]);
    const quoteItems = base.quote_id ? await many('quote_items', 'quote_id', base.quote_id) : [];
    return {
      ...base,
      profiles: profile,
      vehicles: vehicle,
      service_requests: request,
      appointments: appointment,
      quotes: quote,
      quote_items: quoteItems
    };
  }

  function fallbackRows(row) {
    const works = Array.isArray(row.authorized_work) ? row.authorized_work : [];
    return works.map((work, index) => {
      if (typeof work === 'string') {
        return {
          item_type: 'labor',
          designation: work,
          description: index === 0 ? row.quotes?.description || '' : '',
          quantity: 1,
          supplier_reference: '',
          unit_price: 0,
          vat_rate: 0
        };
      }
      return {
        item_type: work.item_type || 'other',
        designation: work.designation || work.name || work.description || `Travail ${index + 1}`,
        description: work.description || '',
        quantity: Number(work.quantity || 1),
        supplier_reference: work.supplier_reference || '',
        unit_price: Number(work.unit_price || 0),
        vat_rate: Number(work.vat_rate || 0)
      };
    });
  }

  function orderRows(row) {
    const source = Array.isArray(row.quote_items) && row.quote_items.length ? row.quote_items : fallbackRows(row);
    return source.map((item, index) => {
      const quantity = Number(item.quantity || 1);
      const unit = Number(item.unit_price || 0);
      const vat = Number(item.vat_rate || 0);
      return {
        type: itemType(item.item_type),
        designation: clean(item.designation || item.name || item.description || `Ligne ${index + 1}`),
        detail: clean(item.description || ''),
        quantity,
        reference: clean(item.supplier_reference || ''),
        total: quantity * unit * (1 + vat / 100)
      };
    });
  }

  function drawBox(doc, x, y, w, h, title, lines) {
    doc.setDrawColor(185, 190, 197);
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(x, y, w, h, 5, 5, 'FD');
    doc.setTextColor(28, 32, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, x + 10, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let cursor = y + 31;
    lines.filter(Boolean).forEach((line) => {
      const wrapped = doc.splitTextToSize(clean(line), w - 20).slice(0, 2);
      doc.text(wrapped, x + 10, cursor);
      cursor += wrapped.length * 10 + 2;
    });
  }

  function buildOrderPdf(row, cfg) {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('Le moteur PDF jsPDF n’est pas chargé.');
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    if (typeof doc.autoTable !== 'function') throw new Error('Le moteur de tableau PDF n’est pas chargé.');

    const profile = row.profiles || {};
    const vehicle = row.vehicles || {};
    const request = row.service_requests || {};
    const quote = row.quotes || {};
    const appointment = row.appointments || {};
    const rows = orderRows(row);
    const company = clean(cfg.business_name || cfg.legal_name || 'EDM28');
    const companyAddress = [cfg.address_line1, cfg.address_line2, [cfg.postal_code, cfg.city].filter(Boolean).join(' '), cfg.country].filter(Boolean).join(' - ');
    const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.company_name || profile.email || 'Client';
    const vehicleName = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Véhicule';
    const totalAuthorized = Number(quote.total || rows.reduce((sum, item) => sum + item.total, 0));
    const requestText = [quote.description, request.notes, serviceNames(request).join(' · ')].map(clean).filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).join(' — ');

    doc.setTextColor(23, 27, 33);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('EDM', 32, 43);
    doc.setTextColor(210, 13, 22);
    doc.text('28', 82, 43);
    doc.setTextColor(23, 27, 33);
    doc.setFontSize(7);
    doc.text('MÉCANIQUE · DIAGNOSTIC · SERVICES', 32, 56);

    doc.setFontSize(18);
    doc.text('ORDRE DE RÉPARATION', 563, 40, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`N° ${clean(row.order_number || 'Non attribué')}`, 563, 55, { align: 'right' });
    doc.text(`Devis accepté : ${clean(quote.quote_number || 'Non renseigné')}`, 563, 68, { align: 'right' });

    doc.setDrawColor(210, 13, 22);
    doc.setLineWidth(1.2);
    doc.line(32, 78, 563, 78);

    doc.setTextColor(60, 64, 70);
    doc.setFontSize(7.5);
    const legal = [company, companyAddress, cfg.phone, cfg.email, cfg.siret ? `SIRET ${cfg.siret}` : ''].filter(Boolean).join(' · ');
    doc.text(doc.splitTextToSize(legal, 531), 32, 94);

    drawBox(doc, 32, 116, 255, 92, 'CLIENT', [
      customerName,
      profile.address || profile.address_line1 || '',
      profile.phone ? `Tél. : ${profile.phone}` : '',
      profile.email ? `E-mail : ${profile.email}` : ''
    ]);
    drawBox(doc, 308, 116, 255, 92, 'VÉHICULE', [
      `${vehicleName}${vehicle.plate ? ` · ${vehicle.plate}` : ''}`,
      vehicle.vin ? `VIN : ${vehicle.vin}` : vehicle.serial_number ? `N° série : ${vehicle.serial_number}` : '',
      row.mileage_in != null ? `Kilométrage entrée : ${Number(row.mileage_in).toLocaleString('fr-FR')} km` : vehicle.mileage != null ? `Kilométrage : ${Number(vehicle.mileage).toLocaleString('fr-FR')} km` : '',
      appointment.starts_at ? `Rendez-vous : ${dateTime(appointment.starts_at)}` : ''
    ]);

    doc.setTextColor(23, 27, 33);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TRAVAUX ET PIÈCES AUTORISÉS PAR LE DEVIS ACCEPTÉ', 32, 231);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(78, 82, 88);
    doc.text(`Cet OR reprend le contenu du devis ${clean(quote.quote_number || '')}. Toute ligne supplémentaire nécessite un nouvel accord client.`, 32, 244);

    doc.autoTable({
      startY: 255,
      margin: { left: 32, right: 32 },
      head: [['Type', 'Désignation', 'Détail', 'Qté', 'Référence', 'Montant']],
      body: rows.length ? rows.map((item) => [
        item.type,
        item.designation,
        item.detail || '—',
        Number(item.quantity).toLocaleString('fr-FR'),
        item.reference || '—',
        money(item.total)
      ]) : [['Prestation', quote.description || 'Travaux selon devis accepté', '—', '1', '—', money(totalAuthorized)]],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 4, valign: 'middle', textColor: [35, 38, 43], lineColor: [206, 210, 216], lineWidth: 0.45 },
      headStyles: { fillColor: [31, 35, 41], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 112 },
        2: { cellWidth: 150 },
        3: { cellWidth: 36, halign: 'center' },
        4: { cellWidth: 75 },
        5: { cellWidth: 77, halign: 'right' }
      }
    });

    let y = doc.lastAutoTable.finalY + 16;
    if (y > 600) {
      doc.addPage();
      y = 42;
    }

    doc.setTextColor(23, 27, 33);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DEMANDE CLIENT / PÉRIMÈTRE DE L’INTERVENTION', 32, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const requestLines = doc.splitTextToSize(requestText || 'Travaux conformément au devis accepté.', 531).slice(0, 4);
    doc.text(requestLines, 32, y + 13);
    y += 18 + requestLines.length * 9;

    doc.setFillColor(248, 248, 249);
    doc.setDrawColor(205, 209, 215);
    doc.roundedRect(32, y, 531, 53, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('MONTANT AUTORISÉ', 44, y + 17);
    doc.setTextColor(210, 13, 22);
    doc.setFontSize(15);
    doc.text(money(totalAuthorized), 551, y + 20, { align: 'right' });
    doc.setTextColor(50, 54, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.text(`Selon devis ${clean(quote.quote_number || '')} accepté${quote.updated_at ? ` le ${date(quote.updated_at)}` : ''}.`, 44, y + 37);
    y += 68;

    const conditionText = 'Aucun travail ni remplacement non listé ci-dessus ne doit être exécuté sans accord préalable du client. Toute découverte pendant l’intervention fait l’objet d’une information et, si nécessaire, d’un devis complémentaire.';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 27, 33);
    doc.text('CONDITIONS ET MODIFICATIONS', 32, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(doc.splitTextToSize(conditionText, 531), 32, y + 13);
    if (row.visible_condition || row.customer_items) {
      doc.setFontSize(7.2);
      doc.text(doc.splitTextToSize(`Observations à l’entrée : ${clean(row.visible_condition || row.customer_items)}`, 531), 32, y + 37);
    }
    y += 63;

    if (y > 690) {
      doc.addPage();
      y = 48;
    }
    doc.setDrawColor(150, 155, 162);
    doc.rect(32, y, 255, 95);
    doc.rect(308, y, 255, 95);
    doc.setFillColor(241, 242, 244);
    doc.rect(32, y, 255, 22, 'F');
    doc.rect(308, y, 255, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 27, 33);
    doc.text('ACCEPTATION DU CLIENT', 159.5, y + 14, { align: 'center' });
    doc.text('VISA EDM28', 435.5, y + 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.text('Je confirme les travaux et le montant ci-dessus.', 43, y + 40);
    doc.text('Nom / signature :', 43, y + 63);
    doc.text(`Réception prévue : ${appointment.starts_at ? dateTime(appointment.starts_at) : date(row.created_at)}`, 319, y + 40);
    doc.text('Nom / signature :', 319, y + 63);

    const pageCount = doc.getNumberOfPages();
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      doc.setPage(pageNo);
      doc.setDrawColor(220, 222, 226);
      doc.line(32, 812, 563, 812);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(105, 108, 113);
      doc.text(`${company} · OR ${clean(row.order_number || '')} · page ${pageNo}/${pageCount}`, 32, 826);
      doc.text('Ordre de réparation personnalisé à partir du devis accepté.', 563, 826, { align: 'right' });
    }

    return doc.output('blob');
  }

  async function generatePersonalizedOrder(seed) {
    if (!seed?.id) throw new Error('Ordre de réparation introuvable.');
    const [row, cfg] = await Promise.all([hydrate(seed), business()]);
    const blob = buildOrderPdf(row, cfg);
    const path = `${row.user_id}/order/${row.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
    const saved = await A().db.from('repair_orders').update({ pdf_path: path, updated_at: new Date().toISOString() }).eq('id', row.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from('repair-documents').remove([path]);
      throw saved.error || new Error('L’OR a été modifié pendant sa génération.');
    }
    if (row.pdf_path && row.pdf_path !== path) A().db.storage.from('repair-documents').remove([row.pdf_path]).catch(() => {});
    return path;
  }

  function install() {
    const module = window.EDMAdminDocumentPdf;
    if (!module?.generateFor || module.__personalizedOrderPdf) return false;
    const original = module.generateFor.bind(module);
    module.generateFor = (type, row) => type === 'order' ? generatePersonalizedOrder(row) : original(type, row);
    module.__personalizedOrderPdf = true;
    module.generatePersonalizedOrder = generatePersonalizedOrder;
    return true;
  }

  if (!install()) {
    const retry = window.setInterval(() => {
      if (install()) window.clearInterval(retry);
    }, 100);
    window.setTimeout(() => window.clearInterval(retry), 5000);
  }
})();
