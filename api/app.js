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

    html = html
      .replace('<title>EDM AUTO</title>', '<title>EDM · Spécialiste du freinage</title>')
      .replace('content="EDM AUTO - Demande mécanique simple, estimation claire et reprise manuelle."', 'content="EDM, spécialiste du freinage et de l’entretien automobile. Préparez votre demande et consultez une estimation indicative."')
      .replace('<meta name="theme-color" content="#111827">', '<meta name="theme-color" content="#f7f5f2">')
      .replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', '<link rel="icon" href="/logo-edm.svg" type="image/svg+xml">')
      .replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="/logo-edm.svg">')
      .replace('<meta name="apple-mobile-web-app-title" content="EDM AUTO">', '<meta name="apple-mobile-web-app-title" content="EDM">');

    const socialMeta = `<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="EDM · Spécialiste du freinage"><meta property="og:description" content="Préparez votre demande d'entretien automobile et consultez une estimation indicative."><meta property="og:image" content="/logo-edm.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="EDM · Spécialiste du freinage"><meta name="twitter:description" content="Préparez votre demande d'entretien automobile et consultez une estimation indicative.">`;
    html = html.replace('</head>', `${socialMeta}</head>`);

    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=['/integration.js?v=4','/final-system.js?v=1','/ui-final.js?v=6','/theme-light.js?v=4','/home-premium.js?v=3','/contact-footer.js?v=1','/accessibility-mobile.js?v=1','/reliability.js?v=1','/white-background.js?v=2','/light-palette-final.js?v=1'];scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});});},Promise.resolve()).catch(function(error){console.error('EDM module load error',error);});});<\/script>`;
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