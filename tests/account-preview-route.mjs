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
if (!html.includes('client-account-safe.js?v=12')) throw new Error('Wrong Preview account asset');

const server = createServer(async (req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function');

  await page.click('#openMenu');
  await page.click('[data-page="account"]');
  await page.waitForFunction(() => document.getElementById('appointment')?.classList.contains('active'));

  await page.evaluate(() => {
    state.user = { id: 'u1', firstName: 'Jean', lastName: 'Dupont', phone: '0612345678', email: 'client@example.test' };
    saveState();
  });
  await page.click('#openMenu');
  await page.click('[data-page="account"]');
  await page.waitForFunction(() => document.getElementById('account')?.classList.contains('active'));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('account preview route ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}