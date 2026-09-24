import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabasePublicConfig } from './supabase-config.js';
import publicSeoHandler from '../public-seo.js';
import symptomSeoHandler from '../public-seo-symptoms.js';

const INDEX_PATH = join(process.cwd(), 'index.html');
const ROUTER_PATH = join(process.cwd(), 'client-navigation-visible.js');
const PUBLIC_EMAIL = 'contact@edm28.fr';
const PUBLIC_STREET_ADDRESS = '17 bis route du Videlet';
const PUBLIC_LOCALITY = 'Saint-Lubin-de-la-Haye';
const PUBLIC_POSTAL_CODE = '28410';
const PUBLIC_GOOGLE_MAPS_URL = 'https://maps.google.com/?cid=5973618623656745225';

const PUBLIC_PATHS = [
  '/',
  '/demande',
  '/mes-interventions',
  '/garage-freinage-saint-lubin-de-la-haye',
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
  '/contact',
  '/symptomes',
  '/freinage/freins-qui-grincent',
  '/freinage/vibrations-au-freinage',
  '/freinage/pedale-de-frein-molle',
  '/liaison-au-sol/claquement-train-avant'
];

const PRIVATE_PATHS = [
  '/admin', '/admin.html', '/app.html', '/account', '/garage', '/history', '/messages',
  '/request-status', '/documents', '/devis', '/factures', '/api/'
];

function getSeoMode(req) {
  if (typeof req.query?.seo === 'string') return req.query.seo;
  try {
    return new URL(req.url || '', 'http://localhost').searchParams.get('seo') || '';
  } catch (_) {
    return '';
  }
}

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildBlankOrderPdf() {
  const text = (x, y, value, size = 10, bold = false) =>
    `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`;
  const line = (x1, y1, x2, y2, width = 0.8) => `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
  const rect = (x, y, w, h, width = 0.8) => `${width} w ${x} ${y} ${w} ${h} re S`;
  const checkbox = (x, y, label) => [rect(x, y - 7, 8, 8, 0.6), text(x + 13, y - 5, label, 7.5)].join('\n');

  const commands = [];
  commands.push(text(42, 800, 'EDM28', 24, true));
  commands.push(text(42, 780, 'ORDRE DE REPARATION - MODELE VIERGE', 16, true));
  commands.push(text(42, 763, 'Document de preparation - a completer avant intervention', 8));
  commands.push(line(42, 752, 553, 752, 1.2));
  commands.push(text(42, 728, 'CLIENT', 10, true), rect(42, 656, 245, 60));
  commands.push(text(50, 700, 'Nom / Prenom :', 8), text(50, 682, 'Telephone :', 8), text(50, 664, 'Email :', 8));
  commands.push(text(310, 728, 'VEHICULE', 10, true), rect(310, 656, 243, 60));
  commands.push(text(318, 700, 'Immatriculation :', 8), text(318, 682, 'Marque / Modele :', 8), text(318, 664, 'Kilometrage :', 8));
  commands.push(text(42, 632, 'TRAVAUX AUTORISES / DEMANDE CLIENT', 10, true), rect(42, 548, 511, 72));
  commands.push(line(50, 598, 545, 598), line(50, 578, 545, 578), line(50, 558, 545, 558));
  commands.push(text(42, 522, 'POINTS DE CONTROLE EDM28', 10, true));
  commands.push(text(42, 508, 'A partir de 100 EUR TTC factures chez EDM28 : controle complet de cette liste.', 7.5, true));

  const left = ['Plaquettes avant gauche','Plaquettes avant droite','Plaquettes arriere gauche','Plaquettes arriere droite','Disque avant gauche','Disque avant droit','Disque arriere gauche','Disque arriere droit','Liquide de frein','Flexibles de frein','Pneu avant gauche','Pneu avant droit'];
  const right = ['Pneu arriere gauche','Pneu arriere droit','Pressions pneumatiques','Amortisseurs','Rotules','Silentblocs','Roulements','Soufflets','Geometrie / comportement','Etat visible du vehicule','Photos avant / apres','Observations generales'];
  let y = 486;
  left.forEach((label) => { commands.push(checkbox(46, y, label)); y -= 17; });
  y = 486;
  right.forEach((label) => { commands.push(checkbox(305, y, label)); y -= 17; });

  commands.push(text(42, 272, 'OBSERVATIONS / MESURES', 10, true), rect(42, 190, 511, 68));
  commands.push(line(50, 235, 545, 235), line(50, 213, 545, 213));
  commands.push(text(42, 164, 'VALIDATION', 10, true), rect(42, 74, 245, 76), rect(310, 74, 243, 76));
  commands.push(text(50, 134, 'Date :', 8), text(50, 116, 'Nom client :', 8), text(50, 94, 'Signature client :', 8));
  commands.push(text(318, 134, 'Technicien :', 8), text(318, 116, 'Date / heure :', 8), text(318, 94, 'Signature / visa :', 8));
  commands.push(text(42, 50, 'EDM28 - Modele vierge. Le document final est genere depuis le dossier client.', 7));

  const stream = commands.join('\n');
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>';
  objects[4] = `<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, 'binary');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function handleBlankOrder(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const pdf = buildBlankOrderPdf();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="ordre-reparation-vierge-edm28.pdf"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(pdf);
}


function normalizeConfiguredOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(url.host)) return '';
    return `${url.protocol}//${url.host}`.replace(/\/$/, '');
  } catch (_) {
    return '';
  }
}

function getOrigin(req) {
  const explicit = normalizeConfiguredOrigin(process.env.PUBLIC_SITE_ORIGIN);
  if (explicit) return explicit;

  const production = normalizeConfiguredOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return production;

  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'http' ? 'http' : 'https';
  const host = String(req.headers?.host || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return `${protocol}://localhost`;
  return `${protocol}://${host}`;
}

function isPreviewDeployment() {
  return String(process.env.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
}

function canonicalSeoRequest(req) {
  const origin = new URL(getOrigin(req));
  return {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      ...(req.headers || {}),
      host: origin.host,
      'x-forwarded-proto': origin.protocol.replace(':', '')
    }
  };
}

function getSeoSlug(req) {
  if (typeof req.query?.slug === 'string') return req.query.slug.replace(/^\/+|\/+$/g, '');
  try {
    return new URL(req.url || '', 'http://localhost').searchParams.get('slug')?.replace(/^\/+|\/+$/g, '') || '';
  } catch (_) {
    return '';
  }
}

function buildSecondaryEntityStructuredData(origin) {
  const address = {
    '@type': 'PostalAddress',
    streetAddress: PUBLIC_STREET_ADDRESS,
    addressLocality: PUBLIC_LOCALITY,
    postalCode: PUBLIC_POSTAL_CODE,
    addressCountry: 'FR'
  };
  const openingHours = [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'https://schema.org/Sunday',
      opens: '09:00',
      closes: '13:00'
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'https://schema.org/Sunday',
      opens: '14:00',
      closes: '18:00'
    }
  ];
  const knowsAbout = ['freinage automobile', 'plaquettes de frein', 'disques de frein', 'liquide de frein', 'liaison au sol', 'train roulant', 'triangles de suspension', 'direction'];

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'EDM28',
        alternateName: ['EDM 28', 'edm28.fr'],
        url: `${origin}/`,
        sameAs: [PUBLIC_GOOGLE_MAPS_URL],
        logo: `${origin}/logo-edm.svg`,
        email: PUBLIC_EMAIL,
        address,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'service client',
          email: PUBLIC_EMAIL,
          availableLanguage: ['fr']
        },
        knowsAbout,
        description: 'EDM28 est un garage automobile situé au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410), spécialisé en freinage et liaison au sol. EDM28 ne vend pas les pièces automobiles et ne prend aucune marge ni commission sur leur prix.'
      },
      {
        '@type': 'AutoRepair',
        '@id': `${origin}/#autorepair`,
        name: 'EDM28',
        alternateName: ['EDM 28', 'edm28.fr'],
        url: `${origin}/`,
        sameAs: [PUBLIC_GOOGLE_MAPS_URL],
        image: `${origin}/logo-edm.svg`,
        email: PUBLIC_EMAIL,
        address,
        openingHoursSpecification: openingHours,
        areaServed: { '@type': 'Place', name: 'Saint-Lubin-de-la-Haye et alentours' },
        knowsAbout,
        parentOrganization: { '@id': `${origin}/#organization` },
        description: 'Garage automobile spécialisé en freinage et interventions ciblées de liaison au sol et de train roulant au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410).'
      }
    ]
  }).replaceAll('<', '\\u003c');
}

function enrichSeoHtml(html, req) {
  if (typeof html !== 'string' || !html.includes('</head>') || html.includes('noindex,nofollow')) return html;

  const origin = getOrigin(req);
  const entityJson = buildSecondaryEntityStructuredData(origin);
  let output = html.replace('</head>', `<script id="edm-entity-identity" type="application/ld+json">${entityJson}</script></head>`);
  const slug = getSeoSlug(req);

  if (slug === 'contact') {
    output = output.replace(
      'Aucune adresse postale ni aucun numéro de téléphone n’est publié ici tant que ces informations ne sont pas renseignées dans la configuration publique.',
      'Adresse du garage : 17 bis route du Videlet, 28410 Saint-Lubin-de-la-Haye. Aucun numéro de téléphone professionnel n’est publié pour le moment.'
    );
  }

  if (slug === 'a-propos') {
    output = output
      .replace('<h2>Pas de localisation inventée</h2>', '<h2>Identité locale vérifiée</h2>')
      .replace(
        'Les informations locales ne sont publiées que lorsqu’elles sont réellement renseignées dans la configuration EDM28.',
        'EDM28 est un garage automobile situé au 17 bis route du Videlet, 28410 Saint-Lubin-de-la-Haye. Cette adresse correspond à l’identité publique actuellement confirmée du garage.'
      );
  }

  if (slug === 'transparence') {
    const marker = '<div class="links" aria-label="Pages liées">';
    const partsSection = '<section><h2>Pièces automobiles sans marge ni commission</h2><p>EDM28 ne vend pas les pièces automobiles et ne prend aucune marge ni commission sur leur prix. La rémunération du garage porte sur les prestations réalisées.</p></section>';
    output = output.replace(marker, `${partsSection}${marker}`);
  }

  return output;
}

function handleSeoDocument(delegate, req, res) {
  const originalSend = res.send.bind(res);
  res.send = (body) => originalSend(enrichSeoHtml(body, req));
  return delegate(canonicalSeoRequest(req), res);
}

function handleSitemap(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const origin = getOrigin(req);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PATHS.map((path) => `  <url><loc>${xmlEscape(`${origin}${path}`)}</loc></url>`).join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}

function handleRobots(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const origin = getOrigin(req);
  const body = isPreviewDeployment()
    ? ['User-agent: *', 'Disallow: /', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n')
    : ['User-agent: *', 'Allow: /', 'Allow: /garage-freinage-saint-lubin-de-la-haye', ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`), `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}

export default function handler(req, res) {
  const seoMode = getSeoMode(req);
  if (seoMode === 'page') {
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return handleSeoDocument(publicSeoHandler, req, res);
  }
  if (seoMode === 'symptom') {
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return handleSeoDocument(symptomSeoHandler, req, res);
  }
  if (seoMode === 'robots') return handleRobots(req, res);
  if (seoMode === 'sitemap') return handleSitemap(req, res);
  if (seoMode === 'blank-order') return handleBlankOrder(req, res);
  if (seoMode) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(404).send('<!doctype html><html lang="fr"><head><meta name="robots" content="noindex,nofollow"><title>Page introuvable | EDM28</title></head><body><main><h1>Page introuvable</h1></main></body></html>');
  }

  // The legacy client application is intentionally no longer served.
  // All public/client navigation now uses the unified public interface.
  res.setHeader('Location', '/');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(302).end();

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    let html = readFileSync(INDEX_PATH, 'utf8');
    const criticalRouter = readFileSync(ROUTER_PATH, 'utf8').replace(/<\/script/gi, '<\\/script');
    const supabase = resolveSupabasePublicConfig();
    const origin = getOrigin(req);
    const robotsMeta = isPreviewDeployment() ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large';

    if (!supabase.url || !supabase.key) {
      throw new Error(`Configuration Supabase ${supabase.environment} absente.`);
    }

    html = html
      .replace(/const SUPABASE_URL = "[^"]+";/, `const SUPABASE_URL = ${JSON.stringify(supabase.url)};`)
      .replace(/const SUPABASE_ANON_KEY = "[^"]+";/, `const SUPABASE_ANON_KEY = ${JSON.stringify(supabase.key)};`)
      .replace('<title>EDM AUTO</title>', '<title>EDM28 | Garage freinage à Saint-Lubin-de-la-Haye (28410)</title>')
      .replace('content="EDM AUTO - Demande mécanique simple, estimation claire et reprise manuelle."', 'content="EDM28 est un garage situé au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410), spécialisé en freinage et liaison au sol, avec devis et suivi transparents."')
      .replace('<meta name="theme-color" content="#111827">', '<meta name="theme-color" content="#cec7c0">')
      .replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', '<link rel="icon" href="/logo-edm.svg" type="image/svg+xml">')
      .replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="/logo-edm.svg">')
      .replace('<meta name="apple-mobile-web-app-title" content="EDM AUTO">', '<meta name="apple-mobile-web-app-title" content="EDM28">')
      .replace('<div class="eyebrow">Demande simple · estimation claire · reprise manuelle</div>', '<div class="eyebrow">Saint-Lubin-de-la-Haye · freinage · liaison au sol</div>')
      .replace('<h1>Préparez votre demande mécanique en quelques minutes.</h1>', '<h1>Garage automobile spécialisé freinage à Saint-Lubin-de-la-Haye.</h1>');

    const localAddress = {
      '@type': 'PostalAddress',
      streetAddress: PUBLIC_STREET_ADDRESS,
      addressLocality: PUBLIC_LOCALITY,
      postalCode: PUBLIC_POSTAL_CODE,
      addressCountry: 'FR'
    };

    const openingHours = [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Sunday',
        opens: '09:00',
        closes: '13:00'
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Sunday',
        opens: '14:00',
        closes: '18:00'
      }
    ];

    const serviceCatalog = {
      '@type': 'OfferCatalog',
      name: 'Prestations EDM28',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Freinage automobile', url: `${origin}/freinage` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Plaquettes de frein', url: `${origin}/freinage/plaquettes-de-frein` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Disques de frein', url: `${origin}/freinage/disques-de-frein` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Liquide de frein', url: `${origin}/freinage/liquide-de-frein` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Liaison au sol', url: `${origin}/liaison-au-sol` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Triangles de suspension', url: `${origin}/liaison-au-sol/triangles` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Direction', url: `${origin}/liaison-au-sol/direction` } }
      ]
    };

    const structuredData = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          url: `${origin}/`,
          name: 'EDM28',
          alternateName: ['EDM 28', 'edm28.fr'],
          inLanguage: 'fr-FR',
          publisher: { '@id': `${origin}/#organization` }
        },
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'EDM28',
          alternateName: ['EDM 28', 'edm28.fr'],
          url: `${origin}/`,
          sameAs: [PUBLIC_GOOGLE_MAPS_URL],
          logo: `${origin}/logo-edm.svg`,
          email: PUBLIC_EMAIL,
          address: localAddress,
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'service client',
            email: PUBLIC_EMAIL,
            availableLanguage: ['fr']
          },
          knowsAbout: ['freinage automobile', 'plaquettes de frein', 'disques de frein', 'liquide de frein', 'liaison au sol', 'train roulant', 'triangles de suspension', 'direction'],
          description: 'Garage automobile situé au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410), spécialisé freinage et liaison au sol, avec parcours client transparent, devis avant intervention et historique des documents.'
        },
        {
          '@type': 'AutoRepair',
          '@id': `${origin}/#autorepair`,
          name: 'EDM28',
          alternateName: ['EDM 28', 'edm28.fr'],
          url: `${origin}/`,
          sameAs: [PUBLIC_GOOGLE_MAPS_URL],
          image: `${origin}/logo-edm.svg`,
          email: PUBLIC_EMAIL,
          address: localAddress,
          openingHoursSpecification: openingHours,
          areaServed: { '@type': 'Place', name: 'Saint-Lubin-de-la-Haye et alentours' },
          knowsAbout: ['freinage automobile', 'plaquettes de frein', 'disques de frein', 'liquide de frein', 'liaison au sol', 'train roulant', 'triangles de suspension', 'direction'],
          hasOfferCatalog: serviceCatalog,
          parentOrganization: { '@id': `${origin}/#organization` },
          description: 'Garage automobile spécialisé freinage et liaison au sol au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410).'
        }
      ]
    }).replaceAll('<', '\\u003c');

    const socialMeta = `<meta name="edm-environment" content="${supabase.environment}"><meta name="robots" content="${robotsMeta}"><link rel="canonical" href="${origin}/"><meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="EDM28"><meta property="og:title" content="EDM28 | Garage freinage à Saint-Lubin-de-la-Haye (28410)"><meta property="og:description" content="EDM28, 17 bis route du Videlet : garage spécialisé freinage et liaison au sol à Saint-Lubin-de-la-Haye (28410), avec devis avant intervention et suivi client transparent."><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/logo-edm.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="EDM28 | Garage freinage à Saint-Lubin-de-la-Haye (28410)"><meta name="twitter:description" content="Freinage, liaison au sol et parcours transparent à Saint-Lubin-de-la-Haye (28410)."><script type="application/ld+json">${structuredData}<\/script><style id="edm-boot-style">html{background:#cec7c0}body{visibility:hidden}</style><script>${criticalRouter}<\/script>`;
    html = html.replace('</head>', `${socialMeta}</head>`);

    html = html.replace(
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script src="/client-auth-persistence.js?v=2"></script>'
    );

    const publicHub = `<section aria-labelledby="edm-public-services" style="max-width:1100px;margin:24px auto;padding:24px;border:1px solid #ded8d1;border-radius:24px;background:#fff"><h2 id="edm-public-services">Freinage et liaison au sol à Saint-Lubin-de-la-Haye</h2><p>EDM28 est situé au 17 bis route du Videlet à Saint-Lubin-de-la-Haye (28410). Consultez les pages publiques pour comprendre les contrôles, les prestations, les tarifs, les symptômes et le fonctionnement avant de préparer votre demande.</p><nav aria-label="Services et informations EDM28" style="display:flex;flex-wrap:wrap;gap:12px"><a href="/garage-freinage-saint-lubin-de-la-haye">Garage à Saint-Lubin-de-la-Haye</a><a href="/freinage">Freinage</a><a href="/freinage/plaquettes-de-frein">Plaquettes</a><a href="/freinage/disques-de-frein">Disques</a><a href="/freinage/liquide-de-frein">Liquide de frein</a><a href="/liaison-au-sol">Liaison au sol</a><a href="/symptomes">Symptômes</a><a href="/prestations">Prestations</a><a href="/tarifs">Tarifs</a><a href="/fonctionnement">Fonctionnement</a><a href="/transparence">Transparence</a></nav></section>`;
    const accountPrelude = '<script src="/client-account-safe.js?v=13"><\/script><script src="/client-password-flow.js?v=2"><\/script>';
    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=['/integration.js?v=5','/final-system.js?v=2','/request-history.js?v=2','/client-request-status-history.js?v=1','/service-details.js?v=1','/ui-final.js?v=6','/theme-light.js?v=4','/home-premium.js?v=3','/contact-footer.js?v=1','/accessibility-mobile.js?v=1','/reliability.js?v=1','/white-background.js?v=2','/light-palette-final.js?v=2','/mid-palette-final.js?v=1','/client-simple-flow.js?v=9','/palette-edm-reference.js?v=1','/combo-suspended.js?v=1','/client-booking-vehicle-history.js?v=2','/client-booking-history-router.js?v=1','/client-backoffice-sync.js?v=1','/client-internal-booking.js?v=2','/client-final-experience.js?v=2','/client-final-patch.js?v=5'];var reveal=function(){var style=document.getElementById('edm-boot-style');if(style)style.remove();document.body.style.visibility='visible';};requestAnimationFrame(reveal);var timeout=setTimeout(reveal,4000);scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){console.error('EDM optional module unavailable',src);resolve();};document.body.appendChild(s);});});},Promise.resolve()).finally(function(){clearTimeout(timeout);reveal();});});<\/script>`;
    html = html.replace('</body>', `${publicHub}${accountPrelude}${loader}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-EDM-Environment', supabase.environment);
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('app loader error', error);
    return res.status(500).send('<h1>EDM28</h1><p>Application temporairement indisponible.</p>');
  }
}
