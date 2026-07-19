import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_PATH = join(process.cwd(), 'index.html');

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    let html = readFileSync(INDEX_PATH, 'utf8');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      html = html
        .replace(/const SUPABASE_URL = "[^"]+";/, `const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`)
        .replace(/const SUPABASE_ANON_KEY = "[^"]+";/, `const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseKey)};`);
    }

    html = html
      .replace('<title>EDM AUTO</title>', '<title>EDM · Spécialiste du freinage</title>')
      .replace('content="EDM AUTO - Demande mécanique simple, estimation claire et reprise manuelle."', 'content="EDM, spécialiste du freinage et de l’entretien automobile. Préparez votre demande et consultez une estimation indicative."')
      .replace('<meta name="theme-color" content="#111827">', '<meta name="theme-color" content="#cec7c0">')
      .replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', '<link rel="icon" href="/logo-edm.svg" type="image/svg+xml">')
      .replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="/logo-edm.svg">')
      .replace('<meta name="apple-mobile-web-app-title" content="EDM AUTO">', '<meta name="apple-mobile-web-app-title" content="EDM">');

    const socialMeta = `<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="EDM · Spécialiste du freinage"><meta property="og:description" content="Préparez votre demande d'entretien automobile et consultez une estimation indicative."><meta property="og:image" content="/logo-edm.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="EDM · Spécialiste du freinage"><meta name="twitter:description" content="Préparez votre demande d'entretien automobile et consultez une estimation indicative.">`;
    html = html.replace('</head>', `${socialMeta}</head>`);

    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=['/client-account-safe.js?v=3','/integration.js?v=5','/final-system.js?v=2','/request-history.js?v=1','/service-details.js?v=1','/ui-final.js?v=6','/theme-light.js?v=4','/home-premium.js?v=3','/contact-footer.js?v=1','/accessibility-mobile.js?v=1','/reliability.js?v=1','/white-background.js?v=2','/light-palette-final.js?v=2','/mid-palette-final.js?v=1','/client-simple-flow.js?v=4','/palette-edm-reference.js?v=1','/client-navigation-visible.js?v=2'];scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){console.error('EDM optional module unavailable',src);resolve();};document.body.appendChild(s);});});},Promise.resolve());});<\/script>`;
    html = html.replace('</body>', `${loader}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('app loader error', error);
    return res.status(500).send('<h1>EDM</h1><p>Application temporairement indisponible.</p>');
  }
}