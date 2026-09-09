import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');
const LOCAL_PATH = '/garage-freinage-saint-lubin-de-la-haye';
const INDEXNOW_KEY = '2a42e34bf6be46998222361affe1b1d0';

test('le domaine public officiel est edm28.fr', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.equal(config.env.PUBLIC_SITE_ORIGIN, 'https://edm28.fr');
});

test('la route locale Saint-Lubin-de-la-Haye est publique et stable', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const routes = new Map(config.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
  assert.equal(routes.get(LOCAL_PATH), '/garage-freinage-saint-lubin-de-la-haye.html');
});

test('la page locale possède canonical, H1 et données locales vérifiées', async () => {
  const html = await read('garage-freinage-saint-lubin-de-la-haye.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/edm28\.fr\/garage-freinage-saint-lubin-de-la-haye">/);
  assert.match(html, /<h1>Garage spécialisé freinage à Saint-Lubin-de-la-Haye \(28410\)<\/h1>/);
  assert.match(html, /"streetAddress":"17 bis route du Videlet"/);
  assert.match(html, /"addressLocality":"Saint-Lubin-de-la-Haye"/);
  assert.match(html, /"postalCode":"28410"/);
  assert.match(html, /"openingHoursSpecification"/);
  assert.match(html, /"dayOfWeek":"https:\/\/schema\.org\/Sunday"/);
  assert.match(html, /"opens":"09:00","closes":"13:00"/);
  assert.match(html, /"opens":"14:00","closes":"18:00"/);
  assert.match(html, /"@type":"AutoRepair"/);
  assert.doesNotMatch(html, /"telephone"/);
});

test('le sitemap principal contient la page locale', async () => {
  const source = await read('api/app.js');
  const sitemapList = source.split('const PUBLIC_PATHS = [')[1].split('];')[0];
  assert.match(sitemapList, /'\/garage-freinage-saint-lubin-de-la-haye'/);
});

test('la page d’accueil expose la localisation vérifiée et le maillage local', async () => {
  const source = await read('api/app.js');
  assert.match(source, /const PUBLIC_STREET_ADDRESS = '17 bis route du Videlet'/);
  assert.match(source, /const PUBLIC_LOCALITY = 'Saint-Lubin-de-la-Haye'/);
  assert.match(source, /const PUBLIC_POSTAL_CODE = '28410'/);
  assert.match(source, /streetAddress: PUBLIC_STREET_ADDRESS/);
  assert.match(source, /addressLocality: PUBLIC_LOCALITY/);
  assert.match(source, /postalCode: PUBLIC_POSTAL_CODE/);
  assert.match(source, /href="\/garage-freinage-saint-lubin-de-la-haye"/);
});

test('la clé IndexNow est servable à la racine', async () => {
  const key = (await read(`${INDEXNOW_KEY}.txt`)).trim();
  assert.equal(key, INDEXNOW_KEY);
});
