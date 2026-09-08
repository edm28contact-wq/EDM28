import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');

const PUBLIC_PATHS = [
  '/freinage',
  '/freinage/plaquettes-de-frein',
  '/freinage/disques-de-frein',
  '/freinage/liquide-de-frein',
  '/liaison-au-sol',
  '/liaison-au-sol/triangles',
  '/liaison-au-sol/direction',
  '/prestations',
  '/tarifs',
  '/fonctionnement',
  '/transparence',
  '/a-propos',
  '/contact'
];

const PRIVATE_PATHS = ['/admin', '/account', '/garage', '/history', '/messages', '/request-status', '/documents', '/devis', '/factures'];

test('Vercel expose les routes SEO publiques, sitemap et robots', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const routes = new Map(config.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
  assert.equal(routes.get('/sitemap.xml'), '/api/sitemap');
  assert.equal(routes.get('/robots.txt'), '/api/robots');
  for (const path of PUBLIC_PATHS) assert.match(routes.get(path) || '', /^\/api\/public-page\?slug=/, path);
  assert.equal(routes.get('/'), '/api/app');
});

test('chaque page SEO possède une URL, un title et une description uniques', async () => {
  const source = await read('api/public-page.js');
  const dataSection = source.split('function esc')[0];
  for (const path of PUBLIC_PATHS) assert.match(dataSection, new RegExp(`path: '${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  const titles = [...dataSection.matchAll(/\n\s+title: '([^']+)'/g)].map((match) => match[1]);
  const descriptions = [...dataSection.matchAll(/\n\s+description: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(titles.length, PUBLIC_PATHS.length);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(descriptions.length, PUBLIC_PATHS.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('les pages SEO rendent canonical, H1, Open Graph et structured data', async () => {
  const source = await read('api/public-page.js');
  assert.match(source, /<link rel="canonical" href=/);
  assert.match(source, /<meta property="og:title"/);
  assert.match(source, /<h1>\$\{esc\(page\.h1\)\}<\/h1>/);
  assert.match(source, /application\/ld\+json/);
  for (const type of ['Organization', 'AutoRepair', 'Service', 'BreadcrumbList']) assert.match(source, new RegExp(`'@type': '${type}'`));
  assert.match(source, /'@type': 'FAQPage'/);
  assert.match(source, /Question/);
  assert.match(source, /Réponse courte/);
});

test('la page tarifs charge site_services au lieu de recopier les prix', async () => {
  const source = await read('api/public-page.js');
  assert.match(source, /rest\/v1\/site_services/);
  assert.match(source, /published_at: 'not\.is\.null'/);
  assert.match(source, /active: 'eq\.true'/);
  assert.match(source, /displayed_price/);
  assert.doesNotMatch(source, />69 €</);
  assert.doesNotMatch(source, />99 €</);
});

test('le sitemap ne contient que les pages publiques prévues', async () => {
  const source = await read('api/sitemap.js');
  assert.match(source, /'\/freinage'/);
  assert.match(source, /'\/contact'/);
  for (const path of PRIVATE_PATHS) assert.doesNotMatch(source, new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
});

test('robots bloque les zones privées et référence le sitemap', async () => {
  const source = await read('api/robots.js');
  for (const path of PRIVATE_PATHS) assert.match(source, new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  assert.match(source, /Sitemap: \$\{getOrigin\(req\)\}\/sitemap\.xml/);
  assert.match(source, /'Allow: \/'/);
});

test('admin et app.html sont explicitement noindex', async () => {
  const [admin, appHtml] = await Promise.all([read('api/admin.js'), read('app.html')]);
  assert.match(admin, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
  assert.match(admin, /meta name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(appHtml, /meta name="robots" content="noindex,nofollow,noarchive"/);
});

test('la page d’accueil reçoit le positionnement SEO et le maillage interne', async () => {
  const source = await read('api/app.js');
  assert.match(source, /EDM28 \| Spécialiste freinage et liaison au sol/);
  assert.match(source, /link rel="canonical" href="\$\{origin\}\//);
  assert.match(source, /Garage automobile spécialisé freinage et liaison au sol\./);
  assert.match(source, /href="\/freinage"/);
  assert.match(source, /href="\/liaison-au-sol"/);
  assert.match(source, /href="\/tarifs"/);
  assert.match(source, /'@type': 'Organization'/);
  assert.match(source, /'@type': 'AutoRepair'/);
  assert.doesNotMatch(source, /streetAddress|postalCode|telephone/);
});
