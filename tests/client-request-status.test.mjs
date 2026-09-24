import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client request status exposes the complete EDM28 business journey', async () => {
  const [status, router, app] = await Promise.all([
    read('client-request-status-history.js'),
    read('client-navigation-visible.js'),
    read('api/app.js')
  ]);

  for (const label of [
    'Demande reçue',
    'Étude en cours',
    'Devis disponible',
    'Devis accepté',
    'Pièces à régler',
    'Pièces commandées',
    'Pièces reçues',
    'Rendez-vous confirmé',
    'Intervention en cours',
    'Facture disponible',
    'Terminé'
  ]) assert.ok(status.includes(label), `étape absente : ${label}`);

  assert.doesNotMatch(router, /'request-status'/);
  assert.match(status, /data-request-status-summary/);
  assert.match(status, /document\.getElementById\('historyList'\)/);
  assert.match(app, /client-request-status-history\.js\?v=1/);
});

test('request status derives progress from existing business records', async () => {
  const status = await read('client-request-status-history.js');
  for (const table of ['service_requests', 'quotes', 'disbursements', 'appointments', 'repair_orders', 'invoices']) {
    assert.match(status, new RegExp(`from\\('${table}'\\)`));
  }
  assert.match(status, /visible_to_client\s*&&\s*row\.pdf_path/);
  assert.match(status, /PUBLISHED_INVOICE_STATUSES/);
  assert.match(status, /\['in_progress', 'completed', 'invoiced'\]/);
});

test('request status exposes one next action and uses the secure quote response RPC', async () => {
  const status = await read('client-request-status-history.js');
  assert.match(status, /Action actuelle/);
  assert.match(status, /data-next-page="disbursements"/);
  assert.match(status, /data-next-page="appointment"/);
  assert.match(status, /client_respond_quote/);
  assert.doesNotMatch(status, /from\('quotes'\)\.update\(\{ status \}\)/);
});

test('completed history is grouped by vehicle then intervention and shows three PDFs', async () => {
  const status = await read('client-request-status-history.js');
  assert.match(status, /data-archive-vehicle/);
  assert.match(status, /data-archive-order/);
  assert.match(status, /Historique des interventions/);
  assert.match(status, /documentCard\('Devis'/);
  assert.match(status, /documentCard\('Ordre de réparation'/);
  assert.match(status, /documentCard\('Facture'/);
  assert.match(status, /createSignedUrl\(path, 120\)/);
});

test('legacy invoice archive is no longer loaded because My interventions owns the complete history', async () => {
  const [history, app] = await Promise.all([
    read('client-booking-vehicle-history.js'),
    read('api/app.js')
  ]);
  assert.doesNotMatch(app, /client-history-invoice-archive\.js/);
  for (const table of ['vehicles', 'service_requests', 'quotes', 'repair_orders', 'appointments', 'invoices', 'inspection_reports']) {
    assert.match(history, new RegExp(`from\\('${table}'\\)`));
  }
  assert.match(history, /Ouvrir le devis PDF/);
  assert.match(history, /Ouvrir l’ordre de réparation/);
  assert.match(history, /Ouvrir la facture PDF/);
  assert.match(history, /Ouvrir la fiche de contrôle/);
});

test('workshop preparation publishes the repair order PDF before intervention completion', async () => {
  const operations = await read('admin-operations.js');
  assert.match(operations, /publishPreparedOrder/);
  assert.match(operations, /generateFor\('order', current\.data\)/);
  assert.match(operations, /visible_to_client:\s*true/);
  assert.match(operations, /PDF publié et message OR envoyé au client/);
});
