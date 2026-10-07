import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin shell exposes core workflow pages', async () => {
  const source = await read('admin.html');
  for (const id of ['dashboard','requests','quotes','operations','interventions','checklist','finalization','invoice-actions','accounting','notifications','clients','services','document-pdf','business','settings','audit-log']) {
    assert.match(source, new RegExp(`id="${id}"`));
  }
});

test('admin navigation follows the client journey and removes the legacy Documents screen', async () => {
  const [html, core] = await Promise.all([read('admin.html'), read('admin-core.js')]);
  const pages = ['requests','quotes','operations','interventions','checklist','finalization','invoice-actions','accounting'];
  let previous = -1;
  for (const page of pages) {
    const index = html.indexOf(`data-page="${page}"`);
    assert.ok(index > previous, `${page} must follow the client journey order`);
    previous = index;
  }
  assert.match(html, /data-page="requests">1 · Demandes/);
  assert.match(html, /data-page="quotes">2 · Devis & panier/);
  assert.match(html, /data-page="operations">3 · Rendez-vous/);
  assert.match(html, /data-page="interventions">4 · Interventions/);
  assert.match(html, /data-page="checklist">5 · Checklist de contrôle/);
  assert.match(html, /data-page="finalization">6 · Clôture/);
  assert.doesNotMatch(html, /data-page="documents"/);
  assert.doesNotMatch(html, /id="documents"/);
  assert.doesNotMatch(html, /admin-docs\.js/);
  assert.doesNotMatch(core, /EDMAdminDocs/);
  assert.match(html, /data-page="document-pdf">PDF · outil/);
});

test('service requests require guarded workflow transitions', async () => {
  const source = await read('admin-requests.js');
  assert.match(source, /status === 'reviewed'/);
  assert.match(source, /status: 'draft'/);
  assert.match(source, /visible_to_client: false/);
  assert.match(source, /status: 'quoted'/);
});

test('new service quotes stay private until the atomic publication RPC', async () => {
  const [source, helper, migration] = await Promise.all([
    read('admin-quotes.js'), read('admin-supplier-basket.js'),
    read('supabase/migrations/20260929153243_supplier_basket_quote_flow.sql')
  ]);
  assert.match(source, /const workflow = window\.EDMAdminSupplierBasket/);
  assert.match(source, /workflow\.saveDraft\(root\)/);
  assert.match(helper, /rpc\('admin_save_service_quote'/);
  assert.match(helper, /rpc\('admin_publish_service_quote'/);
  assert.ok(helper.indexOf("generateFor('quote'") < helper.indexOf("rpc('admin_publish_service_quote'"));
  assert.match(migration, /q\.status <> 'draft'/);
  assert.match(migration, /visible_to_client=false/);
  assert.match(migration, /new\.valid_until < current_date/);
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


test('post-intervention checklist selects the control set from the TTC threshold and gates finalization', async () => {
  const [html, interventions, checklist, finalization, pdf, migration] = await Promise.all([
    read('admin.html'),
    read('admin-interventions.js'),
    read('admin-checklist.js'),
    read('admin-finalization.js'),
    read('admin-inspection-complete-pdf.js'),
    read('supabase/migrations/20260930230000_post_intervention_checklist_gate.sql')
  ]);
  assert.match(html, /5 · Checklist de contrôle/);
  assert.match(html, /admin-checklist\.js/);
  assert.doesNotMatch(interventions, /inspection_reports/);
  assert.match(interventions, /intervention_completed_at/);
  assert.match(checklist, /Number\(total \|\| 0\) >= 100/);
  assert.match(checklist, /freinage_visuel/);
  assert.match(checklist, /niveau_huile_moteur/);
  assert.match(checklist, /feux_detresse/);
  assert.match(checklist, /status: 'completed'/);
  assert.match(checklist, /generateFor\('inspection'/);
  assert.match(finalization, /order\.status !== 'completed'/);
  assert.match(finalization, /\.eq\('status', 'completed'\)/);
  assert.match(pdf, /Contrôle essentiel - moins de 100 € TTC/);
  assert.match(pdf, /Contrôle complet - 100 € TTC et plus/);
  assert.match(migration, /intervention_completed_at/);
  assert.match(migration, /inspection_reports/);
  assert.match(migration, /visible_to_client/);
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
  const [reset, route, migration, html, core, passwordReset, vercelConfig] = await Promise.all([
    read('admin-reset-data.js'),
    read('api/admin.js'),
    read('supabase/migrations/20260823234500_admin_reset_operational_data.sql'),
    read('admin.html'),
    read('admin-core.js'),
    read('admin-reset.html'),
    read('vercel.json')
  ]);
  assert.match(route, /admin-reset-data\.js/);
  assert.match(html, /adminResetPasswordBtn/);
  assert.match(html, /Mot de passe oublié/);
  assert.match(core, /resetPasswordForEmail\(ADMIN_EMAIL/);
  assert.match(core, /https:\/\/edm28\.fr\/admin-reset/);
  assert.match(passwordReset, /PASSWORD_RECOVERY/);
  assert.match(passwordReset, /updateUser\(\{ password: newPassword \}\)/);
  assert.match(passwordReset, /location\.replace\('\/admin\?password-reset=success'\)/);
  assert.equal(
    JSON.parse(vercelConfig).routes.find((entry) => entry.src === '/admin-reset')?.dest,
    '/api/app?authRecovery=admin'
  );
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

test('admin authentication uses password only and no email OTP', async () => {
  const [source, html] = await Promise.all([read('admin-core.js'), read('admin.html')]);
  assert.match(source, /ADMIN_EMAIL = 'admin@edm28\.fr'/);
  assert.match(source, /auth\.signInWithPassword\s*\(/);
  assert.doesNotMatch(source, /auth\.signInWithOtp\s*\(/);
  assert.doesNotMatch(source, /auth\.verifyOtp\s*\(/);
  assert.doesNotMatch(html, /id="adminEmail"/);
  assert.match(html, /id="adminPassword"/);
});

test('business information save verifies the synchronized public projection', async () => {
  const [source, migration] = await Promise.all([
    read('admin-business.js'),
    read('supabase/migrations/20261006221500_sync_business_info_everywhere.sql')
  ]);
  assert.match(source, /public_business_profile/);
  assert.match(source, /Informations enregistrées et synchronisées/);
  assert.match(migration, /create table public\.public_business_profile/);
  assert.match(migration, /create trigger sync_public_business_profile/);
  assert.match(migration, /private\.sync_public_business_profile/);
  assert.match(migration, /grant select on public\.public_business_profile to anon, authenticated/);
  assert.match(migration, /'contact_email', cfg\.email/);
  assert.match(migration, /'contact_phone', cfg\.phone/);
  assert.doesNotMatch(migration, /'contact_email','contact@edm28\.fr'/);
});


test('business readiness uses one shared required-field definition and names missing fields', async () => {
  const [business, core, readiness] = await Promise.all([
    read('admin-business.js'),
    read('admin-core.js'),
    read('admin-readiness.js')
  ]);
  assert.match(business, /window\.EDMBusinessRequirements/);
  assert.match(business, /fields: requiredFields/);
  assert.match(business, /\['booking_url','Lien public de réservation',true\]/);
  assert.match(core, /window\.EDMBusinessRequirements/);
  assert.match(core, /missingLabels/);
  assert.match(core, /Entreprise non prête/);
  assert.match(core, /documents définitifs/);
  assert.match(readiness, /window\.EDMBusinessRequirements/);
  assert.match(readiness, /Lien public de réservation/);
  assert.match(readiness, /missing\.map\(\(item\) => item\.label\)/);
});


test('active customer journey foreign keys are indexed for scale', async () => {
  const migration = await read('supabase/migrations/20261007183000_core_journey_foreign_key_indexes.sql');
  for (const indexName of [
    'idx_quotes_service_request_id',
    'idx_quotes_vehicle_id',
    'idx_quote_items_quote_id',
    'idx_appointments_service_request_id',
    'idx_repair_orders_quote_id',
    'idx_repair_orders_user_id',
    'idx_repair_orders_vehicle_id',
    'idx_inspection_reports_repair_order_id',
    'idx_inspection_reports_user_id',
    'idx_invoices_quote_id',
    'idx_invoices_vehicle_id',
    'idx_payments_invoice_id',
    'idx_client_documents_vehicle_id',
    'idx_repair_documents_user_id'
  ]) {
    assert.match(migration, new RegExp(`create index if not exists ${indexName}`));
  }
});
