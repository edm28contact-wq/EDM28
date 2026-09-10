const PUBLIC_SITE_ORIGIN = 'https://edm28.fr';
const LOCAL_PUBLIC_PATH = '/garage-freinage-saint-lubin-de-la-haye';
const PRIVATE_PATHS = [
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

function isPreviewDeployment() {
  return String(process.env.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const body = isPreviewDeployment()
    ? ['User-agent: *', 'Disallow: /', `Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`, ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        `Allow: ${LOCAL_PUBLIC_PATH}`,
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        `Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
        ''
      ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}
