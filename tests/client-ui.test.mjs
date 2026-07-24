import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('client modules load in deterministic order', async () => {
  const source = await read('client-simple-flow.js');
  const modules = ['client-password-flow.js','client-step3-fixes.js','request-submit-safe.js','client-quotes.js','client-operations.js','client-invoices.js','client-document-download.js','client-notifications.js','combo-suspended.js'];
  let previous = -1;
  for (const module of modules) {
    const index = source.indexOf(module);
    assert.ok(index > previous, `${module} order`);
    previous = index;
  }
});

test('client signup verifies email once and subsequent logins use a password', async () => {
  const source = await read('client-password-flow.js');
  assert.match(source, /auth\.signUp\s*\(/);
  assert.match(source, /auth\.signInWithPassword\s*\(/);
  assert.match(source, /auth\.verifyOtp\s*\(/);
  assert.match(source, /auth\.resend\s*\(/);
  assert.match(source, /auth\.updateUser\(\{ password \}\)/);
  assert.match(source, /shouldCreateUser:\s*false/);
  assert.match(source, /MIN_PASSWORD_LENGTH\s*=\s*8/);
  assert.match(source, /passwordConfirm/);
  assert.match(source, /Mot de passe oublié \/ à définir/);
});

test('legacy recurring OTP flow is not loaded', async () => {
  const [loader, app, build] = await Promise.all([
    read('client-simple-flow.js'),
    read('api/app.js'),
    read('scripts/build-static.mjs')
  ]);
  assert.doesNotMatch(loader, /client-otp-flow\.js/);
  assert.match(loader, /client-password-flow\.js/);
  assert.match(app, /client-simple-flow\.js\?v=8/);
  assert.match(build, /client-simple-flow\.js\?v=8/);
});

test('combo discount is explicitly suspended in the client UI', async () => {
  const [loader, policy] = await Promise.all([
    read('client-simple-flow.js'),
    read('combo-suspended.js')
  ]);
  assert.ok(loader.indexOf('client-step3-fixes.js') < loader.indexOf('combo-suspended.js'));
  assert.match(policy, /comboSaving:\s*0/);
  assert.match(policy, /comboSuspended:\s*true/);
  assert.match(policy, /pricingPolicy:\s*'combo_suspended'/);
  assert.match(policy, /button\.disabled\s*=\s*true/);
  assert.match(policy, /Les taux sont en cours de révision/);
  assert.match(policy, /style\.display\s*=\s*'none'/);
});

test('safe submit requires auth, saves a draft and checks API success', async () => {
  const source = await read('request-submit-safe.js');
  assert.match(source, /getSession\s*\(/);
  assert.match(source, /if \(!data\?\.session\?\.user\) throw new Error\('Connexion requise\.'/);
  assert.match(source, /from\('vehicles'\)\.upsert/);
  assert.match(source, /from\('service_requests'\)\.insert/);
  assert.match(source, /status:\s*'draft'/);
  assert.match(source, /Authorization:\s*`Bearer \$\{session\.access_token\}`/);
  assert.match(source, /!response\.ok \|\| result\.success !== true/);
  assert.match(source, /error\.saved = result\.saved === true/);
  assert.match(source, /Votre demande est enregistrée/);
});

test('submit API authenticates, canonicalizes and is idempotent', async () => {
  const source = await read('api/submit-request-v2.js');
  assert.match(source, /\/auth\/v1\/user/);
  assert.match(source, /user_id:\s*`eq\.\$\{user\.id\}`/);
  assert.match(source, /request\.status === 'submitted'/);
  assert.match(source, /alreadySubmitted:\s*true/);
  assert.match(source, /Idempotency-Key': `service-request\/\$\{request\.id\}`/);
  assert.match(source, /status:\s*'submitted'/);
});

test('Preview handlers inject only public Supabase config before response', async () => {
  const [app, admin, config] = await Promise.all([
    read('api/app.js'),
    read('api/admin.js'),
    read('api/supabase-config.js')
  ]);
  assert.match(app + admin, /resolveSupabasePublicConfig/);
  assert.match(config, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(app + admin, /SERVICE_ROLE|service_role/);
});

test('client page exposes every journey boundary', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('api/app.js')]);
  for (const id of ['clientCard','vehicleCard','servicesArea','serviceList','basketList','btnSubmit','historyList']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.ok(app.indexOf('integration.js') < app.indexOf('client-simple-flow.js'));
});
