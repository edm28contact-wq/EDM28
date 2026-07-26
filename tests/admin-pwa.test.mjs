import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); return this; },
    end(body) { this.body = body ?? null; return this; },
    send(body) { this.body = body ?? null; return this; }
  };
}

test('admin manifest is installable on desktop and Android', async () => {
  const manifest = JSON.parse(await read('admin-manifest.webmanifest'));
  assert.equal(manifest.id, '/admin');
  assert.match(manifest.name, /EDM28/);
  assert.equal(manifest.start_url, '/admin?source=pwa');
  assert.equal(manifest.scope, '/admin');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith('/api/admin?icon=')));
});

test('admin interface exposes install controls and PWA metadata', async () => {
  const html = await read('admin.html');
  assert.match(html, /rel="manifest" href="\/admin-manifest\.webmanifest\?v=__EDM_BUILD__"/);
  assert.match(html, /name="theme-color" content="#111827"/);
  assert.match(html, /admin-install\.js\?v=__EDM_BUILD__/);
  assert.match(html, /admin\.css\?v=__EDM_BUILD__/);
  assert.match(html, /data-install-admin/);
  assert.match(html, /data-install-status/);
  assert.match(html, /\/api\/admin\?icon=192/);
});

test('admin service worker caches only the shell and never business APIs', async () => {
  const source = await read('admin-sw.js');
  const shellAssets = source.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(source, /edm28-admin-shell-v\d+/);
  assert.match(source, /admin-offline\.html/);
  assert.match(source, /request\.mode === 'navigate'/);
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /url\.pathname === '\/api\/admin'/);
  assert.match(source, /url\.searchParams\.get\('icon'\)/);
  assert.doesNotMatch(shellAssets, /^\s*['"]\/admin['"],?\s*$/m);
});

test('admin install helper registers the scoped service worker', async () => {
  const source = await read('admin-install.js');
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /navigator\.serviceWorker\.register\('\/admin-sw\.js', \{ scope: '\/admin' \}\)/);
  assert.match(source, /display-mode: standalone/);
  assert.match(source, /Installer l’application/);
});

test('existing admin endpoint returns valid 192 and 512 PNG files', async () => {
  process.env.VERCEL_ENV = 'preview';
  const { default: handler } = await import(`../api/admin.js?pwa=${Date.now()}`);

  for (const size of [192, 512]) {
    const response = createResponse();
    handler({ method: 'GET', query: { icon: String(size) }, url: `/api/admin?icon=${size}` }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/png');
    assert.ok(Buffer.isBuffer(response.body));
    assert.deepEqual([...response.body.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(response.body.readUInt32BE(16), size);
    assert.equal(response.body.readUInt32BE(20), size);
  }
});