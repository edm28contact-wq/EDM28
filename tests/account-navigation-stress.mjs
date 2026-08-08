import { chromium, firefox, webkit } from 'playwright';

const port = Number(process.env.EDM_TEST_PORT || 4190);
const browserName = process.env.EDM_BROWSER || 'chromium';
const mobile = process.env.EDM_MOBILE === '1';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);

const targetOrigin = `http://127.0.0.1:${port}`;
const targetUrl = `${targetOrigin}/`;
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
  const emptyBuilder = () => {
    const api = { select(){return api}, eq(){return api}, not(){return api}, order(){return Promise.resolve({data:[],error:null})}, limit(){return Promise.resolve({data:[],error:null})}, single(){return Promise.resolve({data:null,error:null})}, maybeSingle(){return Promise.resolve({data:null,error:null})}, then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)} };
    return api;
  };
  window.supabase = { createClient(){ return {
    auth: { async getSession(){ return {data:{session},error:null} }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}} }, async signOut(){ return {error:null} } },
    from(){ return emptyBuilder() },
    storage:{ from(){ return { async createSignedUrl(){ return {data:{signedUrl:'${targetOrigin}/logo-edm.svg'},error:null} } } } }
  } } };
})();`;

// GitHub runners can expose proxy environment variables. Chromium bypasses
// loopback reliably, while Firefox can inherit proxy state and render its own
// "Problem loading page" for 127.0.0.1. Launch browsers with an explicit
// direct loopback configuration so the stress test exercises the application,
// not runner proxy behavior.
const browserEnv = { ...process.env };
const proxyKeys = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy'
];
const proxyEnvPresent = proxyKeys.filter((key) => Boolean(process.env[key]));
for (const key of proxyKeys) delete browserEnv[key];

const existingNoProxy = browserEnv.NO_PROXY || browserEnv.no_proxy || '';
const noProxyEntries = new Set(
  existingNoProxy.split(',').map((entry) => entry.trim()).filter(Boolean)
);
noProxyEntries.add('127.0.0.1');
noProxyEntries.add('localhost');
browserEnv.NO_PROXY = [...noProxyEntries].join(',');
browserEnv.no_proxy = browserEnv.NO_PROXY;

const launchOptions = { env: browserEnv };
if (browserName === 'firefox') {
  launchOptions.firefoxUserPrefs = {
    'network.proxy.type': 0,
    'network.proxy.no_proxies_on': 'localhost, 127.0.0.1'
  };
}

console.log(JSON.stringify({
  phase: 'browser-launch',
  browserName,
  mobile,
  targetUrl,
  proxyEnvKeysCleared: proxyEnvPresent
}));

const browser = await browserType.launch(launchOptions);
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  hasTouch: mobile,
  isMobile: mobile,
  serviceWorkers: 'block'
});

// Let Firefox perform a normal HTTP navigation. Intercept only the external
// Supabase library so the stress test remains deterministic and offline-safe.
await context.route('https://cdn.jsdelivr.net/**', async (route) => {
  if (route.request().url().includes('@supabase/supabase-js')) {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: supabaseStub,
      headers: { 'Cache-Control': 'no-store' }
    });
    return;
  }
  await route.abort();
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
  const ignoredCdn = url.startsWith('https://cdn.jsdelivr.net/') && !url.includes('@supabase/supabase-js');
  const knownChromiumImageNoise = browserName === 'chromium'
    && url.startsWith('data:image/jpeg')
    && failure.includes('ERR_INVALID_URL');
  if (!ignoredCdn && !knownChromiumImageNoise) errors.push(`requestfailed: ${url} ${failure}`);
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
}
