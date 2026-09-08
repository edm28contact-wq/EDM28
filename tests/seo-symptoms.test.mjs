import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');

const SYMPTOM_PATHS = [
  '/symptomes',
  '/freinage/freins-qui-grincent',
  '/freinage/vibrations-au-freinage',
  '/freinage/pedale-de-frein-molle',
  '/liaison-au-sol/claquement-train-avant'
];

test('Vercel expose toutes les pages de symptômes et le sitemap étendu', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const routes = new Map(config.routes.filter((route) => route.src).map((route) => [route.src, route.dest]));
  assert.equal(routes.get('/sitemap.xml'), '/api/symptoms?mode=sitemap');
  for (const path of SYMPTOM_PATHS) {
    assert.match(routes.get(path) || '', /^\/api\/symptoms\?slug=/, path);
  }
});

test('chaque intention symptôme possède title, description, H1 et contenu propre', async () => {
  const source = await read('api/symptoms.js');
  for (const path of SYMPTOM_PATHS) {
    assert.match(source, new RegExp(`path: '${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  const titles = [...source.matchAll(/\n\s+title: '([^']+)'/g)].map((match) => match[1]);
  const descriptions = [...source.matchAll(/\n\s+description: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(titles.length, SYMPTOM_PATHS.length);
  assert.equal(descriptions.length, SYMPTOM_PATHS.length);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
  assert.match(source, /<h1>\$\{esc\(page\.h1\)\}<\/h1>/);
});

test('les pages symptômes sont reliées aux prestations sans diagnostic automatique', async () => {
  const source = await read('api/symptoms.js');
  assert.match(source, /\/freinage\/plaquettes-de-frein/);
  assert.match(source, /\/freinage\/disques-de-frein/);
  assert.match(source, /\/freinage\/liquide-de-frein/);
  assert.match(source, /\/liaison-au-sol\/triangles/);
  assert.match(source, /\/liaison-au-sol\/direction/);
  assert.match(source, /Un symptôme permet d’orienter un contrôle, pas de choisir une pièce à remplacer/);
  assert.match(source, /ne permet pas de désigner une pièce/);
});

test('les pages symptômes rendent canonical, Open Graph, breadcrumbs et données structurées', async () => {
  const source = await read('api/symptoms.js');
  assert.match(source, /<link rel="canonical" href=/);
  assert.match(source, /<meta property="og:title"/);
  assert.match(source, /'@type': 'WebPage'/);
  assert.match(source, /'@type': 'AutoRepair'/);
  assert.match(source, /'@type': 'BreadcrumbList'/);
  assert.match(source, /'@type': 'FAQPage'/);
});

test('le sitemap regroupe le socle public et les nouvelles intentions', async () => {
  const source = await read('api/symptoms.js');
  assert.match(source, /const ALL_PUBLIC_PATHS = \[\.\.\.CORE_PATHS/);
  assert.match(source, /'\/freinage'/);
  assert.match(source, /'\/contact'/);
  for (const path of SYMPTOM_PATHS) {
    assert.match(source, new RegExp(`path: '${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.doesNotMatch(source, /'\/admin'/);
  assert.doesNotMatch(source, /'\/account'/);
});

test('canonical et previews restent durcis sur la nouvelle fonction', async () => {
  const source = await read('api/symptoms.js');
  assert.match(source, /process\.env\.PUBLIC_SITE_ORIGIN/);
  assert.match(source, /process\.env\.VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(source, /process\.env\.VERCEL_ENV/);
  assert.match(source, /noindex,nofollow,noarchive/);
  assert.match(source, /X-Robots-Tag/);
});

test('aucune donnée locale non vérifiée n’est inventée', async () => {
  const source = await read('api/symptoms.js');
  assert.doesNotMatch(source, /streetAddress|postalCode|telephone|GeoCoordinates|addressLocality/);
});
