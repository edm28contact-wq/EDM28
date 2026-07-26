import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('admin access is passwordless and requires an authenticated admin profile', async () => {
  const source = await read('admin-core.js');
  assert.match(source, /signInWithOtp\s*\(/);
  assert.match(source, /shouldCreateUser:\s*false/);
  assert.match(source, /verifyOtp\s*\(\{\s*email,\s*token,\s*type:\s*'email'/s);
  assert.doesNotMatch(source, /signInWithPassword\s*\(/);
  assert.match(source, /adminPassword[\s\S]*closest\('label'\)\?\.remove\(\)/);
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
  assert.match(source, /!\(total > 0\)/);
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

test('draft invoice saving validates every row and uses one database transaction', async () => {
  const source = await read('admin-transactional.js');
  assert.match(source, /admin_save_draft_invoice/);
  assert.match(source, /Ligne \$\{index \+ 1\} : désignation obligatoire/);
  assert.match(source, /quantité positive obligatoire/);
  assert.match(source, /taux de TVA invalide/);
  assert.match(source, /coût d’achat invalide/);
  assert.match(source, /p_items:\s*invoiceItems\(root\)/);
});

test('PDF generation uses private storage and compensates failed metadata updates', async () => {
  const source = await read('admin-document-pdf.js');
  assert.match(source, /storage\.from\('repair-documents'\)\.upload/);
  assert.match(source, /contentType:\s*'application\/pdf'/);
  assert.match(source, /update\(\{ pdf_path: path \}\)/);
  assert.match(source, /storage\.from\('repair-documents'\)\.remove\(\[path\]\)/);
});

test('admin route injects environment-scoped public config without service-role credentials', async () => {
  const [source, config] = await Promise.all([
    read('api/admin.js'),
    read('api/supabase-config.js')
  ]);
  assert.match(source, /resolveSupabasePublicConfig/);
  assert.match(config, /process\.env\.SUPABASE_URL/);
  assert.match(config, /process\.env\.SUPABASE_ANON_KEY/);
  assert.match(config, /PREVIEW_SUPABASE_URL/);
  assert.match(config, /PREVIEW_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role/);
  assert.match(source, /Cache-Control', 'no-store, max-age=0'/);
  assert.match(source, /X-EDM-Environment/);
});

test('admin messaging requires explicit human approval before publication', async () => {
  const [html, core, messages, ai, hardening] = await Promise.all([
    read('admin.html'),
    read('admin-core.js'),
    read('admin-messages.js'),
    read('api/ai-message-draft.js'),
    read('supabase/migrations/20260724193000_client_messaging_hardening.sql')
  ]);

  assert.match(html, /admin-messages\.js\?v=(?:1|__EDM_BUILD__)/);
  assert.match(core, /messages:\s*\(\) => window\.EDMAdminMessages\?\.load\(\)/);
  assert.match(messages, /Proposer avec l’IA/);
  assert.match(messages, /Envoyer après validation/);
  assert.match(messages, /selectedDraftId/);
  assert.match(messages, /rpc\('admin_send_message'/);
  assert.match(messages, /if \(!this\.isActive\(\)\) return/);
  assert.match(messages, /Le client ou la demande a changé pendant la génération/);
  assert.match(ai, /requiresHumanApproval:\s*true/);
  assert.match(ai, /document_type:\s*'message'/);
  assert.doesNotMatch(ai, /client_messages\?select=.*method:\s*'POST'/s);
  assert.match(hardening, /status = 'published'/);
  assert.match(hardening, /approved_by = auth\.uid\(\)/);
  assert.match(hardening, /'published_message_id', v_message_id/);
});

test('client folders accept private photos and PDF history files', async () => {
  const source = await read('admin-clients.js');
  assert.match(source, /const HISTORY_FOLDER = 'client-history'/);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /accept="application\/pdf,\.pdf"/);
  assert.match(source, /seuls les photos et les PDF sont autorisés/);
  assert.match(source, /MAX_FILE_SIZE = 10 \* 1024 \* 1024/);
  assert.match(source, /storage\.from\('repair-documents'\)\.upload/);
  assert.match(source, /storage\.from\('repair-documents'\)\.list/);
  assert.match(source, /createSignedUrl\(path, 300\)/);
  assert.match(source, /data-delete-history-file/);
  assert.match(source, /storage\.from\('repair-documents'\)\.remove/);
});

test('dashboard normalizes nullable database results and loads every visible module', async () => {
  const source = await read('admin-core.js');
  assert.match(source, /listData\(result\)/);
  assert.match(source, /Array\.isArray\(result\?\.data\) \? result\.data : \[\]/);
  assert.match(source, /objectData\(result\)/);
  assert.match(source, /results\.slice\(0, 9\)\.map\(\(result\) => this\.listData\(result\)\)/);
  assert.match(source, /const business = this\.objectData\(results\[9\]\)/);
  for (const module of ['notifications','services','documents','business','settings']) {
    assert.match(source, new RegExp(`${module}:\\s*\\(\\) =>`));
  }
});

test('admin interface exposes operational boundaries and audit journal', async () => {
  const [html, quotes, audit] = await Promise.all([
    read('admin.html'), read('admin-quotes.js'), read('admin-audit-log.js')
  ]);
  for (const id of ['loginPanel','dashboard','requests','quotes','notifications','clients','services','documents','accounting','business','settings']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const module of ['admin-operations.js','admin-finalization.js','admin-invoice-actions.js','admin-document-pdf.js','admin-audit-log.js']) {
    assert.match(quotes, new RegExp(module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(audit, /from\('audit_log'\)/);
  assert.match(audit, /limit\(100\)/);
});