(() => {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const RED = [0.82, 0.05, 0.08];
  const DARK = [0.08, 0.10, 0.12];
  const GRAY = [0.55, 0.58, 0.62];
  const LIGHT = [0.94, 0.95, 0.96];
  const BLUE = [0.84, 0.89, 0.96];
  const WHITE = [1, 1, 1];
  const BLACK = [0, 0, 0];
  const cp1252 = { '€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159 };
  const byte = (char) => {
    const code = char.charCodeAt(0);
    if (code <= 255) return code;
    return cp1252[char] ?? 63;
  };
  const hex = (value) => [...String(value ?? '')].map((char) => byte(char).toString(16).padStart(2, '0')).join('').toUpperCase();
  const binary = (value) => Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 255));
  const clean = (value) => String(value ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const date = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleDateString('fr-FR');
  };
  const rgb = (color) => color.map((x) => Number(x).toFixed(3)).join(' ');
  const widthOf = (value, size, bold = false) => clean(value).length * size * (bold ? 0.56 : 0.51);
  const fit = (value, maxChars) => {
    const text = clean(value);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  };
  const wrapText = (value, maxWidth, size, bold = false, maxLines = 3) => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (widthOf(next, size, bold) <= maxWidth) current = next;
      else {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = fit(lines[maxLines - 1], Math.max(4, lines[maxLines - 1].length - 1));
    return lines;
  };

  class Page {
    constructor() { this.commands = []; }
    raw(command) { this.commands.push(command); return this; }
    line(x1, y1, x2, y2, options = {}) {
      const color = options.color || BLACK;
      const width = options.width || 1;
      return this.raw(`q ${rgb(color)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
    }
    rect(x, y, w, h, options = {}) {
      const fill = options.fill;
      const stroke = options.stroke;
      const width = options.width || 1;
      let command = 'q ';
      if (fill) command += `${rgb(fill)} rg `;
      if (stroke) command += `${rgb(stroke)} RG ${width} w `;
      command += `${x} ${y} ${w} ${h} re `;
      command += fill && stroke ? 'B' : fill ? 'f' : 'S';
      command += ' Q';
      return this.raw(command);
    }
    polygon(points, fill) {
      if (!points?.length) return this;
      const [first, ...rest] = points;
      return this.raw(`q ${rgb(fill)} rg ${first[0]} ${first[1]} m ${rest.map((p) => `${p[0]} ${p[1]} l`).join(' ')} h f Q`);
    }
    circle(cx, cy, r, options = {}) {
      const k = 0.5522847498 * r;
      const fill = options.fill;
      const stroke = options.stroke;
      const width = options.width || 1;
      let command = 'q ';
      if (fill) command += `${rgb(fill)} rg `;
      if (stroke) command += `${rgb(stroke)} RG ${width} w `;
      command += `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c `;
      command += fill && stroke ? 'B' : fill ? 'f' : 'S';
      command += ' Q';
      return this.raw(command);
    }
    text(x, y, value, options = {}) {
      const textValue = clean(value);
      if (!textValue) return this;
      const size = options.size || 10;
      const bold = Boolean(options.bold);
      const color = options.color || BLACK;
      const align = options.align || 'left';
      const boxWidth = options.width || 0;
      let tx = x;
      if (align === 'right') tx = x + boxWidth - widthOf(textValue, size, bold);
      if (align === 'center') tx = x + (boxWidth - widthOf(textValue, size, bold)) / 2;
      return this.raw(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${Math.max(0, tx).toFixed(2)} ${y.toFixed(2)} Tm <${hex(textValue)}> Tj ET`);
    }
    paragraph(x, y, value, options = {}) {
      const size = options.size || 9;
      const lineHeight = options.lineHeight || size + 3;
      const lines = wrapText(value, options.width || 200, size, Boolean(options.bold), options.maxLines || 4);
      lines.forEach((line, index) => this.text(x, y - index * lineHeight, line, options));
      return y - lines.length * lineHeight;
    }
  }

  class PdfDocument {
    constructor() { this.pages = []; }
    addPage() { const page = new Page(); this.pages.push(page); return page; }
    build() {
      if (!this.pages.length) this.addPage();
      const objects = [];
      const catalogId = 1;
      const pagesId = 2;
      objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      const pageIds = [];
      let nextId = 3;
      this.pages.forEach(() => { pageIds.push(nextId); nextId += 2; });
      const fontRegularId = nextId++;
      const fontBoldId = nextId++;
      objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
      this.pages.forEach((page, index) => {
        const pageId = pageIds[index];
        const contentId = pageId + 1;
        const content = page.commands.join('\n');
        objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
        objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
      });
      objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
      let pdf = '%PDF-1.4\n';
      const offsets = [0];
      for (let id = 1; id < objects.length; id += 1) {
        offsets[id] = pdf.length;
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
      }
      const xref = pdf.length;
      pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
      pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return new Blob([binary(pdf)], { type: 'application/pdf' });
    }
  }

  const companyName = (cfg) => clean(cfg.business_name || cfg.legal_name || 'EDM28');
  const companyAddress = (cfg) => [cfg.address_line1, cfg.address_line2, [cfg.postal_code, cfg.city].filter(Boolean).join(' '), cfg.country].filter(Boolean).join(' - ');
  const customerData = (row) => row.profiles || row.customer_snapshot || {};
  const vehicleData = (row) => row.vehicles || row.vehicle_snapshot || {};
  const customerName = (row) => {
    const profile = customerData(row);
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.company_name || profile.email || 'Client';
  };
  const vehicleName = (row) => {
    const vehicle = vehicleData(row);
    return [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Véhicule';
  };
  const numberFor = (type, row) => type === 'quote' ? row.quote_number : type === 'invoice' ? row.invoice_number : type === 'order' ? row.order_number : row.report_number;

  function decorativeCorners(page, color = RED) {
    page.polygon([[0, PAGE_H], [95, PAGE_H], [0, PAGE_H - 84]], color);
    page.polygon([[0, PAGE_H - 84], [112, PAGE_H], [139, PAGE_H], [0, PAGE_H - 128]], [0.88, 0.90, 0.94]);
    page.polygon([[PAGE_W, 0], [PAGE_W - 100, 0], [PAGE_W, 92]], color);
    page.polygon([[PAGE_W - 100, 0], [PAGE_W, 92], [PAGE_W, 122], [PAGE_W - 132, 0]], [0.88, 0.90, 0.94]);
  }

  function drawBrand(page, cfg, x = 42, y = 760, accent = RED) {
    page.circle(x + 28, y + 24, 22, { stroke: DARK, width: 5 });
    page.circle(x + 28, y + 24, 8, { stroke: accent, width: 4 });
    page.line(x + 10, y + 24, x + 46, y + 24, { color: DARK, width: 5 });
    page.line(x + 28, y + 42, x + 45, y + 54, { color: accent, width: 5 });
    page.text(x + 60, y + 12, 'EDM', { size: 29, bold: true, color: DARK });
    page.text(x + 132, y + 12, '28', { size: 29, bold: true, color: accent });
    page.text(x + 60, y - 3, clean(cfg.tagline || 'MÉCANIQUE - DIAGNOSTIC - SERVICES'), { size: 6.5, bold: true, color: DARK });
  }

  function drawCompanyBlock(page, cfg, x, y, width = 245, accent = RED) {
    const values = [
      companyName(cfg),
      companyAddress(cfg),
      cfg.phone ? `Tél. : ${cfg.phone}` : '',
      `E-mail : ${clean(cfg.email || 'contact@edm28.fr')}`,
      `Site web : ${clean(cfg.website || 'www.edm28.fr')}`,
      cfg.siret ? `SIRET : ${cfg.siret}` : '',
      cfg.vat_number ? `TVA intracommunautaire : ${cfg.vat_number}` : clean(cfg.vat_status || '')
    ].filter(Boolean);
    page.text(x, y, values[0], { size: 10.5, bold: true, color: accent });
    let cursor = y - 18;
    values.slice(1).forEach((value) => {
      const lines = wrapText(value, width, 8.2, false, 2);
      lines.forEach((line) => { page.text(x, cursor, line, { size: 8.2, color: DARK }); cursor -= 12; });
      cursor -= 1;
    });
    return cursor;
  }

  function drawCustomerBlock(page, row, x, y, width = 220, heading = 'CLIENT', accent = RED) {
    const profile = customerData(row);
    const vehicle = vehicleData(row);
    page.text(x, y, heading, { size: 10, bold: true, color: accent });
    page.line(x, y - 8, x + width, y - 8, { color: accent, width: 1.2 });
    const values = [
      customerName(row),
      profile.address || profile.address_line1 || '',
      profile.phone ? `Tél. : ${profile.phone}` : '',
      profile.email ? `E-mail : ${profile.email}` : '',
      clean(vehicle.plate) ? `Véhicule : ${vehicleName(row)} - ${vehicle.plate}` : `Véhicule : ${vehicleName(row)}`,
      vehicle.mileage ? `Kilométrage : ${Number(vehicle.mileage).toLocaleString('fr-FR')} km` : ''
    ].filter(Boolean);
    let cursor = y - 27;
    values.forEach((value, index) => {
      const lines = wrapText(value, width, index === 0 ? 9.3 : 8.2, index === 0, 2);
      lines.forEach((line) => { page.text(x, cursor, line, { size: index === 0 ? 9.3 : 8.2, bold: index === 0 }); cursor -= 12; });
    });
  }

  function drawDocTitle(page, title, row, type, accent = RED) {
    page.text(230, 690, title, { size: 22, bold: true, color: DARK, width: 150, align: 'center' });
    page.line(277, 681, 318, 681, { color: accent, width: 3 });
    page.text(420, 780, `Date : ${date(row.issued_at || row.completed_at || row.created_at || new Date())}`, { size: 9.5, bold: true });
    page.text(420, 758, `${title === 'FACTURE' ? 'Facture' : title === 'DEVIS' ? 'Devis' : 'Document'} N° : ${numberFor(type, row) || 'Non attribué'}`, { size: 9.5, bold: true, color: title === 'DEVIS' ? RED : DARK });
  }

  function commerceRows(row, type) {
    const source = type === 'quote' ? row.quote_items : row.invoice_items;
    return (source || []).map((item) => ({
      quantity: Number(item.quantity || 1),
      designation: clean(item.designation || item.description || 'Prestation'),
      unit: Number(item.unit_price || 0),
      vat: Number(item.vat_rate || 0),
      total: Number(item.total ?? item.line_total ?? Number(item.quantity || 1) * Number(item.unit_price || 0))
    }));
  }

  function drawCommerceTable(page, items, topY) {
    const x = 42;
    const widths = [68, 255, 94, 94];
    const totalWidth = widths.reduce((sum, value) => sum + value, 0);
    const headerH = 28;
    const rowH = 34;
    page.rect(x, topY - headerH, totalWidth, headerH, { fill: DARK, stroke: DARK });
    const headings = ['Quantité', 'Désignation', 'Prix Unitaire HT', 'Total HT'];
    let cursorX = x;
    headings.forEach((heading, index) => {
      page.text(cursorX, topY - 19, heading, { size: index === 1 ? 9 : 8.2, bold: true, color: WHITE, width: widths[index], align: 'center' });
      cursorX += widths[index];
      if (index < widths.length - 1) page.line(cursorX, topY - headerH, cursorX, topY, { color: [0.45,0.48,0.50], width: 0.7 });
    });
    let rowTop = topY - headerH;
    items.forEach((item, rowIndex) => {
      const rowBottom = rowTop - rowH;
      page.rect(x, rowBottom, totalWidth, rowH, { fill: rowIndex % 2 ? LIGHT : WHITE, stroke: GRAY, width: 0.45 });
      let colX = x;
      page.text(colX, rowBottom + 12, Number(item.quantity).toLocaleString('fr-FR'), { size: 8.5, width: widths[0], align: 'center' });
      colX += widths[0];
      const lines = wrapText(item.designation, widths[1] - 12, 8.3, false, 2);
      lines.forEach((line, index) => page.text(colX + 6, rowBottom + 19 - index * 10, line, { size: 8.3 }));
      colX += widths[1];
      page.text(colX, rowBottom + 12, money(item.unit), { size: 8.2, width: widths[2], align: 'center' });
      colX += widths[2];
      page.text(colX, rowBottom + 12, money(item.total), { size: 8.2, width: widths[3], align: 'center' });
      let divider = x;
      widths.slice(0, -1).forEach((w) => { divider += w; page.line(divider, rowBottom, divider, rowTop, { color: GRAY, width: 0.45 }); });
      rowTop = rowBottom;
    });
    return rowTop;
  }

  function totalsFor(row, items) {
    const subtotal = Number(row.subtotal ?? items.reduce((sum, item) => sum + item.total, 0));
    const vat = items.reduce((sum, item) => sum + item.total * item.vat / 100, 0);
    const discount = Number(row.discount || 0);
    const total = Number(row.total ?? subtotal + vat - discount);
    return { subtotal, vat, discount, total };
  }

  function drawTotals(page, totals, x, y, accent = RED) {
    const w = 230;
    const h = 66;
    const rowH = 22;
    const leftW = 130;
    page.rect(x, y, w, h, { stroke: GRAY, width: 0.7 });
    page.line(x, y + rowH, x + w, y + rowH, { color: GRAY, width: 0.7 });
    page.line(x, y + rowH * 2, x + w, y + rowH * 2, { color: GRAY, width: 0.7 });
    page.line(x + leftW, y, x + leftW, y + h, { color: GRAY, width: 0.7 });
    page.text(x + 8, y + 49, 'Montant Total HT', { size: 8.5 });
    page.text(x + leftW + 4, y + 49, money(totals.subtotal), { size: 8.5, bold: true, width: w - leftW - 10, align: 'right' });
    page.text(x + 8, y + 27, 'TVA', { size: 8.5 });
    page.text(x + leftW + 4, y + 27, money(totals.vat), { size: 8.5, bold: true, width: w - leftW - 10, align: 'right' });
    page.rect(x, y, w, rowH, { fill: accent });
    page.text(x + 8, y + 7, 'Montant Total TTC', { size: 9, bold: true, color: WHITE });
    page.text(x + leftW + 4, y + 7, money(totals.total), { size: 9, bold: true, color: WHITE, width: w - leftW - 10, align: 'right' });
  }

  function drawPayment(page, cfg, x, y, invoice = false, accent = RED) {
    page.text(x, y, invoice ? 'RÈGLEMENT ET COORDONNÉES BANCAIRES' : 'CONDITIONS DE RÈGLEMENT', { size: 9.5, bold: true, color: accent });
    page.line(x, y - 7, x + 30, y - 7, { color: accent, width: 1.4 });
    const terms = clean(cfg.payment_terms || 'Règlement selon les conditions indiquées sur le document.');
    page.paragraph(x, y - 22, terms, { size: 7.8, width: 255, maxLines: 2 });
    let cursor = y - 52;
    if (cfg.iban) { page.text(x, cursor, `IBAN : ${cfg.iban}`, { size: 8 }); cursor -= 14; }
    if (cfg.bic) { page.text(x, cursor, `BIC / SWIFT : ${cfg.bic}`, { size: 8 }); cursor -= 14; }
    if (cfg.bank_name) { page.text(x, cursor, `Banque : ${cfg.bank_name}`, { size: 8 }); cursor -= 14; }
    page.text(x, cursor, `Titulaire : ${companyName(cfg)}`, { size: 8 });
  }

  function drawCommerceFooter(page, cfg, type, row, tableBottom, totals, accent = RED) {
    const baseY = Math.min(245, tableBottom - 18);
    page.text(45, baseY + 55, 'Objet :', { size: 9.5, bold: true, color: accent });
    page.paragraph(82, baseY + 55, row.description || row.title || (type === 'quote' ? 'Devis de réparation automobile' : 'Facture de réparation automobile'), { size: 8.2, width: 215, maxLines: 3 });
    drawTotals(page, totals, 323, baseY + 5, accent);
    drawPayment(page, cfg, 45, 138, type === 'invoice', accent);
    page.text(332, 138, type === 'quote' ? 'BON POUR ACCORD' : 'CACHET ET SIGNATURE', { size: 9.5, bold: true, color: accent });
    page.rect(323, 42, 230, 82, { stroke: accent, width: 0.9 });
    if (type === 'quote') {
      page.text(335, 101, 'Date :', { size: 8 });
      page.text(335, 83, 'Nom / Cachet :', { size: 8 });
      page.text(335, 63, 'Signature :', { size: 8 });
    }
    page.line(40, 30, 555, 30, { color: accent, width: 0.7 });
    page.text(40, 14, `Merci pour votre confiance - ${companyName(cfg)} - ${clean(cfg.email || 'contact@edm28.fr')} - ${clean(cfg.website || 'www.edm28.fr')}`, { size: 7, width: 515, align: 'center' });
  }

  function buildCommerce(type, cfg, row) {
    const doc = new PdfDocument();
    const items = commerceRows(row, type);
    const totals = totalsFor(row, items);
    let remaining = items.length ? [...items] : [{ quantity: 1, designation: row.title || 'Prestation', unit: Number(row.subtotal || row.total || 0), vat: 0, total: Number(row.subtotal || row.total || 0) }];
    let first = true;
    while (remaining.length) {
      const page = doc.addPage();
      decorativeCorners(page, RED);
      let tableTop;
      if (first) {
        drawBrand(page, cfg, 42, 760, RED);
        drawDocTitle(page, type === 'quote' ? 'DEVIS' : 'FACTURE', row, type, RED);
        drawCompanyBlock(page, cfg, 45, 650, 245, RED);
        drawCustomerBlock(page, row, 340, 650, 215, type === 'quote' ? 'DEVIS POUR' : 'CLIENT', RED);
        tableTop = 515;
      } else {
        drawBrand(page, cfg, 42, 775, RED);
        page.text(370, 782, `${type === 'quote' ? 'DEVIS' : 'FACTURE'} ${numberFor(type, row) || ''} - SUITE`, { size: 11, bold: true, color: RED });
        tableTop = 735;
      }
      const maxRows = first ? Math.min(5, remaining.length) : (remaining.length <= 10 ? remaining.length : Math.min(15, remaining.length - 10));
      const chunk = remaining.splice(0, maxRows);
      const tableBottom = drawCommerceTable(page, chunk, tableTop);
      if (!remaining.length) drawCommerceFooter(page, cfg, type, row, tableBottom, totals, RED);
      else page.text(42, 35, 'Suite du document sur la page suivante.', { size: 7.5, color: GRAY });
      first = false;
    }
    return doc.build();
  }

  function field(page, label, value, x, y, width, options = {}) {
    page.text(x, y, label, { size: options.size || 8.2, bold: Boolean(options.bold) });
    const labelWidth = widthOf(label, options.size || 8.2, Boolean(options.bold)) + 8;
    const textX = x + labelWidth;
    page.text(textX, y, fit(value || '', Math.max(10, Math.floor((width - labelWidth) / 4.6))), { size: options.size || 8.2 });
    page.line(textX, y - 3, x + width, y - 3, { color: GRAY, width: 0.5 });
  }

  function drawOrder(cfg, row) {
    const doc = new PdfDocument();
    const page = doc.addPage();
    const profile = customerData(row);
    const vehicle = vehicleData(row);
    drawBrand(page, cfg, 24, 788, RED);
    page.rect(202, 785, 370, 42, { stroke: DARK, width: 1.3 });
    page.text(202, 797, 'ORDRE DE RÉPARATION', { size: 22, bold: true, width: 370, align: 'center' });
    page.rect(25, 690, 260, 82, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(35, 754, companyName(cfg), { size: 10, bold: true });
    page.paragraph(35, 738, companyAddress(cfg), { size: 7.5, width: 235, maxLines: 2 });
    page.text(35, 708, `${clean(cfg.phone) ? `Tél. : ${cfg.phone} - ` : ''}${clean(cfg.email || 'contact@edm28.fr')}`, { size: 7.5 });
    page.text(35, 696, `${cfg.siret ? `SIRET : ${cfg.siret}` : ''}${cfg.vat_number ? ` - TVA : ${cfg.vat_number}` : ''}`, { size: 7.2 });
    field(page, 'Nom du propriétaire :', customerName(row), 310, 755, 255);
    field(page, 'Adresse :', profile.address || profile.address_line1 || '', 310, 736, 255);
    field(page, 'Téléphone :', profile.phone || '', 310, 706, 255);
    field(page, 'Réception du véhicule :', date(row.received_at || row.created_at), 310, 687, 255);
    field(page, 'Livraison prévue :', date(row.delivery_due_at || row.appointments?.ends_at), 310, 668, 255);

    const x = 24;
    const y = 584;
    page.rect(x, y, 547, 72, { stroke: DARK, width: 0.8 });
    page.rect(x, y + 36, 95, 36, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(x, y + 47, 'IDENTIFICATION', { size: 8.5, bold: true, width: 95, align: 'center' });
    page.text(x, y + 37, 'DU VÉHICULE', { size: 8.5, bold: true, width: 95, align: 'center' });
    const columns = [95, 140, 140, 172];
    let cx = x + 95;
    ['MARQUE', 'TYPE', 'N° DE SÉRIE'].forEach((heading, index) => {
      const w = columns[index + 1];
      page.rect(cx, y + 36, w, 36, { stroke: DARK, width: 0.8 });
      page.text(cx, y + 58, heading, { size: 8.3, bold: true, width: w, align: 'center' });
      page.text(cx + 5, y + 43, index === 0 ? clean(vehicle.brand) : index === 1 ? clean(vehicle.model) : clean(vehicle.vin || vehicle.serial_number), { size: 7.8, width: w - 10, align: 'center' });
      cx += w;
    });
    const subWidths = [182, 182, 183];
    cx = x;
    const subValues = [clean(vehicle.plate), row.mileage_in ? `${Number(row.mileage_in).toLocaleString('fr-FR')} km` : '', date(vehicle.first_registration_at)];
    ['Immatriculation', 'km au compteur', 'Date de mise en circulation'].forEach((heading, index) => {
      page.rect(cx, y, subWidths[index], 36, { stroke: DARK, width: 0.8 });
      page.text(cx, y + 23, heading, { size: 7.7, bold: true, width: subWidths[index], align: 'center' });
      page.text(cx, y + 8, subValues[index], { size: 8, width: subWidths[index], align: 'center' });
      cx += subWidths[index];
    });

    page.rect(24, 510, 547, 62, { stroke: DARK, width: 0.8 });
    page.rect(24, 510, 95, 62, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(24, 543, 'ÉNONCÉ DES', { size: 8.4, bold: true, width: 95, align: 'center' });
    page.text(24, 529, 'SYMPTÔMES', { size: 8.4, bold: true, width: 95, align: 'center' });
    page.text(119, 558, 'INFORMATIONS CLIENTS', { size: 8.8, bold: true, width: 452, align: 'center' });
    page.paragraph(130, 538, row.customer_request || row.description || row.title || '', { size: 8, width: 430, maxLines: 3 });

    page.rect(24, 288, 547, 210, { stroke: DARK, width: 0.8 });
    page.rect(24, 472, 115, 26, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(24, 481, 'STATION SERVICE', { size: 8.4, bold: true, width: 115, align: 'center' });
    page.rect(139, 472, 432, 26, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(139, 481, 'LIBELLÉ DES TRAVAUX À RÉALISER', { size: 8.8, bold: true, width: 432, align: 'center' });
    const serviceChecks = ['Lavage', 'Vidange moteur', 'Filtres', 'Graissages', 'Niveaux', 'Contrôle freinage', 'Pneumatiques'];
    serviceChecks.forEach((label, index) => {
      const yy = 452 - index * 21;
      page.rect(113, yy - 2, 10, 10, { stroke: DARK, width: 0.7 });
      page.text(34, yy, label, { size: 7.8, bold: index < 2 });
    });
    const works = Array.isArray(row.authorized_work) ? row.authorized_work : [];
    let workY = 452;
    works.slice(0, 8).forEach((work, index) => {
      const value = typeof work === 'string' ? work : work.name || work.description || work.id || '';
      page.paragraph(151, workY, `${index + 1}. ${value}`, { size: 8, width: 405, maxLines: 2 });
      workY -= 23;
    });
    page.rect(139, 288, 432, 61, { stroke: DARK, width: 0.8 });
    page.rect(139, 327, 432, 22, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(139, 335, 'PIÈCES À REMPLACER', { size: 8.8, bold: true, width: 432, align: 'center' });

    page.rect(24, 142, 547, 132, { stroke: DARK, width: 0.8 });
    page.line(297, 142, 297, 274, { color: DARK, width: 0.8 });
    page.rect(24, 252, 273, 22, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.rect(297, 252, 274, 22, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(24, 260, 'MODIFICATION DE L’ORDRE DE RÉPARATION', { size: 8.2, bold: true, width: 273, align: 'center' });
    page.text(297, 260, 'OBSERVATIONS', { size: 8.2, bold: true, width: 274, align: 'center' });
    page.paragraph(35, 232, 'Toute modification doit être portée à la connaissance du client et acceptée avant exécution.', { size: 7.5, width: 245, maxLines: 3 });
    page.text(35, 184, 'Date / heure :', { size: 7.8 });
    page.text(35, 164, 'Signature du client :', { size: 7.8 });
    page.paragraph(310, 232, row.visible_condition || row.customer_items || '', { size: 7.8, width: 245, maxLines: 6 });

    page.rect(24, 38, 547, 92, { stroke: DARK, width: 0.8 });
    page.line(297, 38, 297, 130, { color: DARK, width: 0.8 });
    page.rect(24, 108, 273, 22, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.rect(297, 108, 274, 22, { fill: LIGHT, stroke: DARK, width: 0.8 });
    page.text(24, 116, 'ACCEPTATION DU CLIENT', { size: 8.4, bold: true, width: 273, align: 'center' });
    page.text(297, 116, 'VISA DU RÉCEPTIONNAIRE', { size: 8.4, bold: true, width: 274, align: 'center' });
    page.text(35, 88, 'Je reconnais avoir pris connaissance de l’ordre de réparation.', { size: 7.2 });
    page.text(35, 68, 'Nom / Signature :', { size: 7.8 });
    page.text(310, 88, `Véhicule reçu le : ${date(row.created_at)}`, { size: 7.8 });
    page.text(310, 68, 'Nom / Signature :', { size: 7.8 });
    page.text(24, 20, 'Document interne EDM28 - un exemplaire peut être remis au client après validation.', { size: 6.8, width: 547, align: 'center' });
    return doc.build();
  }

  const CHECK_LABELS = {
    plaquettes_av_g: 'Plaquettes avant gauche', plaquettes_av_d: 'Plaquettes avant droite', plaquettes_ar_g: 'Plaquettes arrière gauche', plaquettes_ar_d: 'Plaquettes arrière droite',
    disque_av_g: 'Disque avant gauche', disque_av_d: 'Disque avant droit', disque_ar_g: 'Disque arrière gauche', disque_ar_d: 'Disque arrière droit',
    pneu_av_g: 'Pneu avant gauche', pneu_av_d: 'Pneu avant droit', pneu_ar_g: 'Pneu arrière gauche', pneu_ar_d: 'Pneu arrière droit',
    pression_av_g: 'Pression avant gauche', pression_av_d: 'Pression avant droit', pression_ar_g: 'Pression arrière gauche', pression_ar_d: 'Pression arrière droite',
    liquide_frein: 'Liquide de frein', flexibles: 'Flexibles de frein', amortisseurs: 'Amortisseurs', rotules: 'Rotules', silentblocs: 'Silentblocs', roulements: 'Roulements', soufflets: 'Soufflets', geometrie: 'Géométrie'
  };
  const sectionForCheck = (key) => /plaquettes|disque|liquide_frein|flexibles/.test(key) ? 'FREINAGE' : /pneu|pression/.test(key) ? 'PNEUMATIQUES' : 'LIAISON AU SOL';
  const checkValue = (value) => typeof value === 'object' && value !== null ? value : { status: value };

  function drawInspectionTable(page, checks, startY) {
    const x = 22;
    const widths = [170, 47, 47, 47, 47, 216];
    const totalW = widths.reduce((sum, value) => sum + value, 0);
    let y = startY;
    const headings = ['Point contrôlé', 'Conforme', 'Surveiller', 'Remplacer', 'Non contrôlé', 'Mesure / commentaire'];
    const groups = ['FREINAGE', 'PNEUMATIQUES', 'LIAISON AU SOL'];
    for (const group of groups) {
      page.rect(x, y - 15, totalW, 15, { fill: BLUE, stroke: DARK, width: 0.6 });
      page.text(x + 5, y - 10.5, group, { size: 7.9, bold: true });
      y -= 15;
      page.rect(x, y - 15, totalW, 15, { fill: LIGHT, stroke: DARK, width: 0.6 });
      let cx = x;
      headings.forEach((heading, index) => {
        page.text(cx, y - 10.5, heading, { size: index === 0 || index === 5 ? 6.2 : 5.6, bold: true, width: widths[index], align: 'center' });
        cx += widths[index];
        if (index < widths.length - 1) page.line(cx, y - 15, cx, y, { color: DARK, width: 0.5 });
      });
      y -= 15;
      Object.entries(checks).filter(([key]) => sectionForCheck(key) === group).forEach(([key, raw]) => {
        const value = checkValue(raw);
        page.rect(x, y - 12, totalW, 12, { stroke: GRAY, width: 0.45 });
        page.text(x + 4, y - 8.4, CHECK_LABELS[key] || key.replaceAll('_', ' '), { size: 6.1 });
        const status = clean(value.status || 'non_controle');
        const statuses = ['conforme', 'surveiller', 'remplacer', 'non_controle'];
        let cx = x + widths[0];
        statuses.forEach((candidate, index) => {
          page.line(cx, y - 12, cx, y, { color: GRAY, width: 0.45 });
          if (status === candidate) page.text(cx, y - 8.7, 'X', { size: 7, bold: true, width: widths[index + 1], align: 'center' });
          cx += widths[index + 1];
        });
        page.line(cx, y - 12, cx, y, { color: GRAY, width: 0.45 });
        const note = [value.measure != null ? String(value.measure) : '', value.note].filter(Boolean).join(' - ');
        page.text(cx + 4, y - 8.4, fit(note, 56), { size: 5.9 });
        y -= 12;
      });
      y -= 4;
    }
    return y;
  }

  function drawCar(page, x, y, w, h) {
    page.rect(x, y, w, h, { stroke: DARK, width: 0.8 });
    const cx = x + w / 2;
    page.rect(cx - w * 0.28, y + h * 0.12, w * 0.56, h * 0.76, { stroke: DARK, width: 1.1 });
    page.rect(cx - w * 0.18, y + h * 0.29, w * 0.36, h * 0.42, { stroke: DARK, width: 0.7 });
    const wheelW = w * 0.07;
    const wheelH = h * 0.18;
    [[cx - w * 0.32, y + h * 0.18], [cx + w * 0.25, y + h * 0.18], [cx - w * 0.32, y + h * 0.64], [cx + w * 0.25, y + h * 0.64]].forEach(([wx, wy]) => page.rect(wx, wy, wheelW, wheelH, { fill: DARK }));
    page.line(x + 12, y + h / 2, x + w - 12, y + h / 2, { color: GRAY, width: 0.5 });
  }

  function drawInspection(cfg, row) {
    const doc = new PdfDocument();
    const page = doc.addPage();
    const vehicle = vehicleData(row);
    drawBrand(page, cfg, 22, 790, RED);
    page.rect(220, 785, 350, 44, { stroke: DARK, width: 1.3 });
    page.text(220, 797, 'FICHE DE CONTRÔLE', { size: 22, bold: true, width: 350, align: 'center' });
    field(page, 'Date :', date(row.completed_at || row.created_at), 26, 755, 245);
    field(page, 'Réalisé par :', row.technician_name || '', 26, 735, 245);
    field(page, 'Conducteur :', customerName(row), 26, 715, 245);
    field(page, 'Date de validité du CT :', date(vehicle.ct_valid_until), 325, 755, 245);
    field(page, 'Immatriculation :', vehicle.plate || '', 325, 735, 245);
    field(page, 'Véhicule :', vehicleName(row), 325, 715, 245);
    field(page, 'Nbr de km du véhicule :', row.mileage ? `${Number(row.mileage).toLocaleString('fr-FR')} km` : '', 26, 680, 245);
    field(page, 'Date de dernière vidange :', date(vehicle.last_oil_change_at), 26, 660, 245);
    field(page, 'Date de la prochaine révision :', date(vehicle.next_service_at), 26, 640, 245);
    const checks = row.checks || {};
    const ordered = {};
    Object.keys(CHECK_LABELS).forEach((key) => { ordered[key] = checks[key] || { status: 'non_controle' }; });
    const bottom = drawInspectionTable(page, ordered, 610);
    page.rect(22, 90, 215, 118, { stroke: DARK, width: 0.7 });
    page.rect(22, 188, 215, 20, { fill: BLUE, stroke: DARK, width: 0.7 });
    page.text(28, 195, 'ASPECT EXTÉRIEUR / OBSERVATIONS', { size: 8.4, bold: true });
    page.paragraph(30, 170, row.observations || row.customer_request || '', { size: 7.4, width: 195, maxLines: 7 });
    drawCar(page, 248, 90, 205, 118);
    page.rect(464, 90, 109, 118, { stroke: DARK, width: 0.7 });
    page.text(464, 191, 'SIGNATURE', { size: 8.4, bold: true, width: 109, align: 'center' });
    if (row.signature_path) page.text(464, 138, 'Signature numérique', { size: 7.2, bold: true, width: 109, align: 'center' });
    if (Array.isArray(row.photo_paths) && row.photo_paths.length) page.text(464, 118, `${row.photo_paths.length} photo(s) au dossier`, { size: 6.8, width: 109, align: 'center' });
    page.line(22, 72, 573, 72, { color: RED, width: 0.7 });
    page.text(22, 54, `${companyName(cfg)} - ${clean(cfg.phone)} - ${clean(cfg.email || 'contact@edm28.fr')} - ${clean(cfg.website || 'www.edm28.fr')}`, { size: 7.2, width: 551, align: 'center' });
    page.text(22, 40, `Fiche ${row.report_number || ''} - ${bottom < 90 ? 'Contrôles complets' : ''}`, { size: 6.8, width: 551, align: 'center', color: GRAY });
    return doc.build();
  }

  function normalizeLine(line) {
    return typeof line === 'object' && line !== null ? { text: clean(line.text), bold: Boolean(line.bold), size: Number(line.size || 10), gap: Number(line.gap || 0), indent: Number(line.indent || 0) } : { text: clean(line), bold: false, size: 10, gap: 0, indent: 0 };
  }

  function build(lines) {
    const doc = new PdfDocument();
    let page = doc.addPage();
    let y = 795;
    (lines || []).map(normalizeLine).forEach((row) => {
      const wrapped = wrapText(row.text, 495 - row.indent * 5, row.size, row.bold, 12);
      wrapped.forEach((textValue, index) => {
        if (y < 55) { page = doc.addPage(); y = 795; }
        y -= index === 0 ? row.gap : 0;
        page.text(50 + row.indent * 5, y, textValue, { size: row.size, bold: row.bold });
        y -= Math.max(12, row.size + 3);
      });
    });
    return doc.build();
  }

  function buildDocument(type, payload = {}) {
    const cfg = payload.cfg || {};
    const row = payload.row || {};
    if (type === 'quote' || type === 'invoice') return buildCommerce(type, cfg, row);
    if (type === 'order') return drawOrder(cfg, row);
    if (type === 'inspection') return drawInspection(cfg, row);
    throw new Error('Type de document PDF non pris en charge.');
  }

  window.EDMPdfLite = { build, buildDocument };
})();