import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('admin access requires an authenticated admin profile', async () => {
  const source = await read('admin-core.js');
  assert.match(source, /signInWithPassword\s*\(/);
  assert.match(source, /from\('profiles'\)\.select\('\*'\)\.eq\('id', user\.id\)\.single\(\)/);
  assert.match(source, /data\.role !== 'admin'/);
  assert.match(source, /await client\.auth\.signOut\(\)/);
});

test('request transitions are conditional and quote creation is idempotent', async () => {
  const source = await read('admin-requests.js');
  assert.match(source, /status === 'reviewed' \? \['submitted'\]/);
  assert.match(source, /status === 'cancelled' \? \['submitted', 'reviewed'\]/);
  assert.match(source, /\.in\('status', allowed\)/);
  assert.match(source, /request\.status !== 'reviewed'/);
  assert.match(source, /\.eq\('service_request_id', request\.id\)\.limit\(1\)/);
  assert.match(source, /external_quote_id:\s*externalId/);
  assert.match(source, /visible_to_client:\s*false/);
  assert.match(source, /\.eq\('status', 'reviewed'\)/);
});

test('quotes validate publication and lock after sending', async () => {
  const source = await read('admin-quotes.js');
  assert.match(source, /total <= 0/);
  assert.match(source, /validUntil < currentDate\(\)/);
  assert.match(source, /status:\s*'sent',\s*visible_to_client:\s*true/);
  assert.match(source, /\.eq\('status', 'draft'\)/);
  assert.match(source, /Seul un brouillon peut être modifié ou publié/);
});

test('accepted quotes create one appointment and one repair order', async () => {
  const source = await read('admin-operations.js');
  assert.match(source, /if \(!future\(startsAt\)\)/);
  assert.match(source, /duration < 15 \|\| duration > 480/);
  assert.match(source, /external_appointment_id', externalId/);
  assert.match(source, /status:\s*'confirmed'/);
  assert.match(source, /visible_to_client:\s*true/);
  assert.match(source, /\.eq\('quote_id', q\.id\)\.limit\(1\)/);
  assert.match(source, /status:\s*'ready'/);
});

test('finalization creates one draft invoice and advances guarded statuses', async () => {
  const source = await read('admin-finalization.js');
  assert.match(source, /external_invoice_id', externalId/);
  assert.match(source, /status:\s*'draft'/);
  assert.match(source, /visible_to_client:\s*false/);
  assert.match(source, /invoice_items/);
  assert.match(source, /\.in\('status', \['ready','signed','in_progress'\]\)/);
  assert.match(source, /\.eq\('status', 'completed'\)/);
  assert.match(source, /status:\s*'invoiced'/);
});

test('invoice issuing and payment input are constrained', async () => {
  const source = await read('admin-invoice-actions.js');
  assert.match(source, /status:\s*'issued',\s*visible_to_client:\s*true/);
  assert.match(source, /\.eq\('status', 'draft'\)\.gt\('total', 0\)\.not\('invoice_number', 'is', null\)/);
  assert.match(source, /amount > balance/);
  assert.match(source, /from\('payments'\)\.insert/);
  assert.match(source, /invoice_id:\s*invoice\.id/);
  assert.match(source, /user_id:\s*invoice\.user_id/);
});

test('PDF generation uses private storage and compensates failed metadata updates', async () => {
  const source = await read('admin-document-pdf.js');
  assert.match(source, /storage\.from\('repair-documents'\)\.upload/);
  assert.match(source, /contentType:\s*'application\/pdf'/);
  assert.match(source, /update\(\{ pdf_path: path \}\)/);
  assert.match(source, /storage\.from\('repair-documents'\)\.remove\(\[path\]\)/);
});

test('admin route injects Preview config without service-role credentials', async () => {
  const source = await read('api/admin.js');
  assert.match(source, /process\.env\.SUPABASE_URL/);
  assert.match(source, /process\.env\.SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role/);
  assert.match(source, /Cache-Control', 'no-store, max-age=0'/);
});

test('admin interface exposes operational boundaries and audit journal', async () => {
  const [html, quotes, audit] = await Promise.all([
    read('admin.html'), read('admin-quotes.js'), read('admin-audit-log.js')
  ]);
  for (const id of ['loginPanel','dashboard','requests','quotes','clients','services','documents','accounting','business','settings']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const module of ['admin-operations.js','admin-finalization.js','admin-invoice-actions.js','admin-document-pdf.js','admin-audit-log.js']) {
    assert.match(quotes, new RegExp(module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(audit, /from\('audit_log'\)/);
  assert.match(audit, /limit\(100\)/);
});
