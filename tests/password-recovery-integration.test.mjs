import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import appHandler from '../api/app.js';
import adminHandler from '../api/admin.js';

// Test each deployment mode without using credentials inherited from the build.
const fixtureEnv = {
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://production-fixture.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_production_fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://fallback-fixture.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fallback_fixture',
  PREVIEW_SUPABASE_URL: 'https://preview-fixture.supabase.co',
  PREVIEW_SUPABASE_ANON_KEY: 'sb_publishable_preview_fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_production_test_only',
  PREVIEW_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_preview_test_only'
};

beforeEach((t) => {
  const saved = Object.fromEntries(Object.keys(fixtureEnv).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, fixtureEnv);
});

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const configuration = JSON.parse(await read('vercel.json'));
const routes = new Map(configuration.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
const response = () => ({
  statusCode: 0, headers: {}, body: null,
  status(code) { this.statusCode = code; return this; },
  setHeader(key, value) { this.headers[key.toLowerCase()] = String(value); },
  send(body) { this.body = body; return this; },
  end(body) { this.body = body ?? null; return this; }
});

async function request(path, options = {}) {
  const destination = new URL(routes.get(path) || path, 'https://edm28.fr');
  const res = response();
  await appHandler({ method: 'GET', url: destination.pathname + destination.search,
    query: Object.fromEntries(destination.searchParams), headers: { host: 'edm28.fr' }, ...options }, res);
  return res;
}

for (const [path, mode] of [['/mot-de-passe-oublie', 'request'], ['/reinitialiser-mot-de-passe', 'reset'], ['/admin-reset', 'admin'], ['/admin-reset.html', 'admin']]) {
  test(`real application serves ${path} without returning to the homepage`, async () => {
    assert.equal(routes.get(path), `/api/app?authRecovery=${mode}`);
    const res = await request(path);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers.location, undefined);
    assert.equal(res.headers['x-edm-recovery'], 'admin-client-v1');
    assert.match(res.headers['cache-control'], /no-store/);
    assert.match(res.body, new RegExp(`"mode":"${mode}"`));
    assert.doesNotMatch(res.body, /id="edm-recovery-bridge"/);
    assert.match(res.body, /id="passwordForm"/);
    for (const [, script] of res.body.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
  });
}

test('recovery respects production and preview configuration without exposing service keys', async () => {
  for (const [environment, url, key, otherKey] of [
    ['production', fixtureEnv.SUPABASE_URL, fixtureEnv.SUPABASE_ANON_KEY, fixtureEnv.PREVIEW_SUPABASE_ANON_KEY],
    ['preview', fixtureEnv.PREVIEW_SUPABASE_URL, fixtureEnv.PREVIEW_SUPABASE_ANON_KEY, fixtureEnv.SUPABASE_ANON_KEY]
  ]) {
    process.env.VERCEL_ENV = environment;
    const res = await request('/admin-reset');
    assert.equal(res.statusCode, 200, environment);
    assert.ok(res.body.includes(JSON.stringify(url)), environment);
    assert.ok(res.body.includes(JSON.stringify(key)), environment);
    assert.ok(!res.body.includes(otherKey), environment);
    assert.doesNotMatch(res.body, /sb_secret_/);
  }
});

test('production supports the public NEXT_PUBLIC configuration fallback', async () => {
  process.env.VERCEL_ENV = 'production';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const res = await request('/admin-reset');
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes(JSON.stringify(fixtureEnv.NEXT_PUBLIC_SUPABASE_URL)));
  assert.ok(res.body.includes(JSON.stringify(fixtureEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)));
  assert.doesNotMatch(res.body, /sb_secret_/);
});

const legacyKey = (role) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'),
  'test-only-signature'
].join('.');

for (const [environment, variable] of [
  ['production', 'SUPABASE_ANON_KEY'],
  ['production', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  ['preview', 'PREVIEW_SUPABASE_ANON_KEY']
]) {
  test(`recovery still rejects private and invalid keys from ${variable}`, async () => {
    process.env.VERCEL_ENV = environment;
    if (variable === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') delete process.env.SUPABASE_ANON_KEY;
    for (const key of ['sb_secret_rejected_fixture', legacyKey('service_role'), 'invalid-key-fixture']) {
      process.env[variable] = key;
      const res = await request('/admin-reset');
      assert.equal(res.statusCode, 503);
      assert.equal(res.headers.location, undefined);
      assert.match(res.headers['cache-control'], /no-store/);
      assert.ok(!res.body.includes(key));
      assert.doesNotMatch(res.body, /<script|id="passwordForm"/);
    }
  });

  test(`recovery accepts a legacy anon key from ${variable}`, async () => {
    process.env.VERCEL_ENV = environment;
    if (variable === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') delete process.env.SUPABASE_ANON_KEY;
    const key = legacyKey('anon');
    process.env[variable] = key;
    const res = await request('/admin-reset');
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes(JSON.stringify(key)));
    assert.doesNotMatch(res.body, /sb_secret_/);
  });
}

test('public client pages install recovery routing before existing auth scripts', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  for (const path of ['/', '/demande', '/mes-interventions']) {
    const res = await request(path);
    assert.equal(res.statusCode, 200, path);
    const bridge = res.body.indexOf('id="edm-recovery-bridge"');
    assert.ok(bridge > 0, path);
    assert.ok(bridge < res.body.indexOf('/public-client.js'), path);
    const source = res.body.match(/<script id="edm-recovery-bridge">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(source, path);
    new vm.Script(source);
  }
});

test('admin shell retains authentication and installs the same recovery bridge', () => {
  const res = response();
  adminHandler({ method: 'GET', url: '/admin', headers: { host: 'edm28.fr' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /id="adminResetPasswordBtn"/);
  const bridge = res.body.indexOf('id="edm-recovery-bridge"');
  assert.ok(bridge > 0);
  assert.ok(bridge < res.body.indexOf('eval(decodeURIComponent'));
  assert.match(res.body, /id="adminPassword"/);
});

test('recovery HEAD and unsupported methods do not serve the public site', async () => {
  const head = await request('/admin-reset', { method: 'HEAD' });
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, null);
  const post = await request('/admin-reset', { method: 'POST' });
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('recovery is not exposed in the sitemap', async () => {
  const res = await request('/sitemap.xml');
  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(res.body, /mot-de-passe|admin-reset/);
});
