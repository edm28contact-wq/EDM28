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
  assert.match(source, /many\('quote_items', 'quote_id', base\.quote_id\)/);
  assert.match(source, /Devis accepté/);
  assert.match(source, /TRAVAUX ET PIÈCES AUTORISÉS PAR LE DEVIS ACCEPTÉ/);
  assert.match(source, /supplier_reference/);
  assert.match(source, /quantity/);
  assert.match(source, /MONTANT AUTORISÉ/);
  assert.match(source, /type === 'order' \? generatePersonalizedOrder\(row\)/);
  assert.doesNotMatch(source, /Lavage|Vidange moteur|Graissages|Niveaux/);
});

test('personalized repair order uses the post-intervention control level selected by TTC total', async () => {
  const source = await read('admin-order-personalized-pdf.js');
  assert.match(source, /oneBy\('inspection_reports', 'repair_order_id', base\.id\)/);
  assert.match(source, /POINTS DE CONTRÔLE PRÉVUS/);
  assert.match(source, /CHECKLIST DE CONTRÔLE/);
  assert.match(source, /CONTRÔLE ESSENTIEL - MOINS DE 100 € TTC/);
  assert.match(source, /CONTRÔLE COMPLET - 100 € TTC ET PLUS/);
  assert.match(source, /Number\(row\?\.quotes\?\.total \|\| 0\) >= 100/);
  assert.match(source, /freinage_visuel/);
  for (const key of ['pression_av_g','pression_av_d','pression_ar_g','pression_ar_d']) assert.match(source, new RegExp(key));
  for (const key of ['pneu_av_g','amortisseurs','rotules','silentblocs','roulements','soufflets','niveau_huile_moteur','niveau_liquide_refroidissement','niveau_lave_glace','essuie_glace_av','klaxon','feux_detresse']) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /OBSERVATIONS GÉNÉRALES/);
  assert.match(source, /ÉTAT DU VÉHICULE \/ OBJETS CLIENT/);
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
  const basket = await read('admin-supplier-basket.js');
  assert.match(basket, /generateFor\('quote', complete\.data\)/);
  assert.match(basket, /attachmentName:\s*`devis-\$\{saved\.quote_number\}\.pdf`/);
  assert.match(source, /generateFor\('invoice', full\.data\)/);
  assert.match(source, /attachmentName:\s*`facture-\$\{current\.data\.invoice_number \|\| invoiceId\}\.pdf`/);
});

test('client PDFs share the EDM28 graphite and copper identity', async () => {
  const [commerce, order, inspection] = await Promise.all([
    read('pdf-lite.js'),
    read('admin-order-personalized-pdf.js'),
    read('admin-inspection-complete-pdf.js')
  ]);
  assert.match(commerce, /const RED = \[0\.827, 0\.604, 0\.447\]/);
  assert.match(commerce, /const DARK = \[0\.125, 0\.157, 0\.176\]/);
  assert.match(commerce, /SPÉCIALISTE DU FREINAGE/);
  assert.match(order, /const INK = \[32, 40, 45\]/);
  assert.match(order, /const COPPER = \[211, 154, 114\]/);
  assert.match(order, /SPÉCIALISTE DU FREINAGE/);
  assert.match(inspection, /const RED = \[211, 154, 114\]/);
  assert.match(inspection, /const DARK = \[32, 40, 45\]/);
  assert.match(inspection, /SPÉCIALISTE DU FREINAGE/);
});

test('repair order explains technical work without inventing generic manufacturer values', async () => {
  const source = await read('admin-order-personalized-pdf.js');
  assert.match(source, /étrier et chape de frein/);
  assert.match(source, /Nettoyage des portées et surfaces de contact/);
  assert.match(source, /Aucune graisse sur les disques, plaquettes/);
  assert.match(source, /couples et angles de serrage sont ceux du constructeur/);
  assert.match(source, /aucune valeur générique n’est appliquée/);
  assert.match(source, /remise en appui de la pédale/);
  assert.match(source, /sans marge cachée sur les pièces/);
});
