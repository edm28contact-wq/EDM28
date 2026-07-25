import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vinHandler from '../api/vin.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('public theme uses a valid logo asset and collapses the shell on mobile', async () => {
  const theme = await read('ui-final.js');
  assert.match(theme, /const EDM_LOGO = "\/logo-edm\.svg"/);
  assert.doesNotMatch(theme, /data:image\/jpeg/);
  assert.match(
    theme,
    /@media \(max-width:980px\)\s*\{\s*\.app-shell \{ grid-template-columns:1fr; \}/s
  );
});

test('dynamic public and admin handlers set the required security headers', async () => {
  const [app, admin] = await Promise.all([read('api/app.js'), read('api/admin.js')]);
  for (const source of [app, admin]) {
    assert.match(source, /X-Content-Type-Options', 'nosniff'/);
    assert.match(source, /X-Frame-Options', 'DENY'/);
    assert.match(source, /Referrer-Policy', 'strict-origin-when-cross-origin'/);
    assert.match(source, /Permissions-Policy', 'camera=\(\), microphone=\(\), geolocation=\(\)'/);
    assert.ok(source.indexOf('setSecurityHeaders(res);') < source.indexOf("req.method !== 'GET'"));
  }
});

test('VIN endpoint uses the existing shared utilities through ESM', async () => {
  const source = await read('api/vin.js');
  assert.match(source, /import utils from "\.\/utils\.cjs"/);
  assert.match(source, /export default async function handler/);
  assert.doesNotMatch(source, /_utils\.cjs|module\.exports|require\(/);
});

test('service worker updates never reload an in-progress client form automatically', async () => {
  const source = await read('reliability.js');
  assert.match(source, /addEventListener\('controllerchange', showUpdateBanner\)/);
  assert.match(source, /Terminez votre saisie avant d’actualiser/);
  assert.match(source, /querySelector\('button'\)\.addEventListener\('click', \(\) => window\.location\.reload\(\)\)/);
  assert.doesNotMatch(source, /controllerchange[\s\S]{0,240}window\.location\.reload/);
});

test('local persistence isolates independent interface refresh failures', async () => {
  const source = await read('index.html');
  assert.match(
    source,
    /\[updateAccountUi, renderGarage, renderHistory, renderAccountPage, renderSavedVehicles\]\.forEach/
  );
  assert.match(source, /console\.warn\("EDM interface refresh unavailable", error\)/);
});

test('public promise names the workshop specialty and requires agreement before extra work', async () => {
  const [theme, app] = await Promise.all([read('ui-final.js'), read('api/app.js')]);
  assert.match(theme, /Freinage · liaison au sol · sur rendez-vous/);
  assert.match(theme, /Aucune intervention supplémentaire n’est ajoutée sans votre validation/);
  assert.match(theme, /La demande en ligne ne remplace pas une prise en charge urgente/);
  assert.match(app, /EDM · Freinage & liaison au sol/);
});

test('VIN endpoint loads at runtime and rejects an invalid VIN before any upstream call', async () => {
  let responseBody = '';
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { responseBody = body; }
  };

  await vinHandler({ method: 'GET', query: { vin: 'ABC' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(responseBody).success, false);
  assert.match(JSON.parse(responseBody).error, /VIN trop court/);
});
