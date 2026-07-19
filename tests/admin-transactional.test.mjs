import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('sensitive admin workflows use transactional RPC calls', async () => {
  const source = await read('admin-transactional.js');
  for (const rpc of [
    'admin_create_quote_from_request',
    'admin_prepare_quote',
    'admin_finalize_repair_order',
    'admin_record_payment'
  ]) assert.match(source, new RegExp(`rpc\\('${rpc}'`));
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /addEventListener\('click',[\s\S]*true\)/);
});

test('admin route injects the transactional adapter without privileged keys', async () => {
  const source = await read('api/admin.js');
  assert.match(source, /admin-transactional\.js/);
  assert.match(source, /encodedTransactional/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role/);
});

test('Vercel packages every file required by the protected admin route', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const included = config.functions?.['api/admin.js']?.includeFiles || '';
  assert.match(included, /admin\.html/);
  assert.match(included, /admin-core\.js/);
  assert.match(included, /admin-transactional\.js/);
});
