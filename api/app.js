import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_PATH = join(process.cwd(), 'index.html');

const LEGACY_SUPABASE_URL = 'https://ojjbnwpkfvzjfukgqddz.supabase.co';
const LEGACY_SUPABASE_KEY = 'sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX';
const EDM28_SUPABASE_URL = 'https://vbfklmcjrdlqismewmly.supabase.co';
const EDM28_SUPABASE_KEY = 'sb_publishable_7pT3ZVabu5lL-mq1eC1uwA_fucXtYqI';

function replaceAll(source, search, replacement) {
  return source.split(search).join(replacement);
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    let html = readFileSync(INDEX_PATH, 'utf8');

    // Le site doit utiliser le même projet Supabase que le back-office et le SMTP.
    // Cette substitution corrige aussi les anciennes versions de l'index encore présentes
    // dans le dépôt sans exposer de clé privée : la clé ci-dessous est publiable.
    html = replaceAll(html, LEGACY_SUPABASE_URL, EDM28_SUPABASE_URL);
    html = replaceAll(html, LEGACY_SUPABASE_KEY, EDM28_SUPABASE_KEY);

    const loader = `<script>window.addEventListener('DOMContentLoaded',function(){['/integration.js?v=4','/auth-feedback.js?v=1'].forEach(function(src){var script=document.createElement('script');script.src=src;document.body.appendChild(script);});});<\/script>`;
    html = html.replace('</body>', `${loader}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('app loader error', error);
    return res.status(500).send('<h1>EDM AUTO</h1><p>Application temporairement indisponible.</p>');
  }
}
