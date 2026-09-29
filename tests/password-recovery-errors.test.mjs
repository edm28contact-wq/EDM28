import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { recoveryBridge, recoveryBoot } from '../password-recovery.js';

function bridge(href) {
  const current = new URL(href);
  const navigation = [];
  const cleaned = [];
  let bound = false;
  runInNewContext(`(${recoveryBridge.toString()})()`, {
    URL, URLSearchParams,
    window: {
      location: { href, origin: current.origin, replace: (url) => navigation.push(url) },
      history: { replaceState: (_state, _title, url) => cleaned.push(url) }
    },
    document: { addEventListener: () => { bound = true; } }
  });
  return { navigation, cleaned, bound };
}

for (const [name, href] of [
  ['expired fragment', 'https://edm28.fr/#error=access_denied&error_code=otp_expired'],
  ['expired query', 'https://edm28.fr/?error=access_denied&error_code=otp_expired']
]) {
  test(`${name} without type opens an explicit error page`, () => {
    const result = bridge(href);
    assert.equal(result.navigation.length, 1);
    const target = new URL(result.navigation[0]);
    assert.equal(target.origin, new URL(href).origin);
    assert.equal(target.pathname, '/reinitialiser-mot-de-passe');
    const fragment = new URLSearchParams(target.hash.slice(1));
    assert.equal(fragment.get('error_code') || target.searchParams.get('error_code'), 'otp_expired');
    assert.equal(fragment.get('type') || target.searchParams.get('type'), null);
    assert.equal(result.cleaned[0], '/');
    assert.equal(result.bound, false);
  });
}

for (const origin of ['https://edm28.fr', 'https://edm-28-five.vercel.app']) {
  test(`valid recovery stays on its trusted origin: ${origin}`, () => {
    const fragment = '#type=recovery&access_token=test-only&refresh_token=test-only';
    const result = bridge(`${origin}/?next=https://untrusted.example/${fragment}`);
    const target = new URL(result.navigation[0]);
    assert.equal(target.origin, origin);
    assert.equal(target.pathname, '/reinitialiser-mot-de-passe');
    assert.equal(target.hash, fragment);
    assert.equal(target.searchParams.has('next'), false);
  });
}

for (const [name, href] of [
  ['ordinary visit', 'https://edm28.fr/?source=email'],
  ['signup confirmation', 'https://edm28.fr/#type=signup&access_token=test-only'],
  ['typed signup error', 'https://edm28.fr/#type=signup&error_code=otp_expired'],
  ['magic link', 'https://edm28.fr/#type=magiclink&access_token=test-only'],
  ['unrelated error', 'https://edm28.fr/?error=payment_failed&error_code=declined']
]) {
  test(`${name} is not treated as password recovery`, () => {
    const result = bridge(href);
    assert.equal(result.navigation.length, 0);
    assert.equal(result.cleaned.length, 0);
    assert.equal(result.bound, true);
  });
}

async function boot(href) {
  const nodes = new Map();
  const calls = [];
  const user = { id: 'test-user', email: 'customer@example.test' };
  const auth = {
    setSession: async () => { calls.push('setSession'); return { data: { session: { user } }, error: null }; },
    verifyOtp: async () => { calls.push('verifyOtp'); return { data: { session: { user } }, error: null }; },
    getUser: async () => { calls.push('getUser'); return { data: { user }, error: null }; }
  };
  const getElementById = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      disabled: true, hidden: false, value: '', textContent: '', className: '',
      addEventListener() {}, checkValidity() { return true; }, focus() {}
    });
    return nodes.get(id);
  };
  await runInNewContext(`(${recoveryBoot.toString()})({ url: 'https://test.supabase.co', key: 'sb_publishable_test', mode: 'reset' })`, {
    URL, URLSearchParams,
    document: { getElementById },
    window: {
      location: { href, origin: new URL(href).origin },
      history: { replaceState() {} },
      supabase: { createClient: () => ({ auth }) }
    }
  });
  return { nodes, calls };
}

for (const [name, href] of [
  ['fragment error code', 'https://edm28.fr/admin-reset#type=recovery&error_code=otp_expired&access_token=test-only&refresh_token=test-only'],
  ['query error code', 'https://edm28.fr/admin-reset?type=recovery&error_code=otp_expired&token_hash=test-only']
]) {
  test(`${name} alone never enables a password change`, async () => {
    const result = await boot(href);
    assert.equal(result.calls.length, 0);
    assert.equal(result.nodes.get('savePassword').disabled, true);
    assert.equal(result.nodes.get('newPassword').disabled, true);
    assert.equal(result.nodes.get('confirmPassword').disabled, true);
    assert.match(result.nodes.get('recoveryStatus').textContent, /Lien absent, invalide/);
  });
}

test('untyped expiry does not assert that an email confirmation is a password reset', async () => {
  const result = await boot('https://edm28.fr/reinitialiser-mot-de-passe#error=access_denied&error_code=otp_expired');
  assert.equal(result.calls.length, 0);
  assert.equal(result.nodes.get('savePassword').disabled, true);
  const text = result.nodes.get('recoveryStatus').textContent;
  assert.match(text, /lien email/i);
  assert.match(text, /mot de passe/i);
  assert.match(text, /confirmation/i);
});
