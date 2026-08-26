import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('only registration plate is required in client vehicle form', async () => {
  const [policy, loader, submit] = await Promise.all([
    read('client-vehicle-required-fields.js'),
    read('client-simple-flow.js'),
    read('request-submit-safe.js')
  ]);

  assert.match(loader, /client-vehicle-required-fields\.js\?v=1/);
  assert.match(policy, /plate\.required = true/);
  assert.match(policy, /plate\.setAttribute\('aria-required', 'true'\)/);
  assert.match(policy, /OPTIONAL_IDS = \['mileage', 'brand', 'model', 'year', 'energy'\]/);
  assert.match(policy, /input\.required = false/);
  assert.match(policy, /\(facultatif\)/);
  assert.match(submit, /if \(!vehicle\.plateNormalized\) throw new Error\('Plaque obligatoire\.'\)/);
  assert.doesNotMatch(submit, /if \(!vehicle\.(brand|model|year|energy|mileage)/);
});
