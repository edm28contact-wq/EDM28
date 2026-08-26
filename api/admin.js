import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { resolveSupabasePublicConfig } from './supabase-config.js';

const ADMIN_PATH = join(process.cwd(), 'admin.html');
const ADMIN_CORE_PATH = join(process.cwd(), 'admin-core.js');
const ADMIN_TRANSACTIONAL_PATH = join(process.cwd(), 'admin-transactional.js');
const PREVIEW_ALIAS = 'edm-28-git-feat-admin-prefill-documents-edm-28-s-projects.vercel.app';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ICON_CACHE = new Map();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createAdminIcon(size) {
  if (ICON_CACHE.has(size)) return ICON_CACHE.get(size);

  const stride = (size * 4) + 1;
  const raw = Buffer.alloc(stride * size);
  const outer = Math.round(size * 0.08);
  const inner = Math.round(size * 0.15);
  const stripeTop = Math.round(size * 0.65);
  const stripeBottom = Math.round(size * 0.85);

  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      let color = [17, 24, 39, 255];
      const insideOuter = x >= outer && x < size - outer && y >= outer && y < size - outer;
      const insideInner = x >= inner && x < size - inner && y >= inner && y < size - inner;
      if (insideOuter && !insideInner) color = [255, 255, 255, 255];
      if (insideInner && y >= stripeTop && y < stripeBottom) color = [245, 119, 48, 255];

      const offset = row + 1 + (x * 4);
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const icon = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND')
  ]);
  ICON_CACHE.set(size, icon);
  return icon;
}

function requestedIconSize(req) {
  const queryValue = req.query?.icon;
  if (queryValue === '192' || queryValue === 192) return 192;
  if (queryValue === '512' || queryValue === 512) return 512;
  try {
    const value = new URL(req.url || '', 'http://localhost').searchParams.get('icon');
    if (value === '192') return 192;
    if (value === '512') return 512;
  } catch (_) {}
  return null;
}

function immutablePreviewHost(req) {
  const host = String(req.headers?.host || '').split(':')[0].toLowerCase();
  return process.env.VERCEL_ENV === 'preview'
    && /^edm-28-(?!git-)[a-z0-9]+-edm-28-s-projects\.vercel\.app$/.test(host);
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const iconSize = requestedIconSize(req);
  if (iconSize) {
    const icon = createAdminIcon(iconSize);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(icon.length));
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).end(icon);
  }

  if (immutablePreviewHost(req)) {
    const path = String(req.url || '/admin').startsWith('/') ? String(req.url || '/admin') : '/admin';
    res.setHeader('Location', `https://${PREVIEW_ALIAS}${path}`);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(307).end();
  }

  try {
    let html = readFileSync(ADMIN_PATH, 'utf8');
    let adminCore = readFileSync(ADMIN_CORE_PATH, 'utf8');
    const adminTransactional = readFileSync(ADMIN_TRANSACTIONAL_PATH, 'utf8');
    const supabase = resolveSupabasePublicConfig();
    const build = String(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7);

    if (!supabase.url || !supabase.key) {
      throw new Error(`Configuration Supabase ${supabase.environment} absente.`);
    }

    adminCore = adminCore
      .replace(/'https:\/\/[^']+\.supabase\.co'/, JSON.stringify(supabase.url))
      .replace(/'sb_publishable_[^']+'/, JSON.stringify(supabase.key));

    html = html
      .replace('</head>', `<meta name="edm-environment" content="${supabase.environment}"><meta name="edm-build" content="${build}"></head>`)
      .replaceAll('__EDM_BUILD__', build)
      .replace(/<script src="\/admin-document-pdf\.js\?v=[^"]+"><\/script>/, `<script src="/admin-document-pdf.js?v=${build}"><\/script><script src="/admin-order-personalized-pdf.js?v=${build}"><\/script>`)
      .replace(/<script src="\/admin-publish-email\.js\?v=[^"]+"><\/script>/, `<script src="/admin-quote-message-notify.js?v=${build}"><\/script><script src="/admin-publish-email.js?v=${build}"><\/script>`)
      .replace('</body>', `<script src="/admin-awaiting-acceptance.js?v=${build}"><\/script><script src="/admin-disbursements.js?v=${build}"><\/script><script src="/admin-disbursement-invoice-lock.js?v=${build}"><\/script><script src="/admin-intervention-order-publish.js?v=${build}"><\/script><script src="/admin-invoice-auto-pdf.js?v=${build}"><\/script><script src="/admin-published-payments.js?v=${build}"><\/script><script src="/admin-hide-published.js?v=${build}"><\/script><script src="/admin-reset-data.js?v=${build}"><\/script></body>`);

    const encodedCore = Buffer.from(adminCore, 'utf8').toString('base64');
    const encodedTransactional = Buffer.from(adminTransactional, 'utf8').toString('base64');
    const inlineLoader = `<script>eval(decodeURIComponent(escape(atob('${encodedCore}'))));<\/script>`;
    const transactionalLoader = `<script>eval(decodeURIComponent(escape(atob('${encodedTransactional}'))));<\/script>`;
    html = html.replace(/<script src="\/admin-core\.js\?v=[^"]+"><\/script>/, `${inlineLoader}${transactionalLoader}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-EDM-Environment', supabase.environment);
    res.setHeader('X-EDM-Build', build);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('admin loader error', error);
    return res.status(500).send('<h1>Gestion EDM28</h1><p>Interface temporairement indisponible.</p>');
  }
}
