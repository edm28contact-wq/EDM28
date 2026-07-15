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
    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=['/integration.js?v=4','/final-system.js?v=1','/ui-final.js?v=5'];scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});});},Promise.resolve()).catch(function(error){console.error('EDM module load error',error);});});<\/script>`;
    html = html.replace('</body>', `${loader}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('app loader error', error);
    return res.status(500).send('<h1>EDM AUTO</h1><p>Application temporairement indisponible.</p>');
  }
}
