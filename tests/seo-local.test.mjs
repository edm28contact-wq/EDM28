import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');
const LOCAL_PATH = '/garage-freinage-saint-lubin-de-la-haye';
const INDEXNOW_KEY = '2a42e34bf6be46998222361affe1b1d0';
const GOOGLE_MAPS_URL = 'https://maps.google.com/?cid=5973618623656745225';

test('le domaine public officiel est edm28.fr', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.equal(config.env.PUBLIC_SITE_ORIGIN, 'https://edm28.fr');
});

test('la route locale Saint-Lubin-de-la-Haye est publique et stable', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const routes = new Map(config.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
  assert.equal(routes.get(LOCAL_PATH), '/api/app?seo=page&slug=garage-freinage-saint-lubin-de-la-haye');
  assert.equal(routes.get(`${LOCAL_PATH}.html`), '/api/app?seo=page&slug=garage-freinage-saint-lubin-de-la-haye');
});

test('la page locale est rendue par le moteur SEO synchronisé', async () => {
  const source = await read('public-seo.js');
  assert.match(source, /path: '\/garage-freinage-saint-lubin-de-la-haye'/);
  assert.match(source, /EDM28 — garage spécialisé freinage à Saint-Lubin-de-la-Haye/);
  assert.match(source, /page\.path === '\/garage-freinage-saint-lubin-de-la-haye'/);
  assert.match(source, /business\.address/);
  assert.match(source, /business\.business_name/);
});

test('le sitemap principal contient la page locale', async () => {
  const source = await read('api/app.js');
  const sitemapList = source.split('const PUBLIC_PATHS = [')[1].split('];')[0];
  assert.match(sitemapList, /'\/garage-freinage-saint-lubin-de-la-haye'/);
});

test('la page d’accueil expose le profil public synchronisé et le maillage local', async () => {
  const source = await read('api/app.js');
  assert.match(source, /async function loadPublicBusiness/);
  assert.match(source, /public_business_profile/);
  assert.ok(source.includes("const PUBLIC_GOOGLE_MAPS_URL = 'https://maps.google.com/?cid=5973618623656745225'"));
  assert.ok(source.includes('sameAs: [PUBLIC_GOOGLE_MAPS_URL]'));
  assert.match(source, /business\.address_line1/);
  assert.match(source, /business\.city/);
});

test('la clé IndexNow est servable à la racine', async () => {
  const key = (await read(`${INDEXNOW_KEY}.txt`)).trim();
  assert.equal(key, INDEXNOW_KEY);
});


test('llms.txt is generated from the synchronized public business profile', async () => {
  const [app, configText] = await Promise.all([read('api/app.js'), read('vercel.json')]);
  const config = JSON.parse(configText);
  const routes = new Map(config.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
  assert.equal(routes.get('/llms.txt'), '/api/app?seo=llms');
  assert.match(app, /async function handleLlms/);
  assert.match(app, /await loadPublicBusiness\(\)/);
  assert.match(app, /Noms de marque: EDM28, EDM 28, EDM/);
  assert.match(app, /Contact public:/);
  assert.match(app, /Telephone public:/);
  assert.match(app, /Adresse:/);
  assert.match(app, /Cache-Control', 'no-store'/);
});
