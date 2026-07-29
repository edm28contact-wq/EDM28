import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import appHandler from '../api/app.js';

const port = 4193;
let html = '';
appHandler({ method: 'GET' }, {
  setHeader() {},
  status() { return this; },
  send(body) { html = body; return this; },
  end() { return this; }
});
if (!html.includes('__edmMenuRouterV7')) throw new Error('Critical connected router is not inlined');

const server = createServer(async (req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }
  try {
    const body = await readFile(join(process.cwd(), path.slice(1)));
    res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    res.end(body);
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
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('PWA registration failed') && !message.text().includes('ERR_INVALID_URL')) errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    if (!request.url().startsWith('data:')) failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`);
  });

  const supabaseStub = `
  (() => {
    const listeners = [];
    const user = { id:'u1', email:'client@example.test', user_metadata:{ first_name:'Jean', last_name:'Dupont', phone:'0612345678' } };
    const session = { access_token:'test-token', user };
    const profile = { id:'u1', first_name:'Jean', last_name:'Dupont', phone:'0612345678', email:user.email };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    window.supabase = { createClient(){ return {
      auth: {
        async getSession(){ await wait(350); return { data:{ session }, error:null }; },
        onAuthStateChange(listener){ listeners.push(listener); setTimeout(() => listener('INITIAL_SESSION', session), 400); return { data:{ subscription:{ unsubscribe(){} } } }; },
        async signOut(){ return { error:null }; }
      },
      from(table){ return builder(table); },
      rpc(){ return Promise.resolve({ data:null, error:null }); },
      storage:{ from(){ return { async createSignedUrl(){ return { data:{ signedUrl:'about:blank' }, error:null }; } }; } }
    }; } };
  })();`;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub }));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__edmMenuRouterV7 === true && typeof window.__edmNavigate === 'function');

  await page.evaluate(() => window.__edmNavigate('account'));
  await page.waitForFunction(() => document.getElementById('account')?.classList.contains('active'), null, { timeout: 5000 });
  await page.waitForFunction(() => state?.user?.id === 'u1', null, { timeout: 5000 });

  await page.evaluate(() => {
    window.showPage = () => { throw new Error('legacy showPage must not control menu navigation'); };
  });

  const sequence = ['account', 'garage', 'history', 'home', 'appointment', 'about'];
  for (let round = 0; round < 10; round += 1) {
    for (const id of sequence) {
      await page.evaluate((pageId) => window.__edmNavigate(pageId), id);
      await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), id);
      const heartbeat = await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(true), 50)));
      if (!heartbeat) throw new Error(`Event loop stalled on ${id}`);
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));
  if (failedRequests.length) throw new Error(failedRequests.join('\n'));
  console.log('delayed real-session menu routing ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
