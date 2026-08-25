import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('admin and client sessions use separate persistent storage namespaces', async () => {
  const [admin, client] = await Promise.all([
    read('admin-auth-persistence.js'),
    read('client-auth-persistence.js')
  ]);

  assert.match(admin, /STORAGE_SCOPE = 'edm:admin'/);
  assert.match(client, /STORAGE_SCOPE = 'edm:client'/);
  assert.match(admin, /scopedKey\(key\)/);
  assert.match(client, /scopedKey\(key\)/);
  assert.doesNotEqual(
    admin.match(/STORAGE_SCOPE = '([^']+)'/)?.[1],
    client.match(/STORAGE_SCOPE = '([^']+)'/)?.[1]
  );
});

test('persistent sessions refresh automatically and remember mode defaults on', async () => {
  for (const path of ['admin-auth-persistence.js', 'client-auth-persistence.js']) {
    const source = await read(path);
    assert.match(source, /persistSession:\s*true/);
    assert.match(source, /autoRefreshToken:\s*true/);
    assert.match(source, /rememberEnabled = \(\) => safeGet\(localStorage, PREFERENCE_KEY\) !== '0'/);
    assert.match(source, /Rester connecté sur ce PC/);
    assert.match(source, /ordinateur partagé/);
  }
});

test('non-persistent mode reads only sessionStorage and never falls back to localStorage', async () => {
  for (const path of ['admin-auth-persistence.js', 'client-auth-persistence.js']) {
    const source = await read(path);
    const getter = source.match(/getItem\(key\) \{([\s\S]*?)\n\s*\},\n\s*setItem/)?.[1] || '';
    assert.match(getter, /rememberEnabled\(\) \? localStorage : sessionStorage/);
    assert.doesNotMatch(getter, /secondary/);
    assert.doesNotMatch(getter, /\?\?/);
  }
});

test('changing remember preference migrates the active session between storage modes', async () => {
  for (const path of ['admin-auth-persistence.js', 'client-auth-persistence.js']) {
    const source = await read(path);
    assert.match(source, /const \{ data, error \} = await client\.auth\.getSession\(\)/);
    assert.match(source, /await client\.auth\.setSession\(\{/);
    assert.match(source, /access_token: session\.access_token/);
    assert.match(source, /refresh_token: session\.refresh_token/);
  }
});

test('persistence wrappers load before each Supabase client is created', async () => {
  const [adminHtml, appRoute] = await Promise.all([read('admin.html'), read('api/app.js')]);
  assert.ok(adminHtml.indexOf('/admin-auth-persistence.js') < adminHtml.indexOf('/admin-core.js'));
  assert.match(appRoute, /supabase-js@2<\/script><script src="\/client-auth-persistence\.js\?v=1"/);
});
