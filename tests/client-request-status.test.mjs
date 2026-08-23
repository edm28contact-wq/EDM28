import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client request status exposes the seven business stages', async () => {
  const [status, router, app] = await Promise.all([
    read('client-request-status-history.js'),
    read('client-navigation-visible.js'),
    read('api/app.js')
  ]);

  for (const label of [
    'Envoyé',
    'Étudié',
    'Devis envoyé',
    'Intervention en préparation',
    'OR envoyé',
    'Intervention finie',
    'Facture envoyée'
  ]) assert.ok(status.includes(label), `étape absente : ${label}`);

  assert.match(router, /'request-status'/);
  assert.match(router, /renderRequestStatus/);
  assert.match(app, /client-request-status-history\.js\?v=1/);
});

test('request status derives progress from existing business records', async () => {
  const status = await read('client-request-status-history.js');
  for (const table of ['service_requests', 'quotes', 'appointments', 'repair_orders', 'invoices']) {
    assert.match(status, new RegExp(`from\\('${table}'\\)`));
  }
  assert.match(status, /visible_to_client\s*&&\s*row\.pdf_path/);
  assert.match(status, /PUBLISHED_INVOICE_STATUSES/);
  assert.match(status, /\['completed', 'invoiced'\]/);
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

test('workshop preparation publishes the repair order PDF before intervention completion', async () => {
  const operations = await read('admin-operations.js');
  assert.match(operations, /publishPreparedOrder/);
  assert.match(operations, /generateFor\('order', current\.data\)/);
  assert.match(operations, /visible_to_client:\s*true/);
  assert.match(operations, /ordre de réparation préparé et PDF publié au client/);
});
