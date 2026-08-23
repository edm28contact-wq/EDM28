import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the validated EDM28 layouts are used for every business PDF', async () => {
  const source = await read('pdf-lite.js');
  assert.match(source, /function buildDocument\(type, payload/);
  assert.match(source, /type === 'quote' \|\| type === 'invoice'/);
  assert.match(source, /if \(type === 'order'\) return drawOrder/);
  assert.match(source, /if \(type === 'inspection'\) return drawInspection/);
  for (const title of ['DEVIS', 'FACTURE', 'ORDRE DE RÉPARATION', 'FICHE DE CONTRÔLE']) {
    assert.match(source, new RegExp(title));
  }
  assert.match(source, /business_name/);
  assert.match(source, /customer_snapshot/);
  assert.match(source, /vehicle_snapshot/);
  assert.match(source, /quote_items/);
  assert.match(source, /invoice_items/);
});

test('PDF modules load before quote and invoice publication', async () => {
  const [html, adminRoute] = await Promise.all([read('admin.html'), read('api/admin.js')]);
  const engine = html.indexOf('/pdf-lite.js');
  const generator = html.indexOf('/admin-document-pdf.js');
  const publisher = html.indexOf('/admin-publish-email.js');
  assert.ok(engine >= 0 && generator > engine && publisher > generator);
  assert.match(html, /admin-inspection-pdf\.js/);
  assert.match(adminRoute, /admin-order-personalized-pdf\.js/);
});

test('repair orders are personalized from the accepted quote lines', async () => {
  const source = await read('admin-order-personalized-pdf.js');
  assert.match(source, /from\('quote_items'\)/);
  assert.match(source, /Devis accepté/);
  assert.match(source, /TRAVAUX ET PIÈCES AUTORISÉS PAR LE DEVIS ACCEPTÉ/);
  assert.match(source, /supplier_reference/);
  assert.match(source, /quantity/);
  assert.match(source, /MONTANT AUTORISÉ/);
  assert.match(source, /type === 'order' \? generatePersonalizedOrder\(row\)/);
  assert.doesNotMatch(source, /Lavage|Vidange moteur|Graissages|Niveaux/);
});

test('completed inspections generate a PDF before final client availability', async () => {
  const source = await read('admin-inspection-pdf.js');
  assert.match(source, /generateFor\('inspection', report\)/);
  assert.match(source, /visible_to_client:\s*true/);
  assert.match(source, /visible_to_client:\s*false/);
  assert.match(source, /pdf_path:\s*pdfPath/);
  assert.match(source, /status.*completed/);
});

test('quote and invoice publication attach the generated PDF to email', async () => {
  const source = await read('admin-publish-email.js');
  assert.match(source, /generateFor\('quote', complete\.data\)/);
  assert.match(source, /attachmentName:\s*`devis-\$\{quoteNumber\}\.pdf`/);
  assert.match(source, /generateFor\('invoice', full\.data\)/);
  assert.match(source, /attachmentName:\s*`facture-\$\{current\.data\.invoice_number \|\| invoiceId\}\.pdf`/);
});