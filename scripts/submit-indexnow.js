const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ORIGIN = 'https://edm28.fr';
const HOST = 'edm28.fr';
const KEY = '2a42e34bf6be46998222361affe1b1d0';
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;

function getPublicUrls() {
  const source = readFileSync(join(process.cwd(), 'api', 'app.js'), 'utf8');
  const list = source.match(/const PUBLIC_PATHS = \[([\s\S]*?)\];/);
  if (!list) throw new Error('PUBLIC_PATHS introuvable dans api/app.js');

  const paths = [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const urls = [...new Set(paths.map((path) => new URL(path, ORIGIN).href))];
  if (!urls.length) throw new Error('Aucune URL publique trouvee');
  return urls;
}

async function verifyKey() {
  const response = await fetch(KEY_LOCATION, {
    headers: { 'user-agent': 'EDM28-IndexNow/1.0' },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`Cle IndexNow inaccessible: HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (value !== KEY) throw new Error('Le fichier de cle IndexNow ne correspond pas a la cle attendue');
}

async function submit(urls) {
  const response = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'user-agent': 'EDM28-IndexNow/1.0'
    },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls
    })
  });

  if (![200, 202].includes(response.status)) {
    const body = await response.text().catch(() => '');
    throw new Error(`IndexNow refuse la soumission: HTTP ${response.status}${body ? ` - ${body.slice(0, 300)}` : ''}`);
  }

  console.log(`IndexNow accepte ${urls.length} URL EDM28 (HTTP ${response.status}).`);
}

async function main() {
  const urls = getPublicUrls();
  await verifyKey();
  await submit(urls);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
