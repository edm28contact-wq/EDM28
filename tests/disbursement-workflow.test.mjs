import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client disbursement flow explains choices and requires an explicit mandate', async () => {
  const [loader, account, client] = await Promise.all([
    read('client-simple-flow.js'),
    read('client-account-safe.js'),
    read('client-disbursements.js')
  ]);
  assert.match(loader, /client-disbursements\.js\?v=1/);
  assert.doesNotMatch(account, /protectedPages/);
  assert.match(client, /Achat direct client/);
  assert.match(client, /Débours EDM/);
  assert.match(client, /Vente de pièce par EDM/);
  assert.match(client, /client_choose_disbursement/);
  assert.match(client, /data-mandate-check/);
  assert.match(client, /Je mandate EDM pour l’achat/);
  assert.match(client, /montant exact du justificatif/i);
});

test('admin disbursement flow blocks over-limit purchases and requires proof', async () => {
  const [admin, invoiceLock, adminLoader] = await Promise.all([
    read('admin-disbursements.js'),
    read('admin-disbursement-invoice-lock.js'),
    read('api/admin.js')
  ]);
  assert.match(adminLoader, /admin-disbursements\.js/);
  assert.match(adminLoader, /admin-disbursement-invoice-lock\.js/);
  assert.match(admin, /amount > n\(row\.authorized_limit\)/);
  assert.match(admin, /supplier_invoice_in_customer_name:\s*true/);
  assert.match(admin, /repair-documents/);
  assert.match(admin, /status:\s*'eligible'/);
  assert.match(admin, /requested_limit/);
  assert.match(admin, /Aucune marge/i);
  assert.match(invoiceLock, /Débours client/);
  assert.match(invoiceLock, /field\.disabled = true/);
});

test('database migration enforces exact no-margin disbursements end to end', async () => {
  const [migration, indexes] = await Promise.all([
    read('supabase/migrations/20260826150638_client_disbursement_workflow.sql'),
    read('supabase/migrations/20260826153500_client_disbursement_indexes.sql')
  ]);
  assert.match(migration, /guard_disbursement_integrity/);
  assert.match(migration, /client_choose_disbursement/);
  assert.match(migration, /no_margin is not true/);
  assert.match(migration, /supplier_invoice_in_customer_name is not true/);
  assert.match(migration, /new\.amount > new\.authorized_limit/);
  assert.match(migration, /admin_prepare_quote/);
  assert.match(migration, /Débours non finalisé/);
  assert.match(migration, /admin_finalize_repair_order/);
  assert.match(migration, /item_type, description/);
  assert.match(migration, /'disbursement'/);
  assert.match(migration, /guard_invoice_disbursements/);
  assert.match(migration, /margin_amount/);
  assert.match(migration, /status = 'reimbursed', exact_reimbursement = true/);
  assert.match(migration, /revoke all on function public\.client_choose_disbursement/);
  for (const column of ['user_id', 'vehicle_id', 'service_request_id', 'quote_id', 'invoice_id']) {
    assert.match(indexes, new RegExp(`disbursements_${column}_idx`));
  }
});

test('provision-first workflow blocks ordering and booking until parts are ready', async () => {
  const [migration, admin, client] = await Promise.all([
    read('supabase/migrations/20260924083520_disbursement_provision_workflow.sql'),
    read('admin-disbursements.js'),
    read('client-disbursements.js')
  ]);
  assert.match(migration, /provision_required/);
  assert.match(migration, /provision_received/);
  assert.match(migration, /disbursement_transactions/);
  assert.match(migration, /Provision client insuffisante/);
  assert.match(migration, /guard_appointment_parts_ready/);
  assert.match(migration, /parts_status <> 'received'/);
  assert.match(migration, /security invoker/i);
  assert.match(admin, /admin_record_disbursement_transaction/);
  assert.match(admin, /admin_set_disbursement_parts_status/);
  assert.match(admin, /data-record-provision/);
  assert.match(admin, /data-parts-status/);
  assert.match(client, /Provision à régler/);
  assert.match(client, /Reçu chez EDM28/);
  assert.match(client, /Remboursement client nécessaire/);
});

test('accounting keeps reimbursed disbursements separate from EDM service revenue', async () => {
  const accounting = await read('admin-accounting.js');
  assert.match(accounting, /disbursement_total/);
  assert.match(accounting, /billedServices \+= Math\.max\(0, total - disbursement\)/);
  assert.match(accounting, /reimbursedDisbursements/);
  assert.match(accounting, /paidGross - reimbursedDisbursements - expenseTotal/);
  assert.match(accounting, /Prestations facturées/);
  assert.match(accounting, /Débours remboursés/);
  assert.match(accounting, /Marge de trésorerie hors débours/);
});
