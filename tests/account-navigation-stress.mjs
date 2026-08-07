import { chromium, firefox, webkit } from 'playwright';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.EDM_TEST_PORT || 4190);
const browserName = process.env.EDM_BROWSER || 'chromium';
const mobile = process.env.EDM_MOBILE === '1';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);

const targetOrigin = `http://127.0.0.1:${port}`;
const targetUrl = `${targetOrigin}/`;

const scripts = [
  '/client-account-safe.js?v=10',
  '/integration.js?v=5',
  '/final-system.js?v=2',
  '/request-history.js?v=1',
  '/service-details.js?v=1',
  '/ui-final.js?v=6',
  '/theme-light.js?v=4',
  '/home-premium.js?v=3',
  '/contact-footer.js?v=1',
  '/accessibility-mobile.js?v=1',
  '/reliability.js?v=1',
  '/white-background.js?v=2',
  '/light-palette-final.js?v=2',
  '/mid-palette-final.js?v=1',
  '/client-simple-flow.js?v=6',
  '/palette-edm-reference.js?v=1',
  '/client-navigation-visible.js?v=2'
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

const user = {
  id: 'connected-test-user',
  firstName: 'Jean',
  lastName: 'Dupont',
  phone: '0612345678',
  email: 'client@example.test'
};

const supabaseStub = `
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

const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=${JSON.stringify(scripts)};scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=resolve;document.body.appendChild(s);});});},Promise.resolve());});<\/script>`;

async function loadLocalResponse(requestUrl) {
  const pathname = new URL(requestUrl).pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  let content = await readFile(join(root, safe));

  if (safe === 'index.html') {
    let html = content.toString('utf8');
    html = html.replace(
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
      `<script>${supabaseStub}<\/script>`
    );
    html = html.replace(/\s*<script>\s*if \("serviceWorker" in navigator\) \{[\s\S]*?navigator\.serviceWorker\.register\("\/sw\.js"\);[\s\S]*?<\/script>\s*(?=<\/body>)/, '');
    content = Buffer.from(html.replace('</body>', `${loader}</body>`));
  }

  return {
    body: content,
    contentType: mime[extname(safe)] || 'application/octet-stream'
  };
}

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  hasTouch: mobile,
  isMobile: mobile,
  serviceWorkers: 'block'
});

const escapedOrigin = targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
await context.route(new RegExp(`^${escapedOrigin}/.*$`), async (route) => {
  try {
    const response = await loadLocalResponse(route.request().url());
    await route.fulfill({
      status: 200,
      body: response.body,
      contentType: response.contentType,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'Not found' });
  }
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

async function openInitialPage() {
  let lastError = null;
  let lastSnapshot = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('[data-page="account"]').first().waitFor({ state: 'attached', timeout: 10000 });
      await page.locator('#account').waitFor({ state: 'attached', timeout: 10000 });
      await page.locator('#accountPageContent').waitFor({ state: 'attached', timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      lastSnapshot = await readinessSnapshot();
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
    await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(true), 100)));
  }

  const cycle = ['home', 'account', 'appointment', 'garage', 'history', 'about', 'home'];
  for (let round = 0; round < 20; round += 1) {
    for (const pageId of cycle) {
      await page.click(`[data-page="${pageId}"]`);
      await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('active'), pageId);
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
  }

  const finalDomCount = await page.locator('*').count();
  if (finalDomCount > initialDomCount + 30) throw new Error(`DOM growth detected: ${initialDomCount} -> ${finalDomCount}`);
  if (errors.length) throw new Error(errors.join('\n'));
  if (badResponses.length) throw new Error(`HTTP errors:\n${badResponses.join('\n')}`);

  console.log(JSON.stringify({ success: true, browserName, mobile, initialDomCount, finalDomCount, accountClicks: 20, navigationCycles: 20 }, null, 2));
} finally {
  await browser.close();
}
