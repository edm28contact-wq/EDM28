const PAGE_W = 595;
const PAGE_H = 842;

function escPdf(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function text(x, y, value, size = 10, bold = false) {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escPdf(value)}) Tj ET`;
}

function line(x1, y1, x2, y2, width = 0.8) {
  return `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function rect(x, y, w, h, width = 0.8) {
  return `${width} w ${x} ${y} ${w} ${h} re S`;
}

function checkbox(x, y, label) {
  return [rect(x, y - 7, 8, 8, 0.6), text(x + 13, y - 5, label, 7.5)].join('\n');
}

function buildPage() {
  const c = [];
  c.push(text(42, 800, 'EDM28', 24, true));
  c.push(text(42, 780, 'ORDRE DE REPARATION - MODELE VIERGE', 16, true));
  c.push(text(42, 763, 'Document de preparation - a completer avant intervention', 8));
  c.push(line(42, 752, 553, 752, 1.2));

  c.push(text(42, 728, 'CLIENT', 10, true));
  c.push(rect(42, 656, 245, 60));
  c.push(text(50, 700, 'Nom / Prenom :', 8));
  c.push(text(50, 682, 'Telephone :', 8));
  c.push(text(50, 664, 'Email :', 8));

  c.push(text(310, 728, 'VEHICULE', 10, true));
  c.push(rect(310, 656, 243, 60));
  c.push(text(318, 700, 'Immatriculation :', 8));
  c.push(text(318, 682, 'Marque / Modele :', 8));
  c.push(text(318, 664, 'Kilometrage :', 8));

  c.push(text(42, 632, 'TRAVAUX AUTORISES / DEMANDE CLIENT', 10, true));
  c.push(rect(42, 548, 511, 72));
  c.push(line(50, 598, 545, 598));
  c.push(line(50, 578, 545, 578));
  c.push(line(50, 558, 545, 558));

  c.push(text(42, 522, 'POINTS DE CONTROLE EDM28', 10, true));
  c.push(text(42, 508, 'A partir de 100 EUR TTC factures chez EDM28 : controle complet de cette liste.', 7.5, true));

  const left = [
    'Plaquettes avant gauche',
    'Plaquettes avant droite',
    'Plaquettes arriere gauche',
    'Plaquettes arriere droite',
    'Disque avant gauche',
    'Disque avant droit',
    'Disque arriere gauche',
    'Disque arriere droit',
    'Liquide de frein',
    'Flexibles de frein',
    'Pneu avant gauche',
    'Pneu avant droit'
  ];
  const right = [
    'Pneu arriere gauche',
    'Pneu arriere droit',
    'Pressions pneumatiques',
    'Amortisseurs',
    'Rotules',
    'Silentblocs',
    'Roulements',
    'Soufflets',
    'Geometrie / comportement',
    'Etat visible du vehicule',
    'Photos avant / apres',
    'Observations generales'
  ];
  let y = 486;
  left.forEach((label) => { c.push(checkbox(46, y, label)); y -= 17; });
  y = 486;
  right.forEach((label) => { c.push(checkbox(305, y, label)); y -= 17; });

  c.push(text(42, 272, 'OBSERVATIONS / MESURES', 10, true));
  c.push(rect(42, 190, 511, 68));
  c.push(line(50, 235, 545, 235));
  c.push(line(50, 213, 545, 213));

  c.push(text(42, 164, 'VALIDATION', 10, true));
  c.push(rect(42, 74, 245, 76));
  c.push(text(50, 134, 'Date :', 8));
  c.push(text(50, 116, 'Nom client :', 8));
  c.push(text(50, 94, 'Signature client :', 8));

  c.push(rect(310, 74, 243, 76));
  c.push(text(318, 134, 'Technicien :', 8));
  c.push(text(318, 116, 'Date / heure :', 8));
  c.push(text(318, 94, 'Signature / visa :', 8));

  c.push(text(42, 50, 'EDM28 - Modele vierge. Le document final est genere depuis le dossier client.', 7));
  return c.join('\n');
}

function buildPdf() {
  const stream = buildPage();
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`;
  objects[4] = `<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, 'binary');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  const pdf = buildPdf();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="ordre-reparation-vierge-edm28.pdf"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'HEAD') return res.end();
  return res.end(pdf);
}
