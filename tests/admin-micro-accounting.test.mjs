import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('micro accounting schema remains configurable and admin-only', async () => {
  const sql = await read('supabase/migrations/20260724220000_micro_accounting_operations.sql');
  for (const table of ['suppliers','purchases','purchase_items','business_expenses','accounting_parameters','tax_obligations','cash_register_sessions','cash_register_entries']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /private\.is_admin\(\)/);
  assert.match(sql, /revoke all on public\.%I from anon/);
  assert.doesNotMatch(sql, /social_rate_services\s+numeric\s+not null\s+default/i);
  assert.doesNotMatch(sql, /social_rate_sales\s+numeric\s+not null\s+default/i);
});

test('parts support resale customer supplied and strict disbursement modes', async () => {
  const [sql, parts] = await Promise.all([
    read('supabase/migrations/20260724220000_micro_accounting_operations.sql'),
    read('admin-parts.js')
  ]);
  for (const mode of ['resale','customer_supplied','disbursement']) {
    assert.match(sql, new RegExp(mode));
    assert.match(parts, new RegExp(mode));
  }
  for (const field of ['customer_mandate_reference','customer_mandate_path','supplier_document_path','business_purchase_reference','purchase_total']) {
    assert.match(sql, new RegExp(field));
    assert.match(parts, new RegExp(field));
  }
  assert.match(sql, /v_purchase <> v_qty \* v_unit/);
  assert.match(sql, /admin_validate_quote_for_publication/);
  assert.match(sql, /admin_validate_invoice_for_issue/);
  assert.match(parts, /repair-documents/);
});

test('document totals are recalculated and cash entries are deduplicated', async () => {
  const sql = await read('supabase/migrations/20260724221000_micro_accounting_recalculation_and_cash.sql');
  const fix = await read('supabase/migrations/20260724221500_fix_item_recalculation_triggers.sql');
  assert.match(sql, /recalculate_quote_totals/);
  assert.match(sql, /recalculate_invoice_totals/);
  assert.match(sql, /cash_register_entries_payment_unique/);
  assert.match(sql, /cash_register_entries_expense_unique/);
  assert.match(sql, /cash_register_entries_purchase_unique/);
  assert.match(sql, /Ouvre la caisse avant d enregistrer un paiement en espèces/);
  assert.match(fix, /if tg_op = 'DELETE'/);
});

test('admin exposes purchases parts accounting and validates publication', async () => {
  const [html, core, quotes, invoices, finalization, purchases, accounting] = await Promise.all([
    read('admin.html'), read('admin-core.js'), read('admin-quotes.js'), read('admin-invoice-actions.js'),
    read('admin-finalization.js'), read('admin-purchases.js'), read('admin-micro-accounting.js')
  ]);
  for (const id of ['parts','purchases','micro-accounting','partsDocument','purchaseForm','microAccountingHost']) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(core, /EDMAdminParts/);
  assert.match(core, /EDMAdminPurchases/);
  assert.match(core, /EDMAdminMicroAccounting/);
  assert.match(quotes, /admin_validate_quote_for_publication/);
  assert.doesNotMatch(quotes, /const total = Number\(root/);
  assert.match(invoices, /admin_validate_invoice_for_issue/);
  assert.match(invoices, /bank_transfer/);
  assert.match(finalization, /customer_mandate_path/);
  assert.doesNotMatch(finalization, /line_total:/);
  assert.match(purchases, /admin_save_purchase/);
  assert.match(accounting, /Aucun taux n’est codé en dur/);
});

test('Vercel admin loader accepts versioned admin core tags', async () => {
  const source = await read('api/admin.js');
  assert.match(source, /admin-core\\\.js\\\?v=\\d\+/);
  assert.match(source, /Balise admin-core versionnée introuvable/);
});
