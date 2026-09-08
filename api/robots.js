const DISALLOWED = [
  '/admin',
  '/admin.html',
  '/app.html',
  '/account',
  '/garage',
  '/history',
  '/messages',
  '/request-status',
  '/documents',
  '/devis',
  '/factures',
  '/api/'
];

function getOrigin(req) {
  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'http' ? 'http' : 'https';
  const host = String(req.headers?.host || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return `${protocol}://localhost`;
  return `${protocol}://${host}`;
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const body = ['User-agent: *', 'Allow: /', ...DISALLOWED.map((path) => `Disallow: ${path}`), `Sitemap: ${getOrigin(req)}/sitemap.xml`, ''].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}
