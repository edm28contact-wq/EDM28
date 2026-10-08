import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabasePublicConfig } from './supabase-config.js';
import { injectRecoveryBridge, serveRecoveryPage } from '../password-recovery.js';
import publicSeoHandler from '../public-seo.js';
import symptomSeoHandler from '../public-seo-symptoms.js';

const INDEX_PATH = join(process.cwd(), 'index.html');
const ROUTER_PATH = join(process.cwd(), 'client-navigation-visible.js');
const DEFAULT_PUBLIC_BUSINESS = Object.freeze({
  business_name: 'EDM28',
  email: 'contact@edm28.fr',
  phone: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  city: '',
  country: 'France',
  website: 'https://edm28.fr/'
});
// Compatibility defaults are only used by the unreachable legacy loader below.
const PUBLIC_EMAIL = DEFAULT_PUBLIC_BUSINESS.email;
const PUBLIC_STREET_ADDRESS = DEFAULT_PUBLIC_BUSINESS.address_line1;
const PUBLIC_LOCALITY = DEFAULT_PUBLIC_BUSINESS.city;
const PUBLIC_POSTAL_CODE = DEFAULT_PUBLIC_BUSINESS.postal_code;
const PUBLIC_GOOGLE_MAPS_URL = 'https://maps.google.com/?cid=5973618623656745225';
const PUBLIC_GITHUB_URL = 'https://github.com/edm28contact-wq/EDM28';

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

async function loadPublicBusiness() {
  const fallback = { ...DEFAULT_PUBLIC_BUSINESS };
  try {
    const supabase = resolveSupabasePublicConfig();
    if (!supabase.url || !supabase.key) return fallback;
    const params = new URLSearchParams({
      select: 'business_name,address_line1,address_line2,postal_code,city,country,phone,email,website,logo_url,timezone,booking_url,updated_at',
      id: 'eq.true',
      limit: '1'
    });
    const response = await fetch(`${supabase.url}/rest/v1/public_business_profile?${params}`, {
      headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` }
    });
    if (!response.ok) return fallback;
    const rows = await response.json();
    return { ...fallback, ...((Array.isArray(rows) && rows[0]) || {}) };
  } catch (error) {
    console.error('public business load error', error);
    return fallback;
  }
}

function businessAddress(business) {
  return [business.address_line1, business.address_line2, [business.postal_code, business.city].filter(Boolean).join(' '), business.country].filter(Boolean).join(', ');
}

function oneLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function buildSecondaryEntityStructuredData(origin, business) {
  const addressText = businessAddress(business);
  const address = business.address_line1 ? {
    '@type': 'PostalAddress',
    streetAddress: [business.address_line1, business.address_line2].filter(Boolean).join(', '),
    addressLocality: business.city || undefined,
    postalCode: business.postal_code || undefined,
    addressCountry: business.country || 'FR'
  } : undefined;
  const knowsAbout = ['freinage automobile', 'plaquettes de frein', 'disques de frein', 'liquide de frein', 'liaison au sol', 'train roulant', 'triangles de suspension', 'direction'];
  const common = {
    name: business.business_name || 'EDM28',
    url: business.website || `${origin}/`,
    sameAs: [PUBLIC_GOOGLE_MAPS_URL, PUBLIC_GITHUB_URL],
    ...(business.email ? { email: business.email } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(address ? { address } : {}),
    knowsAbout
  };

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        ...common,
        alternateName: ['EDM', 'EDM 28', 'edm28.fr'],
        logo: `${origin}/logo-edm.svg`,
        ...(business.email ? { contactPoint: { '@type': 'ContactPoint', contactType: 'service client', email: business.email, ...(business.phone ? { telephone: business.phone } : {}), availableLanguage: ['fr'] } } : {}),
        description: addressText
          ? `${business.business_name || 'EDM28'} est un garage automobile situé au ${addressText}, spécialisé en freinage et liaison au sol.`
          : 'Garage automobile spécialisé en freinage et liaison au sol.'
      },
      {
        '@type': 'AutoRepair',
        '@id': `${origin}/#autorepair`,
        ...common,
        alternateName: ['EDM', 'EDM 28', 'edm28.fr'],
        image: `${origin}/logo-edm.svg`,
        areaServed: { '@type': 'Place', name: business.city ? `${business.city} et alentours` : 'Eure-et-Loir et alentours' },
        parentOrganization: { '@id': `${origin}/#organization` },
        description: addressText
          ? `Garage automobile spécialisé en freinage et liaison au sol au ${addressText}.`
          : 'Garage automobile spécialisé en freinage et liaison au sol.'
      }
    ]
  }).replaceAll('<', '\\u003c');
}

function enrichSeoHtml(html, req, business) {
  if (typeof html !== 'string' || !html.includes('</head>') || html.includes('noindex,nofollow')) return html;
  let output = html;
  const publicEmail = oneLine(business.email);
  if (publicEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
    const safeEmail = xmlEscape(publicEmail);
    output = output
      .replaceAll('mailto:contact@edm28.fr', `mailto:${safeEmail}`)
      .replaceAll('>contact@edm28.fr<', `>${safeEmail}<`);
  }
  if (!output.includes('/#organization')) {
    const entityJson = buildSecondaryEntityStructuredData(getOrigin(req), business);
    output = output.replace('</head>', `<script id="edm-entity-identity" type="application/ld+json">${entityJson}</script></head>`);
  }
  const slug = getSeoSlug(req);
  if (slug === 'transparence') {
    const marker = '<div class="links" aria-label="Pages liées">';
    const partsSection = '<section><h2>Pièces automobiles sans marge ni commission</h2><p>EDM28 ne vend pas les pièces automobiles et ne prend aucune marge ni commission sur leur prix. La rémunération du garage porte sur les prestations réalisées.</p></section>';
    output = output.replace(marker, `${partsSection}${marker}`);
  }
  return output;
}

async function handleSeoDocument(delegate, req, res) {
  const business = await loadPublicBusiness();
  const originalSend = res.send.bind(res);
  res.send = (body) => originalSend(injectRecoveryBridge(enrichSeoHtml(body, req, business)));
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
    : [
        'User-agent: Google-Extended',
        'Allow: /',
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        '',
        'User-agent: *',
        'Allow: /',
        'Allow: /garage-freinage-saint-lubin-de-la-haye',
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        `Sitemap: ${origin}/sitemap.xml`,
        ''
      ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}

async function handleLlms(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const business = await loadPublicBusiness();
  const address = oneLine(businessAddress(business));
  const email = oneLine(business.email);
  const phone = oneLine(business.phone);
  const website = oneLine(business.website) || 'https://edm28.fr/';
  const body = [
    `# ${oneLine(business.business_name) || 'EDM28'}`,
    '',
    'EDM28, aussi appele EDM ou EDM 28, est le garage automobile officiel de Saint-Lubin-de-la-Haye (28410) reference par le site edm28.fr.',
    'Le garage est specialise principalement dans le freinage et intervient aussi sur des prestations ciblees de liaison au sol et de train roulant.',
    '',
    'Noms de marque: EDM28, EDM 28, EDM.',
    `Site officiel: ${website}`,
    email ? `Contact public: ${email}` : '',
    phone ? `Telephone public: ${phone}` : '',
    address ? `Adresse: ${address}` : '',
    `Google Business Profile: ${PUBLIC_GOOGLE_MAPS_URL}`,
    `Depot public officiel: ${PUBLIC_GITHUB_URL}`,
    '',
    '## Methode',
    '- Controle du besoin reel avant intervention.',
    '- Devis avant travaux et validation du client avant toute extension.',
    '- EDM28 ne vend pas les pieces de remplacement et ne prend pas de marge cachee sur leur prix.',
    '- Les informations de contact et de localisation ci-dessus sont synchronisees depuis le back-office EDM28.',
    '',
    '## Pages principales',
    '- Accueil: https://edm28.fr/',
    '- Freinage: https://edm28.fr/freinage',
    '- Liaison au sol: https://edm28.fr/liaison-au-sol',
    '- Tarifs: https://edm28.fr/tarifs',
    '- Fonctionnement: https://edm28.fr/fonctionnement',
    '- A propos / identite: https://edm28.fr/a-propos',
    '- Contact: https://edm28.fr/contact',
    ''
  ].filter((line) => line !== '').join('\n').replace(/\n{3,}/g, '\n\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}

export default async function handler(req, res) {
  if (serveRecoveryPage(req, res, resolveSupabasePublicConfig())) return;
  const seoMode = getSeoMode(req);
  if (seoMode === 'page') {
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return await handleSeoDocument(publicSeoHandler, req, res);
  }
  if (seoMode === 'symptom') {
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return await handleSeoDocument(symptomSeoHandler, req, res);
  }
  if (seoMode === 'robots') return handleRobots(req, res);
  if (seoMode === 'sitemap') return handleSitemap(req, res);
  if (seoMode === 'llms') return await handleLlms(req, res);
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
          alternateName: ['EDM', 'EDM 28', 'edm28.fr'],
          inLanguage: 'fr-FR',
          publisher: { '@id': `${origin}/#organization` }
        },
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'EDM28',
          alternateName: ['EDM', 'EDM 28', 'edm28.fr'],
          url: `${origin}/`,
          sameAs: [PUBLIC_GOOGLE_MAPS_URL, PUBLIC_GITHUB_URL],
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
          alternateName: ['EDM', 'EDM 28', 'edm28.fr'],
          url: `${origin}/`,
          sameAs: [PUBLIC_GOOGLE_MAPS_URL, PUBLIC_GITHUB_URL],
          image: `${origin}/logo-edm.svg`,
          email: PUBLIC_EMAIL,
          address: localAddress,
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
