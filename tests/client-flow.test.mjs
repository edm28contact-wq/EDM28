import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function functionSource(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${marker}`);
  const fn = source.indexOf('function', start);
  const brace = source.indexOf('{', fn);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(fn, i + 1);
  }
  throw new Error(`Unclosed ${marker}`);
}

test('client modules load in deterministic order', async () => {
  const source = await read('client-simple-flow.js');
  const modules = ['client-otp-flow.js','client-step3-fixes.js','request-submit-safe.js','client-quotes.js','client-operations.js','client-invoices.js','client-document-download.js','client-notifications.js'];
  let previous = -1;
  for (const module of modules) {
    const index = source.indexOf(module);
    assert.ok(index > previous, `${module} order`);
    previous = index;
  }
});

test('OTP flow is passwordless and validates six digits', async () => {
  const source = await read('client-otp-flow.js');
  assert.match(source, /signInWithOtp\s*\(/);
  assert.match(source, /shouldCreateUser:\s*true/);
  assert.match(source, /verifyOtp\s*\(\{\s*email,\s*token,\s*type:\s*'email'/s);
  assert.match(source, /slice\(0,\s*6\)/);
  assert.match(source, /password.*closest\('label'\).*remove\(\)/s);
  assert.match(source, /removeLegacyPasswordUi\(\)/);
});

test('legacy password authentication cannot be reintroduced', async () => {
  const [auth, otp, app, build] = await Promise.all([
    read('auth.js'),
    read('client-otp-flow.js'),
    read('api/app.js'),
    read('scripts/build-static.mjs')
  ]);
  assert.doesNotMatch(auth, /signInWithPassword|auth\.signUp|prompt\([^)]*mot de passe/i);
  assert.match(otp, /window\.signUpWithSupabase\s*=\s*undefined/);
  assert.match(otp, /window\.signInWithSupabase\s*=\s*undefined/);
  assert.match(app, /client-simple-flow\.js/);
  assert.match(build, /client-simple-flow\.js/);
});

test('combo discount only groups compatible categories', async () => {
  const source = await read('client-step3-fixes.js');
  const fn = functionSource(source, 'calculateTotals = function patchedCalculateTotals');
  let selected = [
    { category:'Freinage', labor:69, eligible:true, excluded:false, parts:{standard:[40,70]} },
    { category:'Freinage', labor:99, eligible:true, excluded:false, parts:{standard:[120,170]} },
    { category:'Freinage', labor:55, eligible:false, excluded:true, parts:{standard:[15,25]} }
  ];
  let checked = true;
  const context = { calculateTotals:null, getSelectedServices:()=>selected, selectedBasket:'standard', document:{getElementById:()=>({checked})}, toast(){}, Map, Array, Number, Math, String };
  vm.createContext(context);
  vm.runInContext(`calculateTotals = ${fn}`, context);
  const result = context.calculateTotals();
  assert.equal(result.comboSaving, 20.7);
  assert.equal(result.totalAllMin, 407.3);
  selected = [
    { category:'Freinage', labor:69, eligible:true, excluded:false, parts:{standard:[40,70]} },
    { category:'Train avant', labor:70, eligible:true, excluded:false, parts:{standard:[55,95]} }
  ];
  checked = false;
  assert.equal(context.calculateTotals().comboSaving, 0);
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
  assert.match(source, /required\.some\(\(name\) => !process\.env\[name\]\)/);
});

test('Preview handlers inject only public Supabase config before response', async () => {
  const [app, admin] = await Promise.all([read('api/app.js'), read('api/admin.js')]);
  assert.ok(app.indexOf('const supabaseUrl') < app.indexOf('return res.status(200).send(html)'));
  assert.ok(admin.indexOf('const supabaseUrl') < admin.indexOf('return res.status(200).send(html)'));
  assert.match(app + admin, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(app + admin, /SERVICE_ROLE|service_role/);
});

test('client page exposes every journey boundary', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('api/app.js')]);
  for (const id of ['clientCard','vehicleCard','servicesArea','serviceList','basketList','btnSubmit','historyList']) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.ok(app.indexOf('integration.js') < app.indexOf('client-simple-flow.js'));
});
