import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.RECOVERY_ORIGIN;
const expectedBuild = String(process.env.RECOVERY_SHA || '').slice(0, 7);
const allowed = new Set([
  'https://edm28.fr',
  'https://edm-28-git-fix-password-recovery-admin-3d99bb-edm-28-s-projects.vercel.app'
]);
assert.ok(allowed.has(origin), 'Unexpected target origin');
assert.match(expectedBuild, /^[a-f0-9]{7}$/, 'Missing candidate SHA');
const report = { origin, expectedBuild, checks: [], realAuthWrites: 0 };
const output = 'recovery-browser-artifacts';
await mkdir(output, { recursive: true });
let browser;

async function waitForBuild() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${origin}/admin?recovery-check=${expectedBuild}`, {
      redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' }
    });
    assert.ok(![401, 403].includes(res.status), 'Deployment access is restricted; no bypass attempted');
    const build = res.headers.get('x-edm-build');
    await res.body?.cancel();
    if (res.status === 200 && build === expectedBuild) return;
    if (attempt % 5 === 0) console.log(`Waiting for build ${expectedBuild}: HTTP ${res.status}, build ${build || 'unknown'}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Expected deployment is not serving the requested commit');
}

async function withPage(width, email, fn) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const user = { id: '00000000-0000-4000-8000-000000000001', email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
  const calls = [];
  const errors = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname.endsWith('.supabase.co')) {
      calls.push({ path: url.pathname, method: req.method(), redirectTo: url.searchParams.get('redirect_to') });
      const body = url.pathname === '/auth/v1/user' ? user : url.pathname.startsWith('/rest/v1/') ? [] : {};
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' }, body: JSON.stringify(body) });
    }
    // No application-side writes, real recovery emails, or real password changes.
    if (!['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  try { await fn(page, calls, user); assert.deepEqual(errors, [], 'Browser JavaScript errors'); }
  finally { await context.close(); }
}

async function openRecovery(page, path) {
  const res = await page.goto(origin + path, { waitUntil: 'networkidle' });
  assert.equal(res.status(), 200, `HTTP status for ${path.split('#')[0]}`);
  assert.equal(res.headers()['x-edm-recovery'], 'admin-client-v1');
  assert.match(res.headers()['cache-control'] || '', /no-store/);
  assert.match(res.headers()['referrer-policy'] || '', /no-referrer/);
  await page.waitForFunction(() => !document.getElementById('recoveryStatus').textContent.includes('Chargement'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false, 'Horizontal overflow');
}

try {
  await waitForBuild();
  browser = await chromium.launch();
  for (const width of [320, 390, 1280]) {
    for (const path of ['/mot-de-passe-oublie', '/admin-reset', '/reinitialiser-mot-de-passe']) {
      await withPage(width, 'customer@example.test', async (page, calls) => {
        await openRecovery(page, path);
        if (path === '/mot-de-passe-oublie') assert.equal(await page.locator('#sendRecovery').isEnabled(), true);
        else {
          assert.equal(await page.locator('#savePassword').isDisabled(), true);
          assert.match(await page.locator('#recoveryStatus').textContent(), /Lien absent, invalide/);
        }
        assert.equal(calls.length, 0, 'Tokenless page must not contact Auth');
        await page.screenshot({ path: `${output}/${path.slice(1)}-${width}.png`, fullPage: true });
      });
      report.checks.push(`page ${path} at ${width}px: PASS`);
    }
  }

  for (const [email, space, destination, login] of [
    ['customer@example.test', '', '/reinitialiser-mot-de-passe', '/mes-interventions'],
    ['admin@edm28.fr', '?espace=admin', '/admin-reset', '/admin']
  ]) {
    await withPage(390, email, async (page, calls, user) => {
      await openRecovery(page, '/mot-de-passe-oublie' + space);
      if (!space) await page.locator('#recoveryEmail').fill(email);
      await page.locator('#sendRecovery').click();
      await page.waitForFunction(() => document.getElementById('recoveryStatus').textContent.includes('Si un compte correspond'));
      const request = calls.find((item) => item.path === '/auth/v1/recover' && item.method === 'POST');
      assert.equal(request?.method, 'POST');
      assert.equal(request.redirectTo, origin + destination);

      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
      await openRecovery(page, destination + '#type=recovery&access_token=' + token + '&refresh_token=test-refresh-token');
      assert.equal(await page.locator('#savePassword').isEnabled(), true);
      assert.equal(new URL(page.url()).hash, '', 'Tokens must be removed from address bar');
      await page.locator('#newPassword').fill('Fictional-test-password-2026!');
      await page.locator('#confirmPassword').fill('Not-matching-test-password!');
      await page.locator('#savePassword').click();
      assert.equal(calls.filter((item) => item.method === 'PUT').length, 0);
      await page.locator('#confirmPassword').fill('Fictional-test-password-2026!');
      await page.locator('#savePassword').click();
      await page.locator('#loginAfterReset').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#loginAfterReset').getAttribute('href'), login);
      assert.equal(calls.filter((item) => item.path === '/auth/v1/user' && item.method === 'PUT').length, 1);
      assert.equal(await page.locator('#newPassword').inputValue(), '');
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => key.endsWith('-auth-token'))), false);
    });
    report.checks.push(`request, confirmation, mocked update, return for ${space ? 'admin' : 'client'}: PASS`);
  }

  await withPage(390, 'customer@example.test', async (page) => {
    await page.goto(origin + '/#error=access_denied&error_code=otp_expired', { waitUntil: 'networkidle' });
    await page.waitForURL('**/reinitialiser-mot-de-passe');
    assert.equal(await page.locator('#savePassword').isDisabled(), true);
    assert.match(await page.locator('#recoveryStatus').textContent(), /lien email/);
  });
  report.checks.push('expired email landing on homepage reaches dedicated error page: PASS');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
