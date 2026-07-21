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
if (!html.includes('client-navigation-visible.js?v=4')) throw new Error('Wrong connected router asset');

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

  await page.addInitScript(() => {
    localStorage.setItem('edm_auto_site_v4', JSON.stringify({
      user: { id: 'u1', firstName: 'Jean', lastName: 'Dupont', phone: '0612345678', email: 'client@example.test' },
      vehicles: [],
      requests: []
    }));
  });

  const supabaseStub = `window.supabase={createClient(){return{auth:{async getSession(){return{data:{session:{access_token:'t',user:{id:'u1',email:'client@example.test',user_metadata:{}}}},error:null}},onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},async signOut(){return{error:null}}},from(){const api={select(){return api},eq(){return api},not(){return api},order(){return Promise.resolve({data:[],error:null})},limit(){return Promise.resolve({data:[],error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})},then(r,j){return Promise.resolve({data:[],error:null}).then(r,j)}};return api},storage:{from(){return{async createSignedUrl(){return{data:{signedUrl:'about:blank'},error:null}}}}}}}};`;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub }));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__edmConnectedRouter === true);
  const globals = await page.evaluate(() => ({ lexicalUser: state?.user?.id, windowState: typeof window.state }));
  if (globals.lexicalUser !== 'u1' || globals.windowState !== 'undefined') throw new Error(`Unexpected state shape: ${JSON.stringify(globals)}`);

  await page.evaluate(() => {
    window.showPage = () => { throw new Error('legacy showPage must not control connected menu'); };
  });

  for (const id of ['account', 'garage', 'history', 'home', 'appointment', 'about']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${id}"]`);
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('connected lexical menu route ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
