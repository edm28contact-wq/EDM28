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

test('accepted quotes use the workshop module for planning and keep unpublished ready orders actionable', async () => {
  const source = await read('admin-operations.js');
  assert.match(source, /if \(!future\(startsAt\)\)/);
  assert.match(source, /duration < 15 \|\| duration > 480/);
  assert.match(source, /labor_duration_minutes/);
  assert.match(source, /rpc\('admin_prepare_quote'/);
  assert.match(source, /p_quote_id: q\.id/);
  assert.match(source, /p_starts_at: new Date\(startsAt\)\.toISOString\(\)/);
  assert.match(source, /p_order_number: orderNumber/);
  assert.match(source, /data-publish-ready/);
  assert.match(source, /order\.status !== 'ready'/);
  assert.match(source, /!order\.visible_to_client \|\| !order\.pdf_path/);
  assert.match(source, /generateFor\('order', current\.data\)/);
});

test('publishing a repair order creates an OR-specific client message after PDF publication', async () => {
  const source = await read('admin-operations.js');
  assert.match(source, /notifyPublishedOrder/);
  assert.match(source, /Ordre de réparation \$\{order\.order_number \|\| 'EDM28'\} disponible/);
  assert.match(source, /rpc\('admin_send_message'/);
  assert.match(source, /await notifyPublishedOrder\(\{ \.\.\.current\.data, pdf_path: pdfPath, visible_to_client: true \}\)/);
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

test('admin reset is red, requires an exact phrase and preserves administrators and configuration', async () => {
  const [reset, route, migration] = await Promise.all([
    read('admin-reset-data.js'),
    read('api/admin.js'),
    read('supabase/migrations/20260823234500_admin_reset_operational_data.sql')
  ]);
  assert.match(route, /admin-reset-data\.js/);
  assert.match(reset, /className = 'btn danger'/);
  assert.match(reset, /REINITIALISER EDM28/);
  assert.match(reset, /insertBefore\(button, logout\)/);
  assert.match(reset, /admin_reset_storage_paths/);
  assert.match(reset, /admin_reset_operational_data/);
  assert.match(migration, /if not private\.is_admin\(\)/);
  assert.match(migration, /profile\.role, 'customer'\) <> 'admin'/);
  assert.match(migration, /delete from auth\.users/);
  assert.match(migration, /delete from public\.document_sequences/);
  assert.doesNotMatch(migration, /delete from public\.business_configuration/);
  assert.doesNotMatch(migration, /delete from public\.site_services/);
  assert.doesNotMatch(migration, /delete from public\.automation_settings/);
});
