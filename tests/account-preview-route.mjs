import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import appHandler from '../api/app.js';

const port = 4192;

async function render(pathname, slug) {
  let body = '';
  let statusCode = 200;
  const headers = {};
  const response = {
    setHeader(key, value) { headers[String(key).toLowerCase()] = String(value); },
    status(code) { statusCode = code; return this; },
    send(value) { body = String(value ?? ''); return this; },
    end(value) { if (value != null) body = String(value); return this; }
  };
  await appHandler({
    method: 'GET',
    url: pathname,
    query: { seo: 'page', slug },
    headers: { host: `127.0.0.1:${port}`, 'x-forwarded-proto': 'http' }
  }, response);
  if (statusCode !== 200) throw new Error(`${pathname} returned ${statusCode}`);
  return body;
}

const demandHtml = await render('/demande', 'demande');
const interventionsHtml = await render('/mes-interventions', 'mes-interventions');

if (!demandHtml.includes('id="edmRequestApp"')) throw new Error('Current request route is missing');
if (!interventionsHtml.includes('id="edmInterventionsApp"')) throw new Error('Current interventions route is missing');
for (const html of [demandHtml, interventionsHtml]) {
  if (!html.includes('/public-client.js?v=6')) throw new Error('Current public client asset is missing');
  if (!html.includes('/client-journey.js?v=1')) throw new Error('Current journey asset is missing');
  if (html.includes('__edmMenuRouterV7')) throw new Error('Legacy protected-route router must not be served');
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === '/demande') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(demandHtml);
    return;
  }
  if (pathname === '/mes-interventions') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(interventionsHtml);
    return;
  }
  try {
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    const data = await readFile(join(process.cwd(), file));
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(message.text());
  });

  const supabaseStub = `
  (() => {
    const listeners = [];
    const stored = localStorage.getItem('__edm_preview_user');
    let session = stored ? { access_token:'test-token', user:JSON.parse(stored) } : null;
    const profile = { id:'u1', first_name:'Jean', last_name:'Dupont', phone:'0612345678', email:'client@example.test' };
    const builder = (table) => {
      const api = {
        select(){ return api; }, eq(){ return api; }, not(){ return api; }, in(){ return api; }, gte(){ return api; }, lt(){ return api; },
        order(){ return Promise.resolve({ data:[], error:null }); },
        limit(){ return Promise.resolve({ data:[], error:null }); },
        single(){ return Promise.resolve({ data:table === 'profiles' ? profile : null, error:null }); },
        maybeSingle(){ return Promise.resolve({ data:table === 'profiles' ? profile : null, error:null }); },
        then(resolve,reject){ return Promise.resolve({ data:[], error:null }).then(resolve,reject); }
      };
      return api;
    };
    window.__edmTestSetSession = (user) => {
      session = user ? { access_token:'test-token', user } : null;
      if (user) localStorage.setItem('__edm_preview_user', JSON.stringify(user));
      else localStorage.removeItem('__edm_preview_user');
      listeners.forEach((listener) => listener(user ? 'SIGNED_IN' : 'SIGNED_OUT', session));
    };
    window.supabase = { createClient(){ return {
      auth: {
        async getSession(){ return { data:{ session }, error:null }; },
        onAuthStateChange(listener){ listeners.push(listener); return { data:{ subscription:{ unsubscribe(){} } } }; },
        async signOut(){ window.__edmTestSetSession(null); return { error:null }; },
        async signInWithPassword(){ return { data:{ session }, error:null }; }
      },
      from(table){ return builder(table); },
      rpc(){ return Promise.resolve({ data:[], error:null }); },
      storage:{ from(){ return { async createSignedUrl(){ return { data:{ signedUrl:'about:blank' }, error:null }; } }; } }
    }; } };
  })();`;

  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub })
  );

  await page.goto(`http://127.0.0.1:${port}/mes-interventions?devis=22222222-2222-4222-8222-222222222222`, { waitUntil:'networkidle', timeout:30000 });
  await page.waitForURL('**/demande?**');
  await page.locator('#requestAuthEmail').waitFor({ state:'visible' });
  if (await page.locator('[data-client-only]:visible').count()) throw new Error('Client-only navigation visible while signed out');

  await page.evaluate(() => window.__edmTestSetSession({
    id:'u1',
    email:'client@example.test',
    user_metadata:{ first_name:'Jean', last_name:'Dupont', phone:'0612345678' }
  }));
  await page.waitForFunction(() => document.getElementById('requestAccountStep')?.hidden === true && document.querySelector('#requestAccountArea .signed-box')?.textContent.includes('Connecté'));

  await page.goto(`http://127.0.0.1:${port}/mes-interventions`, { waitUntil:'networkidle', timeout:30000 });
  await page.waitForFunction(() => document.getElementById('edmInterventionsApp')?.textContent.includes('Votre espace client'));
  await page.waitForFunction(() => document.getElementById('edmInterventionsApp')?.textContent.includes('Aucune intervention en cours'));

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('current signed-out redirect and signed-in interventions route ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
