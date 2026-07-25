import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabasePublicConfig } from './supabase-config.js';

const INDEX_PATH = join(process.cwd(), 'index.html');
const ROUTER_PATH = join(process.cwd(), 'client-navigation-visible.js');

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export default function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    let html = readFileSync(INDEX_PATH, 'utf8');
    const criticalRouter = readFileSync(ROUTER_PATH, 'utf8').replace(/<\/script/gi, '<\\/script');
    const supabase = resolveSupabasePublicConfig();

    if (!supabase.url || !supabase.key) {
      throw new Error(`Configuration Supabase ${supabase.environment} absente.`);
    }

    html = html
      .replace(/const SUPABASE_URL = "[^"]+";/, `const SUPABASE_URL = ${JSON.stringify(supabase.url)};`)
      .replace(/const SUPABASE_ANON_KEY = "[^"]+";/, `const SUPABASE_ANON_KEY = ${JSON.stringify(supabase.key)};`)
      .replace('<title>EDM AUTO</title>', '<title>EDM · Freinage & liaison au sol</title>')
      .replace('content="EDM AUTO - Demande mécanique simple, estimation claire et reprise manuelle."', 'content="EDM, spécialiste du freinage et de la liaison au sol. Préparez votre demande et validez le prix avant toute intervention supplémentaire."')
      .replace('<meta name="theme-color" content="#111827">', '<meta name="theme-color" content="#cec7c0">')
      .replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', '<link rel="icon" href="/logo-edm.svg" type="image/svg+xml">')
      .replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="/logo-edm.svg">')
      .replace('<meta name="apple-mobile-web-app-title" content="EDM AUTO">', '<meta name="apple-mobile-web-app-title" content="EDM">');

    const socialMeta = `<meta name="edm-environment" content="${supabase.environment}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="EDM · Freinage & liaison au sol"><meta property="og:description" content="Préparez votre demande, comparez les pièces et validez le prix avant travaux."><meta property="og:image" content="/logo-edm.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="EDM · Freinage & liaison au sol"><meta name="twitter:description" content="Préparez votre demande, comparez les pièces et validez le prix avant travaux."><style id="edm-boot-style">html{background:#cec7c0}body{visibility:hidden}</style><script>${criticalRouter}<\/script>`;
    html = html.replace('</head>', `${socialMeta}</head>`);

    const accountPrelude = '<script src="/client-account-safe.js?v=13"><\/script>';
    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=['/integration.js?v=5','/final-system.js?v=2','/request-history.js?v=2','/service-details.js?v=1','/ui-final.js?v=7','/theme-light.js?v=5','/home-premium.js?v=3','/contact-footer.js?v=2','/accessibility-mobile.js?v=1','/reliability.js?v=2','/white-background.js?v=2','/light-palette-final.js?v=2','/mid-palette-final.js?v=1','/client-simple-flow.js?v=8','/palette-edm-reference.js?v=1','/combo-suspended.js?v=1'];var reveal=function(){var style=document.getElementById('edm-boot-style');if(style)style.remove();document.body.style.visibility='visible';};var timeout=setTimeout(reveal,4000);scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){console.error('EDM optional module unavailable',src);resolve();};document.body.appendChild(s);});});},Promise.resolve()).finally(function(){clearTimeout(timeout);reveal();});});<\/script>`;
    html = html.replace('</body>', `${accountPrelude}${loader}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-EDM-Environment', supabase.environment);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('app loader error', error);
    return res.status(500).send('<h1>EDM</h1><p>Application temporairement indisponible.</p>');
  }
}
