import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client authentication uses password after one-time email verification', async () => {
  const [loader, auth] = await Promise.all([
    read('client-simple-flow.js'),
    read('client-password-flow.js')
  ]);

  assert.match(loader, /client-password-flow\.js\?v=2/);
  assert.doesNotMatch(loader, /client-otp-flow\.js/);
  assert.match(auth, /auth\.signUp\s*\(/);
  assert.match(auth, /auth\.signInWithPassword\s*\(/);
  assert.match(auth, /auth\.verifyOtp\s*\(/);
  assert.match(auth, /auth\.resend\s*\(/);
  assert.match(auth, /auth\.updateUser\(\{ password \}\)/);
  assert.match(auth, /shouldCreateUser:\s*false/);
  assert.match(auth, /MIN_PASSWORD_LENGTH\s*=\s*8/);
  assert.match(auth, /Les connexions suivantes utilisent l’email et le mot de passe/);
});

test('private client routes are guarded without duplicate click handlers', async () => {
  const source = await read('client-account-safe.js');
  assert.match(source, /new Set\(\['account', 'garage', 'history', 'messages'\]\)/);
  assert.match(source, /protectedPages\.has\(pageId\)/);
  assert.match(source, /baseShowPage\('appointment'\)/);
  assert.match(source, /baseShowPage\(pageId\)/);
  assert.doesNotMatch(source, /addEventListener\(['"]click/);
  assert.doesNotMatch(source, /stopImmediatePropagation/);
});

test('account hydration preserves non-empty fields', async () => {
  const source = await read('client-account-safe.js');
  assert.match(source, /first\(field\('firstName'\), current\.firstName/);
  assert.match(source, /first\(field\('lastName'\), current\.lastName/);
  assert.match(source, /first\(field\('phone'\), current\.phone/);
  assert.match(source, /first\(user\.email, field\('email'\), current\.email/);
});

test('Preview loads protected routes and refreshed password client flow', async () => {
  const source = await read('api/app.js');
  assert.match(source, /client-account-safe\.js\?v=13/);
  assert.match(source, /client-simple-flow\.js\?v=8/);
  assert.ok(source.indexOf('accountPrelude') < source.indexOf('integration.js'));
});

test('service worker refreshes scripts and deletes old caches', async () => {
  const source = await read('sw.js');
  assert.match(source, /edm28-pwa-v4/);
  assert.match(source, /networkFirst\(request\)/);
  assert.match(source, /caches\.delete/);
});

test('combo discount is suspended pending rate review', async () => {
  const [loader, policy] = await Promise.all([
    read('client-simple-flow.js'),
    read('combo-suspended.js')
  ]);
  assert.ok(loader.indexOf('client-step3-fixes.js') < loader.indexOf('combo-suspended.js'));
  assert.match(policy, /comboSaving:\s*0/);
  assert.match(policy, /comboDiscount:\s*0/);
  assert.match(policy, /comboSuspended:\s*true/);
  assert.match(policy, /pricingPolicy:\s*'combo_suspended'/);
  assert.match(policy, /laborAfter\s*=\s*roundMoney\(laborBase \+ controlFee\)/);
  assert.match(policy, /Remise combo suspendue/);
});

test('safe submit authenticates and API is idempotent', async () => {
  const [client, api] = await Promise.all([read('request-submit-safe.js'), read('api/submit-request-v2.js')]);
  assert.match(client, /getSession\s*\(/);
  assert.match(client, /Authorization:/);
  assert.match(api, /alreadySubmitted:\s*true/);
  assert.match(api, /Idempotency-Key/);
});

test('Preview and production Supabase credentials are isolated', async () => {
  const [config, app, admin, submit, deletion] = await Promise.all([
    read('api/supabase-config.js'),
    read('api/app.js'),
    read('api/admin.js'),
    read('api/submit-request-v2.js'),
    read('api/delete-account.js')
  ]);

  assert.match(config, /process\.env\.VERCEL_ENV === 'production'/);
  assert.match(config, /PREVIEW_SUPABASE_URL/);
  assert.match(config, /PREVIEW_SUPABASE_ANON_KEY/);
  assert.match(config, /process\.env\.SUPABASE_URL/);
  assert.match(config, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(config, /process\.env\.PREVIEW_SUPABASE_SERVICE_ROLE_KEY/);

  assert.match(app, /resolveSupabasePublicConfig/);
  assert.match(admin, /resolveSupabasePublicConfig/);
  assert.match(submit, /resolveSupabasePublicConfig/);
  assert.match(deletion, /resolveSupabaseServiceConfig/);
  assert.doesNotMatch(app + admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.ok(submit.includes('onboarding@resend\\.dev'));
});

test('submitted requests are loaded and refreshed in client history', async () => {
  const [submit, history, router, app, loader] = await Promise.all([
    read('request-submit-safe.js'),
    read('request-history.js'),
    read('client-navigation-visible.js'),
    read('api/app.js'),
    read('client-simple-flow.js')
  ]);
  assert.match(submit, /CustomEvent\('edm:request-submitted'/);
  assert.match(submit, /renderRequestHistory/);
  assert.match(history, /from\('service_requests'\)/);
  assert.match(history, /data-service-request-id/);
  assert.match(history, /MutationObserver/);
  assert.match(router, /window\.renderRequestHistory/);
  assert.match(app, /request-history\.js\?v=2/);
  assert.match(app, /client-simple-flow\.js\?v=8/);
  assert.match(loader, /request-submit-safe\.js\?v=4/);
});

test('messaging loop uses guarded RPCs and explicit human approval', async () => {
  const [loader, client, admin, router, ai, migration, hardening] = await Promise.all([
    read('client-simple-flow.js'),
    read('client-messages.js'),
    read('admin-messages.js'),
    read('client-navigation-visible.js'),
    read('api/ai-message-draft.js'),
    read('supabase/migrations/20260724190000_client_messaging_loop.sql'),
    read('supabase/migrations/20260724193000_client_messaging_hardening.sql')
  ]);

  assert.match(loader, /client-messages\.js\?v=1/);
  assert.match(router, /'messages'/);
  assert.match(router, /renderClientMessages/);
  assert.match(client, /rpc\('client_send_message'/);
  assert.match(client, /rpc\('client_mark_messages_read'/);
  assert.match(client, /read_by_admin/);
  assert.match(admin, /rpc\('admin_send_message'/);
  assert.match(admin, /Envoyer après validation/);
  assert.match(admin, /if \(!this\.isActive\(\)\) return/);
  assert.match(admin, /Brouillon IA modifié · validation humaine/);

  assert.match(ai, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(ai, /store:\s*false/);
  assert.match(ai, /type:\s*'json_schema'/);
  assert.match(ai, /strict:\s*true/);
  assert.match(ai, /PREVIEW_OPENAI_API_KEY/);
  assert.doesNotMatch(ai, /PREVIEW_OPENAI_API_KEY\s*\|\|\s*process\.env\.OPENAI_API_KEY/);
  assert.match(ai, /automation_settings/);
  assert.match(ai, /requiresHumanApproval:\s*true/);
  assert.match(ai, /select=id,first_name,last_name,role/);
  assert.doesNotMatch(ai, /select=id,first_name,last_name,phone,email/);

  assert.match(migration, /client_send_message/);
  assert.match(migration, /client_mark_messages_read/);
  assert.match(migration, /admin_send_message/);
  assert.match(migration, /admin_mark_conversation_read/);
  assert.match(hardening, /v_recent_count\s*>=\s*12/);
  assert.match(hardening, /profile\.role\s*=\s*'customer'/);
  assert.match(hardening, /v_draft_request_id is distinct from p_service_request_id/);
  assert.match(hardening, /'human_edited', v_human_edited/);
});

test('Preview exposes all client journey boundaries', async () => {
  const html = await read('index.html');
  for (const id of ['clientCard','vehicleCard','servicesArea','serviceList','basketList','btnSubmit','historyList','accountPageContent']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});
