import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabasePublicConfig } from './supabase-config.js';

const ADMIN_PATH = join(process.cwd(), 'admin.html');
const ADMIN_CORE_PATH = join(process.cwd(), 'admin-core.js');
const ADMIN_TRANSACTIONAL_PATH = join(process.cwd(), 'admin-transactional.js');

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    let html = readFileSync(ADMIN_PATH, 'utf8');
    let adminCore = readFileSync(ADMIN_CORE_PATH, 'utf8');
    const adminTransactional = readFileSync(ADMIN_TRANSACTIONAL_PATH, 'utf8');
    const supabase = resolveSupabasePublicConfig();

    if (!supabase.url || !supabase.key) {
      throw new Error(`Configuration Supabase ${supabase.environment} absente.`);
    }

    adminCore = adminCore
      .replace(/'https:\/\/[^']+\.supabase\.co'/, JSON.stringify(supabase.url))
      .replace(/'sb_publishable_[^']+'/, JSON.stringify(supabase.key));

    html = html.replace('</head>', `<meta name="edm-environment" content="${supabase.environment}"></head>`);

    const encodedCore = Buffer.from(adminCore, 'utf8').toString('base64');
    const encodedTransactional = Buffer.from(adminTransactional, 'utf8').toString('base64');
    const inlineLoader = `<script>eval(decodeURIComponent(escape(atob('${encodedCore}'))));<\/script>`;
    const transactionalLoader = `<script>eval(decodeURIComponent(escape(atob('${encodedTransactional}'))));<\/script>`;
    html = html.replace('<script src="/admin-core.js?v=4"></script>', `${inlineLoader}${transactionalLoader}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-EDM-Environment', supabase.environment);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('admin loader error', error);
    return res.status(500).send('<h1>Gestion EDM28</h1><p>Interface temporairement indisponible.</p>');
  }
}
