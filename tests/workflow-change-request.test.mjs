import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('client parts choice is mandatory and persisted', async () => {
  const [submit, adjustments] = await Promise.all([
    read('request-submit-safe.js'),
    read('client-workflow-adjustments.js')
  ]);
  assert.match(submit, /parts_purchase_mode:\s*payload\.partsPurchaseMode/);
  assert.match(submit, /input\[name="partsPurchaseMode"\]:checked/);
  assert.match(submit, /Choisissez comment les pièces seront achetées/);
  assert.match(adjustments, /value="client_direct"/);
  assert.match(adjustments, /value="edm_disbursement"/);
  assert.match(adjustments, /Un débours est une somme avancée par EDM28 en votre nom et pour votre compte/);
  assert.match(adjustments, /responsabilité d’EDM28 ne peut pas être engagée/);
  assert.match(adjustments, /ne vend pas de pièces automobiles et ne réalise aucune marge ni commission/);
});

test('quote decisions stay in request status and booking starts after acceptance', async () => {
  const booking = await read('client-internal-booking.js');
  assert.doesNotMatch(booking, /prepareAcceptQuote|prepareRefuseQuote|prepareOpenQuote|Ouvrir le devis/);
  assert.match(booking, /Statut de ma demande/);
  assert.match(booking, /quote\?\.status === 'accepted'/);
  assert.match(booking, /fromDate\.setDate\(fromDate\.getDate\(\) \+ 7\)/);
  assert.match(booking, /edm-slot-selected/);
  assert.match(booking, /délai minimum de 7 jours/);
});

test('request status and documents follow the requested display rules', async () => {
  const adjustments = await read('client-workflow-adjustments.js');
  assert.match(adjustments, /\.edm-status-step\.current.*color:#050505/s);
  assert.match(adjustments, /\.edm-status-card>\.section-title \.pill\.orange\{color:#050505!important\}/);
  assert.match(adjustments, /data-temp-order-doc/);
  assert.match(adjustments, /invoicedOrders/);
  assert.match(adjustments, /data-go-booking/);
  assert.match(adjustments, /rememberHistoryState/);
  assert.match(adjustments, /restoreHistoryState/);
  assert.match(adjustments, /keepFullHistoryVisible/);
  assert.match(adjustments, /refreshGarageFromDb/);
});

test('admin enforces direct-purchase references and hides published ORs', async () => {
  const adjustments = await read('admin-workflow-adjustments.js');
  assert.match(adjustments, /Achat direct par le client/);
  assert.match(adjustments, /Renseignez la référence de chaque pièce avant publication/);
  assert.match(adjustments, /visible_to_client && row\.pdf_path/);
  assert.match(adjustments, /dataset\.publishedHidden/);
  assert.match(adjustments, /data-control="geometrie"/);
  assert.match(adjustments, /data-control-measure/);
});

test('quote and business PDFs contain the selected parts purchase rule', async () => {
  const pdf = await read('admin-document-pdf.js');
  assert.match(pdf, /request\.parts_purchase_mode === 'client_direct'/);
  assert.match(pdf, /EDM28 fournit les références à acheter sur le devis/);
  assert.match(pdf, /responsabilité d’EDM28 ne peut pas être engagée pour cette erreur d’achat/);
  assert.match(pdf, /request\.parts_purchase_mode === 'edm_disbursement'/);
  assert.match(pdf, /remboursement correspond exactement au justificatif fournisseur, sans marge ni commission/);
});

test('personalized OR no longer contains geometry or measurement column', async () => {
  const pdf = await read('admin-order-personalized-pdf.js');
  assert.doesNotMatch(pdf, /key:\s*'geometrie'/);
  assert.doesNotMatch(pdf, /Géométrie/);
  assert.doesNotMatch(pdf, /'Mesure'/);
  assert.doesNotMatch(pdf, /MESURES ET CONTRÔLES/);
  assert.match(pdf, /head:\s*\[\['Famille', 'Point contrôlé', 'Statut', 'Observation'\]\]/);
});

test('database migration stores purchase mode, durations, seven-day lead time and OR visibility protection', async () => {
  const migration = await read('supabase/migrations/20260911144500_client_parts_booking_or_flow.sql');
  assert.match(migration, /parts_purchase_mode/);
  assert.match(migration, /'client_direct','edm_disbursement'/);
  assert.match(migration, /slug = 'disques-plaquettes-avant'/);
  assert.match(migration, /duration_minutes = 120/);
  assert.match(migration, /slug = 'plaquettes-frein-avant'/);
  assert.match(migration, /duration_minutes = 60/);
  assert.match(migration, /now\(\) \+ interval '7 days'/);
  assert.match(migration, /preserve_published_repair_order_visibility/);
});