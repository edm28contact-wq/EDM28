import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
const output = join(root, 'dist');
const allowed = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.json', '.ico', '.txt', '.xml']);
const ignored = new Set(['node_modules', 'dist', '.git', '.github', 'api', 'scripts', 'docs']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (ignored.has(entry.name) || entry.name.startsWith('.')) continue;
  if (entry.isFile() && allowed.has(extname(entry.name).toLowerCase())) {
    await cp(join(root, entry.name), join(output, entry.name));
  }
}

let html = await readFile(join(root, 'index.html'), 'utf8');
const scripts = [
  '/edge-functions-routing.js?v=1',
  '/integration.js?v=5',
  '/final-system.js?v=2',
  '/request-history.js?v=1',
  '/service-details.js?v=1',
  '/ui-final.js?v=6',
  '/theme-light.js?v=4',
  '/home-premium.js?v=3',
  '/contact-footer.js?v=1',
  '/accessibility-mobile.js?v=1',
  '/reliability.js?v=1',
  '/white-background.js?v=2',
  '/light-palette-final.js?v=2',
  '/mid-palette-final.js?v=1',
  '/client-simple-flow.js?v=1',
  '/client-otp-flow.js?v=1'
];
const loader = `<script>window.addEventListener('DOMContentLoaded',function(){var scripts=${JSON.stringify(scripts)};scripts.reduce(function(p,src){return p.then(function(){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});});},Promise.resolve()).catch(function(error){console.error('EDM module load error',error);});});<\/script>`;
html = html.replace('</body>', `${loader}</body>`);
await writeFile(join(output, 'index.html'), html);

await writeFile(join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: no-cache\n`);
await writeFile(join(output, '_redirects'), '/* /index.html 200\n');
console.log('Cloudflare Pages build ready in dist/');