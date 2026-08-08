import { chromium, firefox, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const browserName = process.env.EDM_BROWSER || 'chromium';
const mobile = process.env.EDM_MOBILE === '1';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);

const user = {
  id: 'connected-test-user',
  firstName: 'Jean',
  lastName: 'Dupont',
  phone: '0612345678',
  email: 'client@example.test'
};

const rootDir = process.cwd();
const indexPath = path.join(rootDir, 'index.html');
const supabaseCdn = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const originalHtml = await fs.readFile(indexPath, 'utf8');
if (!originalHtml.includes(supabaseCdn)) {
  throw new Error(`Supabase CDN script not found in ${indexPath}`);
}
const patchedHtml = originalHtml.replaceAll(supabaseCdn, '/__edm_supabase_stub.js');

let targetOrigin = '';

function makeSupabaseStub() {
  return `
(() => {
  const user = ${JSON.stringify({ id: user.id, email: user.email, user_metadata: { first_name: user.firstName, last_name: user.lastName, phone: user.phone } })};
  const session = { access_token: 'test-token', user };
  const localAssetUrl = '${targetOrigin}/logo-edm.svg';
  const emptyBuilder = () => {
    const api = { select(){return api}, eq(){return api}, not(){return api}, order(){return Promise.resolve({data:[],error:null})}, limit(){return Promise.resolve({data:[],error:null})}, single(){return Promise.resolve({data:null,error:null})}, maybeSingle(){return Promise.resolve({data:null,error:null})}, then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)} };
    return api;
  };
  window.supabase = { createClient(){ return {
    auth: { async getSession(){ return {data:{session},error:null} }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}} }, async signOut(){ return {error:null} } },
    from(){ return emptyBuilder() },
    storage:{ from(){ return { async createSignedUrl(){ return {data:{signedUrl:localAssetUrl},error:null} } } } }
  } } };
})();`;
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8']
]);

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === '/' || pathname === '/index.html') {
      send(res, 200, 'text/html; charset=utf-8', patchedHtml);
      return;
    }

    if (pathname === '/__edm_supabase_stub.js') {
      send(res, 200, 'text/javascript; charset=utf-8', makeSupabaseStub());
      return;
    }

    // The account-navigation stress test is not a PWA lifecycle test. Serve a
    // harmless local worker so the application's registration succeeds without
    // skipWaiting/clients.claim taking control during the navigation test.
    if (pathname === '/sw.js') {
      send(res, 200, 'text/javascript; charset=utf-8', "self.addEventListener('install', () => {}); self.addEventListener('activate', () => {});\n");
      return;
    }

    const relativePath = pathname.replace(/^\/+/, '');
    const filePath = path.resolve(rootDir, relativePath);
    const rootPrefix = `${path.resolve(rootDir)}${path.sep}`;
    if (!filePath.startsWith(rootPrefix)) {
      send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
      return;
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }
    if (!stat.isFile()) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }

    const body = await fs.readFile(filePath);
    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    send(res, 200, contentType, body);
  } catch (error) {
    send(res, 500, 'text/plain; charset=utf-8', `Server error: ${error?.message || error}`);
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('Unable to resolve local stress server address');
targetOrigin = `http://127.0.0.1:${address.port}`;
const targetUrl = `${targetOrigin}/`;

console.log(JSON.stringify({
  phase: 'browser-launch',
  browserName,
  mobile,
  targetUrl,
  server: 'node-http-in-process',
  networkInterception: false
}));

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  hasTouch: mobile,
  isMobile: mobile
});

const page = await context.newPage();
const errors = [];
const badResponses = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const source = String(message.location().url || '');
  const knownChromiumImageNoise = browserName === 'chromium'
    && message.type() === 'error'
    && message.text().includes('ERR_INVALID_URL')
    && source.startsWith('data:image/jpeg');
  if (message.type() === 'error'
    && !message.text().includes('PWA registration failed')
    && !knownChromiumImageNoise) {
    errors.push(`console: ${message.text()}`);
  }
});
page.on('requestfailed', (request) => {
  const url = request.url();
  const failure = request.failure()?.errorText || '';
  const knownChromiumImageNoise = browserName === 'chromium'
    && url.startsWith('data:image/jpeg')
    && failure.includes('ERR_INVALID_URL');
  if (!knownChromiumImageNoise) errors.push(`requestfailed: ${url} ${failure}`);
});
page.on('response', (response) => {
  if (response.status() >= 400 && !response.url().includes('manifest')) badResponses.push(`${response.status()} ${response.url()}`);
  if (response.request().resourceType() === 'document') {
    console.log(JSON.stringify({ phase: 'document-response', browserName, status: response.status(), url: response.url() }));
  }
});
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    console.log(JSON.stringify({ phase: 'main-frame-navigated', browserName, url: frame.url() }));
  }
});

await page.addInitScript(({ storageKey, state }) => {
  localStorage.setItem(storageKey, JSON.stringify(state));
}, { storageKey: 'edm_auto_site_v4', state: { user, vehicles: [], requests: [] } });

async function readinessSnapshot() {
  return page.evaluate(() => ({
    url: location.href,
    readyState: document.readyState,
    title: document.title,
    bodyLength: document.body?.innerHTML.length || 0,
    bodyText: document.body?.innerText.slice(0, 500) || '',
    accountNav: Boolean(document.querySelector('[data-page="account"]')),
    accountSection: Boolean(document.getElementById('account')),
    accountContent: Boolean(document.getElementById('accountPageContent'))
  })).catch((error) => ({ evaluationError: String(error?.message || error), url: page.url() }));
}

async function waitForAccountShell() {
  await page.locator('[data-page="account"]').first().waitFor({ state: 'attached', timeout: 10000 });
  await page.locator('#account').waitFor({ state: 'attached', timeout: 10000 });
  await page.locator('#accountPageContent').waitFor({ state: 'attached', timeout: 10000 });
}

async function openInitialPage() {
  let lastError = null;
  let lastSnapshot = null;
  let sameUrlInterruptionAccepted = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForAccountShell();
      return;
    } catch (error) {
      const message = String(error?.message || error);
      const sameUrlNavigation = browserName === 'firefox'
        && !sameUrlInterruptionAccepted
        && message.includes(`Navigation to "${targetUrl}" is interrupted by another navigation to "${targetUrl}"`);

      if (sameUrlNavigation) {
        sameUrlInterruptionAccepted = true;
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
          await waitForAccountShell();
          return;
        } catch (followUpError) {
          lastError = followUpError;
          lastSnapshot = await readinessSnapshot();
        }
      } else {
        lastError = error;
        lastSnapshot = await readinessSnapshot();
      }

      if (attempt === 3) break;
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  throw new Error(`Initial ${browserName} page did not become ready after 3 attempts: ${lastError?.message || lastError}; snapshot=${JSON.stringify(lastSnapshot)}; errors=${errors.slice(-5).join(' | ')}`);
}

try {
  await openInitialPage();
  await page.waitForFunction(() => document.getElementById('accountPageContent')?.textContent.includes('client@example.test'), undefined, { timeout: 15000 });
  await page.waitForTimeout(300);

  const initialDomCount = await page.locator('*').count();
  for (let i = 0; i < 20; i += 1) {
    if (mobile) {
      await page.click('#openMenu');
      await page.waitForTimeout(20);
    }
    await page.click('[data-page="account"]');
    await page.waitForFunction(() => document.getElementById('account')?.classList.contains('active'));
    await page.waitForFunction(() => document.getElementById('accountPageContent')?.textContent.includes('client@example.test'));
    await page.waitForTimeout(100);
  }

  const cycle = ['home', 'account', 'appointment', 'garage', 'history', 'about', 'home'];
  for (let round = 0; round < 20; round += 1) {
    for (const pageId of cycle) {
      if (mobile) {
        const sidebarOpen = await page.locator('#sidebar').evaluate((node) => node.classList.contains('open'));
        if (!sidebarOpen) await page.click('#openMenu');
      }
      await page.click(`[data-page="${pageId}"]`);
      await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('active'), pageId);
      await page.waitForTimeout(20);
    }
  }

  const finalDomCount = await page.locator('*').count();
  if (finalDomCount > initialDomCount + 30) throw new Error(`DOM growth detected: ${initialDomCount} -> ${finalDomCount}`);
  if (errors.length) throw new Error(errors.join('\n'));
  if (badResponses.length) throw new Error(`HTTP errors:\n${badResponses.join('\n')}`);

  console.log(JSON.stringify({ success: true, browserName, mobile, initialDomCount, finalDomCount, accountClicks: 20, navigationCycles: 20 }, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}
