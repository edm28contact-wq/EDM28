import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import appHandler from '../api/app.js';
import adminHandler from '../api/admin.js';

const root = process.cwd();
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
process.env.VERCEL_ENV = 'preview';
process.env.VERCEL_GIT_COMMIT_SHA = process.env.RECOVERY_SHA;
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname.endsWith('.supabase.co')) return Promise.resolve(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
  return realFetch(input, init);
};
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    const incoming = new URL(req.url, 'http://127.0.0.1:4180');
    const route = config.routes.find((entry) => entry.src === incoming.pathname);
    const destination = new URL(route?.dest || incoming.pathname, incoming.origin);
    res.status = (status) => { res.statusCode = status; return res; };
    res.send = (body) => res.end(body);
    req.query = { ...Object.fromEntries(incoming.searchParams), ...Object.fromEntries(destination.searchParams) };
    req.url = destination.pathname + destination.search;
    if (destination.pathname === '/api/app') return await appHandler(req, res);
    if (destination.pathname === '/api/admin') return await adminHandler(req, res);
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    const path = resolve(root, '.' + decodeURIComponent(destination.pathname));
    if (!path.startsWith(root + sep) || destination.pathname.startsWith('/api/')) return res.status(404).end();
    const body = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (_) { res.statusCode = 500; res.end('Test server error'); }
}).listen(4180, '127.0.0.1', () => console.log('Recovery fixture server listening on 127.0.0.1:4180'));
