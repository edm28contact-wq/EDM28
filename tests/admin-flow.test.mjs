import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin shell exposes core workflow pages', async () => {
  const source = await read('admin.html');
  for (const id of ['dashboard','requests','quotes','notifications','clients','services','documents','accounting','business','settings']) {
    assert.match(source, new RegExp(`id="${id}"`));
  }
});

test('service requests require guarded workflow transitions', async () => {
  const source = await read('admin-requests.js');
  assert.match(source, /status === 'reviewed'/);
  assert.match(source, /status: 'draft'/);
  assert.match(source, /visible_to_client: false/);
  assert.match(source, /status: 'quoted'/);
});

test('quotes stay private until guarded publication', async () => {
  const source = await read('admin-quotes.js');
  assert.match(source, /validUntil < currentDate\(\)/);
  assert.match(source, /status:\s*'sent',\s*visible_to_client:\s*true/);
  assert.match(source, /\.eq\('status', 'draft'\)/);
  assert.match(source, /Seul un brouillon peut être modifié ou publié/);
});

test('localized draft quote labels remain visible in the active quote queue', async () => {
  const [visibility, workflow] = await Promise.all([
    read('admin-hide-published.js'),
    read('admin-quote-workflow.js')
  ]);
  assert.match(workflow, /pill\.textContent = 'Brouillon'/);
  assert.match(visibility, /!\['draft', 'brouillon'\]\.includes\(status\)/);
});

test('accepted quotes use the atomic planning RPC and stored duration', async () => {
  const source = await read('admin-operations.js');
  assert.match(source, /if \(!future\(startsAt\)\)/);
  assert.match(source, /duration < 15 \|\| duration > 480/);
  assert.match(source, /labor_duration_minutes/);
  assert.match(source, /rpc\('admin_prepare_quote'/);
  assert.match(source, /p_quote_id: q\.id/);
  assert.match(source, /p_starts_at: new Date\(startsAt\)\.toISOString\(\)/);
  assert.match(source, /p_order_number: orderNumber/);
});

test('finalization uses the atomic RPC and automatically generates the draft invoice PDF', async () => {
  const source = await read('admin-finalization.js');
  assert.match(source, /rpc\('admin_finalize_repair_order'/);
  assert.match(source, /p_order_id:\s*order\.id/);
  assert.match(source, /p_invoice_number:\s*invoiceNumber/);
  assert.match(source, /p_due_days:\s*dueDays/);
  assert.match(source, /generateInvoicePdf\(invoiceId\)/);
  assert.match(source, /generateFor\('invoice', invoiceResult\.data\)/);
  assert.match(source, /Facture brouillon créée et PDF généré automatiquement/);
});