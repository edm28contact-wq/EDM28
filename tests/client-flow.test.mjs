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
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(fn, i + 1);
  }
  throw new Error(`Unclosed ${marker}`);
}

test('OTP flow is passwordless', async () => {
  const source = await read('client-otp-flow.js');
  assert.match(source, /signInWithOtp\s*\(/);
  assert.match(source, /verifyOtp\s*\(/);
  assert.doesNotMatch(source, /signInWithPassword/);
});

test('private client routes are guarded without duplicate click handlers', async () => {
  const source = await read('client-account-safe.js');
  assert.match(source, /new Set\(\['account', 'garage', 'history'\]\)/);
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

test('Preview loads protected routes module before optional modules', async () => {
  const source = await read('api/app.js');
  assert.match(source, /client-account-safe\.js\?v=13/);
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
  assert.match(app, /client-simple-flow\.js\?v=7/);
  assert.match(loader, /request-submit-safe\.js\?v=4/);
});

test('Preview exposes all client journey boundaries', async () => {
  const html = await read('index.html');
  for (const id of ['clientCard','vehicleCard','servicesArea','serviceList','basketList','btnSubmit','historyList','accountPageContent']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});
