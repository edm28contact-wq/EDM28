import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client disbursement flow collects billing details and requires prepayment', async () => {
  const [loader, account, client, entry] = await Promise.all([
    read('client-simple-flow.js'),
    read('client-account-safe.js'),
    read('client-disbursements.js'),
    read('client-disbursement-entry.js')
  ]);
  assert.match(loader, /client-disbursements\.js\?v=2/);
  assert.match(loader, /client-disbursement-entry\.js\?v=1/);
  assert.match(account, /protectedPages\.add\('disbursements'\)/);
  assert.match(client, /Coordonnées débours/);
  assert.match(client, /Paiement avant commande/);
  assert.match(client, /À payer/);
  assert.match(client, /Payé/);
  assert.match(client, /client_choose_disbursement/);
  assert.match(client, /client_save_disbursement_billing/);
  assert.match(client, /\/api\/disbursement-payment-create/);
  assert.match(client, /\/api\/disbursement-payment-status/);
  assert.match(client, /data-mandate-check/);
  assert.match(entry, /value !== 'edm_disbursement'/);
  assert.match(entry, /navigate\(\)/);
  assert.match(entry, /edm:request-submitted/);
});

test('admin disbursement flow blocks purchases until verified payment and refunds surplus', async () => {
  const [admin, guard, adminHtml] = await Promise.all([
    read('admin-disbursements.js'),
    read('admin-disbursement-prepayment.js'),
    read('admin.html')
  ]);
  assert.match(admin, /amount > n\(row\.authorized_limit\)/);
  assert.match(admin, /supplier_invoice_in_customer_name:\s*true/);
  assert.match(admin, /repair-documents/);
  assert.match(guard, /payment_status !== 'paid'/);
  assert.match(guard, /Achat bloqué/);
  assert.match(guard, /\/api\/disbursement-payment-status/);
  assert.match(guard, /\/api\/disbursement-payment-refund/);
  assert.match(adminHtml, /admin-disbursement-prepayment\.js/);
});

test('database migration enforces prepayment, billing and no-margin disbursements', async () => {
  const [baseMigration, paymentMigration, hardening, indexes] = await Promise.all([
    read('supabase/migrations/20260826150638_client_disbursement_workflow.sql'),
    read('supabase/migrations/20260911203000_disbursement_prepayment.sql'),
    read('supabase/migrations/20260911203100_disbursement_prepayment_hardening.sql'),
    read('supabase/migrations/20260826153500_client_disbursement_indexes.sql')
  ]);
  assert.match(baseMigration, /guard_disbursement_integrity/);
  assert.match(paymentMigration, /create table if not exists public\.disbursement_payments/);
  assert.match(paymentMigration, /payment_status text not null default 'to_pay'/);
  assert.match(paymentMigration, /Paiement du debours obligatoire avant toute commande de piece/);
  assert.match(paymentMigration, /prepaid_amount/);
  assert.match(paymentMigration, /apply_disbursement_prepayments_to_invoice/);
  assert.match(hardening, /auth\.role\(\).*service_role/s);
  assert.match(hardening, /client_save_disbursement_billing/);
  for (const column of ['user_id', 'vehicle_id', 'service_request_id', 'quote_id', 'invoice_id']) {
    assert.match(indexes, new RegExp(`disbursements_${column}_idx`));
  }
});

test('payment routes share one Vercel function and keep Stripe verification server-side', async () => {
  const [payment, vercel] = await Promise.all([
    read('api/disbursement-payment.js'),
    read('vercel.json')
  ]);
  assert.match(payment, /process\.env\.STRIPE_SECRET_KEY/);
  assert.match(payment, /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/);
  assert.match(payment, /metadata\[disbursement_id\]/);
  assert.match(payment, /session\.status === 'complete'/);
  assert.match(payment, /session\.payment_status === 'paid'/);
  assert.match(payment, /payment_intent_id/);
  assert.match(payment, /https:\/\/api\.stripe\.com\/v1\/refunds/);
  assert.match(payment, /Accès administrateur requis/);
  assert.doesNotMatch(payment, /STRIPE_PUBLISHABLE_KEY/);
  assert.match(vercel, /disbursement-payment-create[^\n]+disbursement-payment\?action=create/);
  assert.match(vercel, /disbursement-payment-status[^\n]+disbursement-payment\?action=status/);
  assert.match(vercel, /disbursement-payment-refund[^\n]+disbursement-payment\?action=refund/);
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
