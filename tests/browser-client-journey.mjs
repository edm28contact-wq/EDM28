import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = 4180;
const loaderScripts = [
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
  '/client-simple-flow.js?v=3',
  '/palette-edm-reference.js?v=1',
  '/client-navigation-visible.js?v=1',
  '/client-account-safe.js?v=2'
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=${JSON.stringify(loaderScripts)};scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});});},Promise.resolve()).catch(function(error){console.error('EDM module load error',error);});});<\/script>`;

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    if (pathname === '/api/submit-request-v2') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        res.writeHead(payload.requestId ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload.requestId ? { success: true, requestId: payload.requestId } : { success: false, error: 'requestId absent' }));
      });
      return;
    }

    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const safe = normalize(relative).replace(/^\.\.(\/|\\|$)/, '');
    let content = await readFile(join(root, safe));
    if (safe === 'index.html') {
      content = Buffer.from(content.toString('utf8').replace('</body>', `${loader}</body>`));
    }
    res.writeHead(200, { 'Content-Type': mime[extname(safe)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(`console: ${message.text()}`);
});

const supabaseStub = `
(() => {
  const listeners = [];
  let session = null;
  const user = {
    id: 'user-e2e-1',
    email: 'client.parcours@example.test',
    user_metadata: { first_name: 'Jean', last_name: 'Dupont', phone: '0612345678' }
  };
  const vehicles = [];
  const requests = [];
  const profile = { id: user.id, first_name: 'Jean', last_name: 'Dupont', phone: '0612345678', email: user.email };

  const builder = (table) => {
    let operation = 'select';
    let payload = null;
    const api = {
      select() { return api; },
      eq() { return api; },
      order() { return Promise.resolve(result()); },
      single() { const value = result(); return Promise.resolve({ data: Array.isArray(value.data) ? value.data[0] || null : value.data, error: value.error }); },
      maybeSingle() { const value = result(); return Promise.resolve({ data: Array.isArray(value.data) ? value.data[0] || null : value.data, error: value.error }); },
      upsert(value) { operation = 'upsert'; payload = value; return api; },
      insert(value) { operation = 'insert'; payload = value; return api; },
      update(value) { operation = 'update'; payload = value; return api; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
    };
    function result() {
      if (table === 'profiles') return { data: [profile], error: null };
      if (table === 'vehicles') {
        if (operation === 'upsert') {
          const row = { id: 'vehicle-e2e-1', ...payload, updated_at: new Date().toISOString() };
          vehicles.splice(0, vehicles.length, row);
          return { data: [row], error: null };
        }
        return { data: vehicles, error: null };
      }
      if (table === 'service_requests') {
        if (operation === 'insert') {
          const source = Array.isArray(payload) ? payload[0] : payload;
          const row = { id: 'request-e2e-1', ...source };
          requests.splice(0, requests.length, row);
          return { data: [row], error: null };
        }
        if (operation === 'update') {
          if (requests[0]) Object.assign(requests[0], payload);
          return { data: requests, error: null };
        }
        return { data: requests, error: null };
      }
      if (table === 'repairs') return { data: [], error: null };
      return { data: [], error: null };
    }
    return api;
  };

  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { return { data: { session }, error: null }; },
          async signInWithOtp() { return { data: {}, error: null }; },
          async verifyOtp({ token }) {
            if (token !== '12345678') return { data: {}, error: new Error('invalid token') };
            session = { access_token: 'test-access-token', user };
            listeners.forEach(fn => fn('SIGNED_IN', session));
            return { data: { session, user }, error: null };
          },
          async signOut() {
            session = null;
            listeners.forEach(fn => fn('SIGNED_OUT', null));
            return { error: null };
          },
          onAuthStateChange(fn) { listeners.push(fn); return { data: { subscription: { unsubscribe() {} } } }; }
        },
        from: builder,
        storage: { from() { return { async createSignedUrl() { return { data: { signedUrl: 'about:blank' }, error: null }; } }; } }
      };
    }
  };
})();`;

await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub }));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#btnOtpSend', { timeout: 15000 });

await page.click('[data-jump="appointment"]');
await page.fill('#lastName', 'Dupont');
await page.fill('#firstName', 'Jean');
await page.fill('#phone', '0612345678');
await page.fill('#email', 'client.parcours@example.test');
await page.click('#btnOtpSend');
await page.waitForSelector('#otpPanel:not(.hidden)');
await page.fill('#otpCode', '12345678');
await page.click('#btnOtpVerify');
await page.waitForFunction(() => document.querySelector('#authStatus')?.textContent.includes('vérifiée'));

await page.fill('#plate', 'AA123BC');
await page.fill('#mileage', '145000');
await page.fill('#brand', 'PEUGEOT');
await page.fill('#model', '308');
await page.fill('#year', '2020');
await page.fill('#energy', 'Essence');
await page.click('#btnAccessServices');
await page.waitForSelector('#servicesArea:not(.hidden)');

await page.click('[data-select-pack="freinage"]');
await page.click('[data-basket="standard"]');
await page.fill('#clientNotes', 'Bruit et vibration au freinage.');
const total = await page.locator('#laborAfter').textContent();
if (!total || total.includes('0,00')) throw new Error(`Estimation invalide: ${total}`);

await page.click('#btnSubmit');
await page.waitForFunction(() => document.querySelector('#submitStatus')?.textContent.includes('Demande transmise'));

await page.click('[data-page="account"]');
await page.waitForFunction(() => document.querySelector('#accountPageContent')?.textContent.includes('client.parcours@example.test'));
await page.click('[data-page="garage"]');
await page.waitForFunction(() => document.querySelector('#garageList')?.textContent.includes('AA-123-BC'));
await page.click('[data-page="history"]');
await page.waitForSelector('#historyList');

if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ success: true, total, checks: ['otp', 'account', 'vehicle', 'services', 'estimate', 'submit', 'garage', 'history'] }, null, 2));

await browser.close();
await new Promise(resolve => server.close(resolve));
