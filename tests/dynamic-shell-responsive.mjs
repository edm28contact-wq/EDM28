import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import appHandler from '../api/app.js';
import adminHandler from '../api/admin.js';

const root = process.cwd();
const port = Number(process.env.EDM_TEST_PORT || 4194);
const widths = [320, 390, 768, 1024, 1440];

function capture(handler, url) {
  const response = { body: '', headers: {}, statusCode: 200 };
  const res = {
    setHeader(name, value) {
      response.headers[String(name).toLowerCase()] = String(value);
    },
    status(code) {
      response.statusCode = code;
      return this;
    },
    send(body) {
      response.body = body;
      return this;
    },
    end(body) {
      if (body) response.body = body;
      return this;
    }
  };
  handler({ method: 'GET', url }, res);
  return response;
}

const publicPage = capture(appHandler, '/');
const adminPage = capture(adminHandler, '/admin');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === '/') {
    res.writeHead(publicPage.statusCode, publicPage.headers);
    res.end(publicPage.body);
    return;
  }
  if (pathname === '/admin' || pathname === '/admin.html') {
    res.writeHead(adminPage.statusCode, adminPage.headers);
    res.end(adminPage.body);
    return;
  }

  try {
    const relative = normalize(pathname.slice(1)).replace(/^\.\.(\/|\\|$)/, '');
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'Content-Type': mime[extname(relative)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch();
const report = [];
let failed = false;

const supabaseStub = `
(() => {
  const builder = () => {
    const api = {
      select(){ return api; }, eq(){ return api; }, not(){ return api; }, in(){ return api; },
      is(){ return api; }, or(){ return api; }, limit(){ return api; },
      order(){ return Promise.resolve({ data:[], error:null, count:0 }); },
      single(){ return Promise.resolve({ data:null, error:null }); },
      maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
      then(resolve,reject){ return Promise.resolve({ data:[], error:null, count:0 }).then(resolve,reject); }
    };
    return api;
  };
  window.supabase = { createClient(){ return {
    auth: {
      async getSession(){ return { data:{ session:null }, error:null }; },
      onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
      async signOut(){ return { error:null }; }
    },
    from(){ return builder(); },
    storage:{ from(){ return { async createSignedUrl(){ return { data:{ signedUrl:'about:blank' }, error:null }; } }; } }
  }; } };
})();`;

try {
  for (const width of widths) {
    for (const target of [
      { name: 'public', path: '/', ready: () => Boolean(document.getElementById('edm-premium-theme')) },
      { name: 'admin', path: '/admin', ready: () => Boolean(document.getElementById('loginPanel')) }
    ]) {
      const page = await browser.newPage({
        viewport: { width, height: width <= 390 ? 844 : 1000 },
        hasTouch: width <= 390,
        isMobile: width <= 390
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('PWA registration failed')) {
          errors.push(`console: ${message.text()}`);
        }
      });
      page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: supabaseStub
      }));

      const response = await page.goto(`http://127.0.0.1:${port}${target.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await page.waitForFunction(target.ready);
      await page.waitForTimeout(800);

      const state = await page.evaluate(({ mobile, name }) => {
        const shell = document.querySelector('.app-shell');
        const brand = document.querySelector('.brand-mark');
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          columns: shell ? getComputedStyle(shell).gridTemplateColumns : '',
          logo: brand ? getComputedStyle(brand).backgroundImage : '',
          logoImage: brand?.querySelector('img')?.getAttribute('src') || '',
          loginVisible: name !== 'admin' || !document.getElementById('loginPanel')?.classList.contains('hidden'),
          mobile
        };
      }, { mobile: width <= 980, name: target.name });

      const headers = response?.headers() || {};
      const secureHeaders = [
        headers['x-content-type-options'] === 'nosniff',
        headers['x-frame-options'] === 'DENY',
        headers['referrer-policy'] === 'strict-origin-when-cross-origin',
        headers['permissions-policy'] === 'camera=(), microphone=(), geolocation=()'
      ].every(Boolean);
      const oneColumn = !state.mobile || state.columns.trim().split(/\s+/).length === 1;
      const validLogo = target.name !== 'public'
        || (
          (state.logo.includes('logo-edm.svg') || state.logoImage === '/logo-edm.svg')
          && !state.logo.includes('data:image')
        );
      const ok = response?.status() === 200
        && !state.overflow
        && state.loginVisible
        && oneColumn
        && validLogo
        && secureHeaders
        && errors.length === 0;

      report.push({ target: target.name, width, status: response?.status(), secureHeaders, ...state, errors, ok });
      if (!ok) failed = true;
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify(report, null, 2));
if (failed) process.exit(1);
