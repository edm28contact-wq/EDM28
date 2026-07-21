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
if (!html.includes('client-navigation-visible.js?v=3')) throw new Error('Wrong connected navigation asset');

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
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function');

  for (const pageId of ['account', 'garage', 'history']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${pageId}"]`);
    await page.waitForFunction(() => document.getElementById('appointment')?.classList.contains('active'));
  }

  await page.evaluate(() => {
    state.user = { id: 'u1', firstName: 'Jean', lastName: 'Dupont', phone: '0612345678', email: 'client@example.test' };
    saveState();
  });

  for (const pageId of ['home', 'appointment', 'account', 'garage', 'history', 'about']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${pageId}"]`);
    await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('active'), pageId);
    await page.waitForTimeout(150);
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('connected right-menu navigation ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}