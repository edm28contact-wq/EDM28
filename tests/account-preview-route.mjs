import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import appHandler from '../api/app.js';

const port = 4192;
let html = '';
const response = {
  setHeader() {},
  status() { return this; },
  send(body) { html = body; return this; },
  end() { return this; }
};
appHandler({ method: 'GET' }, response);
if (!html.includes('client-account-safe.js?v=13')) throw new Error('Wrong protected routes asset');
if (!html.includes('__edmMenuRouterV7')) throw new Error('Critical menu router is not inlined');

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
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(message.text());
  });

  const supabaseStub = `
  (() => {
    const listeners = [];
    let session = null;
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
      listeners.forEach((listener) => listener(user ? 'SIGNED_IN' : 'SIGNED_OUT', session));
    };
    window.supabase = { createClient(){ return {
      auth: {
        async getSession(){ return { data:{ session }, error:null }; },
        onAuthStateChange(listener){ listeners.push(listener); return { data:{ subscription:{ unsubscribe(){} } } }; },
        async signOut(){ window.__edmTestSetSession(null); return { error:null }; }
      },
      from(table){ return builder(table); },
      rpc(){ return Promise.resolve({ data:null, error:null }); },
      storage:{ from(){ return { async createSignedUrl(){ return { data:{ signedUrl:'about:blank' }, error:null }; } }; } }
    }; } };
  })();`;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub }));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__edmMenuRouterV7 === true && typeof window.__edmNavigate === 'function');

  for (const pageId of ['account', 'garage', 'history']) {
    await page.evaluate((id) => window.__edmNavigate(id), pageId);
    await page.waitForFunction(() => document.getElementById('appointment')?.classList.contains('active'));
  }

  await page.evaluate(() => {
    window.__edmTestSetSession({
      id: 'u1',
      email: 'client@example.test',
      user_metadata: { first_name:'Jean', last_name:'Dupont', phone:'0612345678' }
    });
  });
  await page.waitForFunction(() => state?.user?.id === 'u1');

  for (const pageId of ['home', 'appointment', 'account', 'garage', 'history', 'about']) {
    await page.evaluate((id) => window.__edmNavigate(id), pageId);
    await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('active'), pageId);
    const current = await page.getAttribute(`[data-page="${pageId}"]`, 'aria-current');
    if (current !== 'page') throw new Error(`Missing aria-current on ${pageId}`);
  }

  await page.evaluate(() => window.__edmNavigate('appointment'));
  await page.waitForFunction(() => document.getElementById('appointment')?.classList.contains('active'));

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('signed-out and signed-in protected routes ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
