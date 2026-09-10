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
  assert.equal(routes.get('/sitemap.xml'), '/api/app?seo=sitemap');
  assert.equal(routes.get('/robots.txt'), '/api/app?seo=robots');
  for (const path of PUBLIC_PATHS) assert.match(routes.get(path) || '', /^\/api\/app\?seo=page&slug=/, path);
  assert.equal(routes.get('/'), '/api/app');
});

test('chaque page SEO possède une URL, un title et une description uniques', async () => {
  const source = await read('public-seo.js');
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
  const source = await read('public-seo.js');
  assert.match(source, /<link rel="canonical" href=/);
  assert.match(source, /<meta property="og:title"/);
  assert.match(source, /<h1>\$\{esc\(page\.h1\)\}<\/h1>/);
  assert.match(source, /application\/ld\+json/);
  for (const type of ['Organization', 'AutoRepair', 'Service', 'BreadcrumbList']) assert.match(source, new RegExp(`'@type': '${type}'`));
  assert.match(source, /'@type': 'FAQPage'/);
  assert.match(source, /Question/);
  assert.match(source, /Réponse courte/);
});

test('les pages SEO secondaires reçoivent la même identité locale EDM28', async () => {
  const source = await read('api/app.js');
  assert.match(source, /function buildSecondaryEntityStructuredData/);
  assert.match(source, /function handleSeoDocument/);
  assert.match(source, /id="edm-entity-identity"/);
  assert.match(source, /alternateName: \['EDM 28', 'edm28\.fr'\]/);
  assert.match(source, /sameAs: \[PUBLIC_GOOGLE_MAPS_URL\]/);
  assert.match(source, /streetAddress: PUBLIC_STREET_ADDRESS/);
  assert.match(source, /addressLocality: PUBLIC_LOCALITY/);
  assert.match(source, /postalCode: PUBLIC_POSTAL_CODE/);
  assert.match(source, /openingHoursSpecification: openingHours/);
  assert.match(source, /areaServed: \{ '@type': 'Place', name: 'Saint-Lubin-de-la-Haye et alentours' \}/);
  assert.match(source, /EDM28 ne vend pas les pièces automobiles et ne prend aucune marge ni commission sur leur prix/);
  assert.match(source, /Adresse du garage : 17 bis route du Videlet, 28410 Saint-Lubin-de-la-Haye/);
  assert.match(source, /Identité locale vérifiée/);
  assert.match(source, /Pièces automobiles sans marge ni commission/);
});

test('la page tarifs charge site_services au lieu de recopier les prix', async () => {
  const source = await read('public-seo.js');
  assert.match(source, /rest\/v1\/site_services/);
  assert.match(source, /published_at: 'not\.is\.null'/);
  assert.match(source, /active: 'eq\.true'/);
  assert.match(source, /displayed_price/);
  assert.doesNotMatch(source, />69 €</);
  assert.doesNotMatch(source, />99 €</);
});

test('la liste SEO publique reste séparée des routes privées', async () => {
  const source = await read('api/app.js');
  const sitemapList = source.split('const PUBLIC_PATHS = [')[1].split('];')[0];
  assert.match(sitemapList, /'\/freinage'/);
  assert.match(sitemapList, /'\/contact'/);
  for (const path of PRIVATE_PATHS) assert.doesNotMatch(sitemapList, new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
});

test('robots bloque les zones privées et autorise explicitement la page garage locale publique', async () => {
  const source = await read('api/app.js');
  for (const path of PRIVATE_PATHS) assert.match(source, new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  assert.match(source, /'Allow: \/garage-freinage-saint-lubin-de-la-haye'/);
  assert.match(source, /`Sitemap: \$\{origin\}\/sitemap\.xml`/);
  assert.match(source, /'Allow: \/'/);
});

test('canonical et sitemap utilisent une origine de production stable', async () => {
  const source = await read('api/app.js');
  assert.match(source, /process\.env\.PUBLIC_SITE_ORIGIN/);
  assert.match(source, /process\.env\.VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(source, /const origin = getOrigin\(req\)/);
  assert.match(source, /canonicalSeoRequest\(req\)/);
});

test('les previews Vercel sont explicitement non indexables', async () => {
  const source = await read('api/app.js');
  assert.match(source, /process\.env\.VERCEL_ENV/);
  assert.match(source, /noindex, nofollow, noarchive/);
  assert.match(source, /\['User-agent: \*', 'Disallow: \/'/);
  assert.match(source, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
});

test('admin et app.html sont explicitement noindex', async () => {
  const [admin, appHtml] = await Promise.all([read('api/admin.js'), read('app.html')]);
  assert.match(admin, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
  assert.match(admin, /meta name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(appHtml, /meta name="robots" content="noindex,nofollow,noarchive"/);
});

test('la page d’accueil reçoit le positionnement local SEO et le maillage interne', async () => {
  const source = await read('api/app.js');
  assert.match(source, /EDM28 \| Garage freinage à Saint-Lubin-de-la-Haye \(28410\)/);
  assert.match(source, /link rel="canonical" href="\$\{origin\}\//);
  assert.match(source, /Garage automobile situé au 17 bis route du Videlet à Saint-Lubin-de-la-Haye \(28410\)/);
  assert.match(source, /href="\/garage-freinage-saint-lubin-de-la-haye"/);
  assert.match(source, /href="\/freinage"/);
  assert.match(source, /href="\/liaison-au-sol"/);
  assert.match(source, /href="\/symptomes"/);
  assert.match(source, /href="\/tarifs"/);
  assert.match(source, /'@type': 'Organization'/);
  assert.match(source, /'@type': 'AutoRepair'/);
  assert.match(source, /const PUBLIC_STREET_ADDRESS = '17 bis route du Videlet'/);
  assert.match(source, /streetAddress: PUBLIC_STREET_ADDRESS/);
  assert.match(source, /addressLocality: PUBLIC_LOCALITY/);
  assert.match(source, /postalCode: PUBLIC_POSTAL_CODE/);
  assert.match(source, /openingHoursSpecification: openingHours/);
  assert.match(source, /dayOfWeek: 'https:\/\/schema\.org\/Sunday'/);
  assert.match(source, /opens: '09:00'/);
  assert.match(source, /closes: '13:00'/);
  assert.match(source, /opens: '14:00'/);
  assert.match(source, /closes: '18:00'/);
  assert.doesNotMatch(source, /telephone/);
});
