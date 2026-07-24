import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import adminIconHandler from '../api/admin-icon.js';

const port = Number(process.env.EDM_ADMIN_PWA_PORT || 4194);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);

  if (url.pathname === '/api/admin-icon') {
    const headers = {};
    const response = {
      code: 200,
      status(code) { this.code = code; return this; },
      setHeader(name, value) { headers[name] = value; return this; },
      end(body) {
        res.writeHead(this.code, headers);
        res.end(body);
        return this;
      }
    };
    adminIconHandler({ method: req.method, query: Object.fromEntries(url.searchParams) }, response);
    return;
  }

  const relative = url.pathname === '/admin' || url.pathname === '/admin.html'
    ? 'admin.html'
    : url.pathname.slice(1);

  try {
    const body = await readFile(join(process.cwd(), relative));
    res.writeHead(200, { 'Content-Type': mime[extname(relative)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const supabaseStub = `
(() => {
  const auth = {
    async getSession(){ return { data:{ session:null }, error:null }; },
    async signInWithOtp(){ return { data:{}, error:null }; },
    async verifyOtp(){ return { data:{}, error:null }; },
    async signOut(){ return { error:null }; },
    onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; }
  };
  const builder = () => {
    const api = {
      select(){ return api; }, eq(){ return api; }, is(){ return api; }, in(){ return api; }, not(){ return api; }, or(){ return api; }, limit(){ return api; },
      order(){ return Promise.resolve({ data:[], error:null }); },
      single(){ return Promise.resolve({ data:null, error:null }); },
      maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
      then(resolve,reject){ return Promise.resolve({ data:[], error:null }).then(resolve,reject); }
    };
    return api;
  };
  window.supabase = { createClient(){ return { auth, from(){ return builder(); }, storage:{ from(){ return {}; } } }; } };
})();`;

const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({
  status: 200,
  contentType: 'text/javascript',
  body: supabaseStub
}));

try {
  const response = await page.goto(`http://127.0.0.1:${port}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (response?.status() !== 200) throw new Error(`Admin returned HTTP ${response?.status()}`);

  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return registration?.active?.state === 'activated';
  }, null, { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    const manifestResponse = await fetch(manifestLink);
    const manifest = await manifestResponse.json();
    const registration = await navigator.serviceWorker.ready;
    const icon192 = await fetch('/api/admin-icon?size=192');
    const icon512 = await fetch('/api/admin-icon?size=512');
    return {
      title: document.title,
      manifestLink,
      manifest,
      scope: new URL(registration.scope).pathname,
      installButtons: document.querySelectorAll('[data-install-admin]').length,
      visibleInstallButtons: Array.from(document.querySelectorAll('[data-install-admin]')).filter((button) => !button.classList.contains('hidden')).length,
      icon192: { status: icon192.status, type: icon192.headers.get('content-type') },
      icon512: { status: icon512.status, type: icon512.headers.get('content-type') }
    };
  });

  if (result.title !== 'Gestion EDM28') throw new Error(`Unexpected title: ${result.title}`);
  if (result.manifestLink !== '/admin-manifest.webmanifest') throw new Error('Admin manifest link is missing');
  if (result.manifest.display !== 'standalone') throw new Error('Admin manifest is not standalone');
  if (!result.manifest.icons.some((icon) => icon.sizes === '192x192')) throw new Error('Missing 192 icon');
  if (!result.manifest.icons.some((icon) => icon.sizes === '512x512')) throw new Error('Missing 512 icon');
  if (result.scope !== '/admin') throw new Error(`Unexpected service worker scope: ${result.scope}`);
  if (result.installButtons < 2 || result.visibleInstallButtons < 1) throw new Error('Install controls are unavailable');
  if (result.icon192.status !== 200 || result.icon192.type !== 'image/png') throw new Error('192 icon is unavailable');
  if (result.icon512.status !== 200 || result.icon512.type !== 'image/png') throw new Error('512 icon is unavailable');
  if (errors.length) throw new Error(errors.join('\n'));

  console.log('admin PWA installability ok');
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
