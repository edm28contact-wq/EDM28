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
    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var script=document.createElement('script');script.src='/integration.js?v=3';document.body.appendChild(script);});<\/script>`;
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
