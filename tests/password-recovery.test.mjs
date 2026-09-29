import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { recoveryBridge, recoveryBoot, injectRecoveryBridge, serveRecoveryPage } from '../password-recovery.js';

const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test', mode: 'reset' };
const validHash = '#type=recovery&access_token=test-access&refresh_token=test-refresh';

function browser(href, overrides = {}) {
  const calls = [];
  const nodes = new Map();
  const listeners = new Map();
  const location = new URL(href);
  location.replace = (url) => calls.push(['replace', url]);
  location.assign = (url) => calls.push(['assign', url]);
  const getNode = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      id, disabled: true, hidden: false, value: '', textContent: '', href: '',
      checkValidity() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value); },
      addEventListener(type, fn) { listeners.set(`${id}:${type}`, fn); },
      focus() { calls.push(['focus', id]); }
    });
    return nodes.get(id);
  };
  const user = { id: 'user-id', email: 'client@example.fr' };
  const auth = {
    async setSession(tokens) { calls.push(['setSession', tokens]); return { data: { session: { user } } }; },
    async verifyOtp(params) { calls.push(['verifyOtp', params]); return { data: { session: { user } } }; },
    async getUser() { calls.push(['getUser']); return { data: { user } }; },
    async resetPasswordForEmail(...args) { calls.push(['reset', ...args]); return {}; },
    async updateUser(params) { calls.push(['update', params]); return {}; },
    async signOut(params) { calls.push(['signOut', params]); return {}; },
    ...overrides
  };
  const document = { getElementById: getNode, addEventListener(type, fn, capture) {
    listeners.set(`document:${type}`, fn); calls.push(['listen', type, capture]);
  } };
  const window = { location, history: { replaceState(_, __, path) { calls.push(['clean', path]); } },
    supabase: { createClient(url, key, options) { calls.push(['create', url, key, options]); return { auth }; } } };
  const context = vm.createContext({ window, document, URL, URLSearchParams });
  const start = (mode = 'reset') => vm.runInContext(`(${recoveryBoot.toString()})(${JSON.stringify({ ...config, mode })})`, context);
  const bridge = () => vm.runInContext(`(${recoveryBridge.toString()})();`, context);
  const submit = (id) => listeners.get(`${id}:submit`)({ preventDefault() {} });
  return { calls, nodes, listeners, getNode, context, window, start, bridge, submit };
}

function response() {
  return { headers: {}, statusCode: 0, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; }
  };
}

for (const origin of ['https://edm28.fr', 'https://edm-28-five.vercel.app']) {
  test(`recovery on ${origin} goes to a dedicated same-origin page before tokens are consumed`, () => {
    const b = browser(origin + '/?next=https://attacker.invalid' + validHash);
    b.bridge();
    assert.deepEqual(b.calls[0], ['clean', '/']);
    const target = new URL(b.calls[1][1]);
    assert.equal(target.origin, origin);
    assert.equal(target.pathname, '/reinitialiser-mot-de-passe');
    assert.equal(target.hash, validHash);
    assert.equal(target.searchParams.has('next'), false);
  });
}

test('signup confirmation and ordinary navigation are not redirected', () => {
  for (const path of ['/', '/#type=signup&access_token=test', '/?code=signup-code']) {
    const b = browser('https://edm28.fr' + path);
    b.bridge();
    assert.equal(b.calls.some(([name]) => name === 'replace'), false);
  }
});

test('forgotten password buttons are intercepted for admin and client', () => {
  for (const id of ['adminResetPasswordBtn', 'client']) {
    const b = browser('https://edm28.fr/');
    b.bridge();
    let prevented = false, stopped = false;
    b.listeners.get('document:click')({ target: { closest: () => ({ id }) },
      preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.ok(prevented && stopped);
    assert.equal(b.calls.at(-1)[1], '/mot-de-passe-oublie' + (id === 'adminResetPasswordBtn' ? '?espace=admin' : ''));
  }
});

test('bridge is injected before existing scripts exactly once', () => {
  const original = '<html><head><script>existing()</script></head><body></body></html>';
  const result = injectRecoveryBridge(original);
  assert.ok(result.indexOf('edm-recovery-bridge') < result.indexOf('existing()'));
  assert.equal(injectRecoveryBridge(result), result);
  assert.equal(injectRecoveryBridge(Buffer.from('binary')).toString(), 'binary');
});

for (const suffix of ['', '?type=recovery', '?type=signup' + validHash.replace('type=recovery', 'type=signup'), '?type=recovery&code=old-pkce', '#type=recovery&error=access_denied']) {
  test(`missing or unusable recovery credentials stay disabled: ${suffix}`, async () => {
    const b = browser('https://edm28.fr/reinitialiser-mot-de-passe' + suffix);
    await b.start();
    assert.equal(b.getNode('savePassword').disabled, true);
    assert.match(b.getNode('recoveryStatus').textContent, /Lien absent/);
    assert.equal(b.calls.some(([name]) => name === 'update'), false);
  });
}

test('valid implicit recovery validates account and isolates existing sessions', async () => {
  const b = browser('https://edm28.fr/reinitialiser-mot-de-passe' + validHash);
  await b.start();
  assert.equal(b.getNode('savePassword').disabled, false);
  assert.match(b.getNode('recoveryAccount').textContent, /client@example.fr/);
  assert.equal(b.calls[0][0], 'clean');
  const options = b.calls.find(([name]) => name === 'create')[3];
  assert.equal(options.auth.persistSession, false);
  assert.equal(options.auth.detectSessionInUrl, false);
  assert.ok(b.calls.some(([name]) => name === 'getUser'));
});

test('token hash recovery is verified exactly once', async () => {
  const b = browser('https://edm28.fr/reinitialiser-mot-de-passe?type=recovery&token_hash=test-hash');
  await b.start();
  assert.equal(b.getNode('savePassword').disabled, false);
  assert.equal(b.calls.filter(([name]) => name === 'verifyOtp').length, 1);
  assert.equal(b.calls.find(([name]) => name === 'verifyOtp')[1].type, 'recovery');
});

test('expired or forged session cannot enable password update', async () => {
  const b = browser('https://edm28.fr/admin-reset' + validHash, { async setSession() { return { error: { status: 401 } }; } });
  await b.start('admin');
  assert.equal(b.getNode('savePassword').disabled, true);
});

test('a client recovery link is not accepted as an administrator recovery link', async () => {
  const b = browser('https://edm28.fr/admin-reset' + validHash);
  await b.start('admin');
  assert.equal(b.getNode('savePassword').disabled, true);
});

for (const [email, path] of [['client@example.fr', '/reinitialiser-mot-de-passe'], ['admin@edm28.fr', '/admin-reset']]) {
  test(`request for ${email} targets ${path}`, async () => {
    const b = browser('https://edm28.fr/mot-de-passe-oublie');
    await b.start('request');
    b.getNode('recoveryEmail').value = email;
    await b.submit('requestForm');
    assert.equal(b.calls.find(([name]) => name === 'reset')[2].redirectTo, 'https://edm28.fr' + path);
    assert.match(b.getNode('recoveryStatus').textContent, /Si un compte/);
  });
}

test('admin request retains the fixed admin address', async () => {
  const b = browser('https://edm28.fr/mot-de-passe-oublie?espace=admin');
  await b.start('request');
  assert.equal(b.getNode('recoveryEmail').readOnly, true);
  await b.submit('requestForm');
  assert.equal(b.calls.find(([name]) => name === 'reset')[1], 'admin@edm28.fr');
});

test('short and mismatching passwords are rejected before updateUser', async () => {
  const b = browser('https://edm28.fr/reinitialiser-mot-de-passe' + validHash);
  await b.start();
  for (const [password, confirmation] of [['short', 'short'], ['long-password', 'different-password']]) {
    b.getNode('newPassword').value = password;
    b.getNode('confirmPassword').value = confirmation;
    await b.submit('passwordForm');
    assert.equal(b.calls.some(([name]) => name === 'update'), false);
  }
});

test('successful update clears password fields and returns clients to their login', async () => {
  const b = browser('https://edm28.fr/reinitialiser-mot-de-passe' + validHash);
  await b.start();
  b.getNode('newPassword').value = b.getNode('confirmPassword').value = 'test-password-strong';
  await b.submit('passwordForm');
  assert.equal(b.calls.filter(([name]) => name === 'update').length, 1);
  assert.equal(b.getNode('newPassword').value, '');
  assert.equal(b.getNode('confirmPassword').value, '');
  assert.equal(b.getNode('savePassword').disabled, true);
  assert.equal(b.getNode('loginAfterReset').href, '/mes-interventions');
  assert.equal(b.getNode('loginAfterReset').hidden, false);
});

test('verified administrator returns to the back office', async () => {
  const b = browser('https://edm28.fr/admin-reset' + validHash, { async getUser() { return { data: { user: { id: 'admin-id', email: 'admin@edm28.fr' } } }; } });
  await b.start('admin');
  b.getNode('newPassword').value = b.getNode('confirmPassword').value = 'test-password-strong';
  await b.submit('passwordForm');
  assert.equal(b.getNode('loginAfterReset').href, '/admin');
});

test('network update error allows retry without claiming success', async () => {
  const b = browser('https://edm28.fr/reinitialiser-mot-de-passe' + validHash, { async updateUser() { throw new Error('network'); } });
  await b.start();
  b.getNode('newPassword').value = b.getNode('confirmPassword').value = 'test-password-strong';
  await b.submit('passwordForm');
  assert.equal(b.getNode('savePassword').disabled, false);
  assert.match(b.getNode('recoveryStatus').textContent, /Modification impossible/);
});

test('rendered recovery pages are not cached or indexed and carry no ambient session', () => {
  for (const mode of ['request', 'reset', 'admin']) {
    const res = response();
    assert.equal(serveRecoveryPage({ method: 'GET', url: '/api/app?authRecovery=' + mode }, res, config), true);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['cache-control'], /no-store/);
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.match(res.headers['x-robots-tag'], /noindex/);
    assert.match(res.body, /passwordForm/);
    assert.doesNotMatch(res.body, /public-client\.js|admin-core\.js/);
    const inline = [...res.body.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    for (const [, source] of inline) new vm.Script(source);
  }
});

test('HEAD, unsupported method and unrelated routes are handled explicitly', () => {
  for (const [method, code] of [['HEAD', 200], ['POST', 405]]) {
    const res = response();
    assert.equal(serveRecoveryPage({ method, query: { authRecovery: 'reset' } }, res, config), true);
    assert.equal(res.statusCode, code);
    assert.equal(res.body, null);
  }
  assert.equal(serveRecoveryPage({ method: 'GET', url: '/' }, response(), config), false);
});

test('secret keys cannot be embedded in a recovery page', () => {
  for (const key of ['sb_secret_do-not-expose', 'a.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.c']) {
    const res = response();
    serveRecoveryPage({ method: 'GET', query: { authRecovery: 'reset' } }, res, { ...config, key });
    assert.equal(res.statusCode, 503);
    assert.ok(!res.body.includes(key));
  }
});
