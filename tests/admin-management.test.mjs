import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('admin exposes a configurable management area', async () => {
  const [html, management, core] = await Promise.all([
    read('admin.html'), read('admin-management.js'), read('admin-core.js')
  ]);
  assert.match(html, /data-page="management"/);
  assert.match(html, /id="managementForm"/);
  assert.match(html, /admin-management\.js\?v=2/);
  for (const section of ['Activité','Modules','Comptabilité','Pièces et débours']) assert.match(management, new RegExp(section));
  assert.match(management, /from\('backoffice_configuration'\)/);
  assert.match(core, /loadBackofficeConfiguration/);
  assert.match(core, /applyModuleVisibility/);
});

test('part handling keeps three exclusive business meanings and strict disbursement controls', async () => {
  const [management, migration] = await Promise.all([
    read('admin-management.js'),
    read('supabase/migrations/20260724213000_backoffice_management_and_part_modes.sql')
  ]);
  for (const mode of ['resale','customer_supplied','disbursement']) {
    assert.match(management, new RegExp(mode));
    assert.match(migration, new RegExp(mode));
  }
  assert.match(management, /strict_disbursement_controls:\s*true/);
  assert.match(migration, /purchase_total = quantity \* unit_price/);
  assert.match(migration, /supplier_invoice_holder = 'customer'/);
  assert.match(migration, /customer_mandate_reference/);
  assert.match(migration, /supplier_document_path/);
  assert.match(migration, /not allow_disbursements or strict_disbursement_controls/);
});

test('configuration is admin-only and required fields are validated', async () => {
  const [management, migration] = await Promise.all([
    read('admin-management.js'),
    read('supabase/migrations/20260724213000_backoffice_management_and_part_modes.sql')
  ]);
  for (const field of ['declared_activity_label','activity_kind','vat_mode','urssaf_frequency','stock_mode']) {
    assert.match(management, new RegExp(field));
  }
  assert.match(management, /markRequired/);
  assert.match(migration, /using \(\(select private\.is_admin\(\)\)\)/);
  assert.match(migration, /revoke all on public\.backoffice_configuration from anon/);
});
