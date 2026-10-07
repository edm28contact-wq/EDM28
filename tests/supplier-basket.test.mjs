import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import policy from '../supplier-basket-policy.js';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const parts = { requires_parts: true, supplier_url: 'https://supplier.example/basket/abc?a=1&b=2', recommended_parts: 'Disc - REF-123 - quantity 2\nPads - REF-456 - quantity 1' };

for (const url of ['javascript:alert(1)', 'http://supplier.example/cart', 'https://user:pass@supplier.example/', 'https://supplier.example:8080/', 'https://supplier.example/\ncart', 'https://127.0.0.1/cart', 'https://supplier.local/', 'https://supplier.example\\@other.example', 'https://supplier.example/' + 'a'.repeat(2000)]) {
  test(`unsafe supplier URL rejected: ${url.slice(0, 65)}`, () => assert.throws(() => policy.safeUrl(url)));
}
test('supplier basket retains exact references without adding monetary line items', () => {
  assert.deepEqual(policy.basket(parts, true), parts);
  assert.throws(() => policy.basket({ ...parts, recommended_parts: '' }, true));
  assert.throws(() => policy.basket({ ...parts, supplier_url: '' }, true));
  assert.throws(() => policy.basket({ ...parts, requires_parts: false }, true));
  assert.deepEqual(policy.basket({ requires_parts: false }), { requires_parts: false, supplier_url: null, recommended_parts: '' });
});
test('parts references are preserved up to the documented limit', () => {
  assert.equal(policy.basket({ ...parts, recommended_parts: 'x'.repeat(6000) }, true).recommended_parts.length, 6000);
  assert.throws(() => policy.basket({ ...parts, recommended_parts: 'x'.repeat(6001) }));
});
test('new quote defaults use prestation price only, never parts price estimates', () => {
  const items = policy.defaultItems({ total: 250, service_requests: { totals: { totalAllMax: 250 }, services: [{ name: 'Freinage', labor: 99, parts: { standard: [100, 151] } }] } });
  assert.equal(items.length, 1);
  assert.equal(items[0].unit_price, 99);
  assert.equal(items[0].item_type, 'labor');
  assert.equal(policy.defaultItems({ total: 250 })[0].unit_price, 0);
});
test('service items reject resale, invalid quantities, prices and VAT', () => {
  const item = { item_type: 'labor', designation: 'Prestation freinage', quantity: 1, unit_price: 99, vat_rate: 0 };
  assert.equal(policy.serviceItems([item])[0].purchase_mode, 'customer_supplied');
  assert.equal(policy.serviceItems([item])[0].purchase_total, 0);
  assert.equal(Object.hasOwn(policy.serviceItems([item])[0], 'total'), false);
  for (const patch of [{ item_type: 'part' }, { quantity: 0 }, { quantity: 1.333 }, { unit_price: -1 }, { unit_price: Infinity }, { vat_rate: 101 }]) assert.throws(() => policy.serviceItems([{ ...item, ...patch }]));
});
test('email includes both persisted basket and fixed references and never automatic fees', () => {
  const body = policy.quoteMessage({ quote: { quote_number: 'D-1', total: 99, valid_until: '2030-01-01' }, basket: parts, clientName: 'Client test' });
  assert.ok(body.includes(parts.supplier_url));
  assert.ok(body.includes(parts.recommended_parts));
  assert.ok(body.includes(policy.terms));
  assert.ok(body.includes(policy.partsAdvice));
  assert.match(body, /15\s*€/);
  assert.match(body, /préconisation EDM28/);
  assert.doesNotMatch(body, /60\s*%|d[e\u00e9]bours|provision|mandat|immobilisation\s*40/i);
});
test('archived modules are no longer loaded and current public copy matches the model', async () => {
  const [admin, client, publicClient, seo, html] = await Promise.all(['api/admin.js','client-simple-flow.js','public-client.js','public-seo.js','admin.html'].map(read));
  assert.doesNotMatch(admin, /script src="\/admin-disbursements/);
  assert.doesNotMatch(client, /src: '\/client-disbursements/);
  assert.doesNotMatch(publicClient, /from\('disbursements'\)/);
  assert.doesNotMatch(seo, /d[e\u00e9]bours|mandat d'achat|provision/i);
  assert.match(publicClient, /EDMClientJourney/);
  assert.match(await read('client-journey.js'), /client_respond_quote/);
  assert.ok(html.indexOf('/supplier-basket-policy.js') < html.indexOf('/admin-supplier-basket.js'));
  assert.ok(html.indexOf('/admin-supplier-basket.js') < html.indexOf('/admin-quotes.js'));
});
test('all recommendations are included in the new quote PDF; legacy documents stay separate', async () => {
  const context = { window: {}, Blob, Uint8Array, TextEncoder, atob: s => Buffer.from(s, 'base64').toString('binary') };
  vm.runInNewContext(await read('pdf-lite.js'), context);
  const row = { id: 'fixture', quote_number: 'TEST-QUOTE', commercial_model: 'customer_supplied_v1', total: 99, subtotal: 99, discount: 0, created_at: '2026-09-29', valid_until: '2030-01-01', quote_parts_baskets: parts, profiles: { first_name: 'Client', last_name: 'Test' }, quote_items: [{ item_type: 'labor', designation: 'Prestation freinage', description: 'Consommables inclus', quantity: 1, unit_price: 99, total: 99, vat_rate: 0 }] };
  const pdf = context.window.EDMPdfLite.buildDocument('quote', { cfg: { business_name: 'EDM28' }, row });
  const decode = buffer => [...Buffer.from(buffer).toString('latin1').matchAll(/<([0-9A-F]+)> Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
  const text = decode(await pdf.arrayBuffer());
  assert.match(text, /REF-123/);
  assert.match(text, /REF-456/);
  assert.match(text, /supplier\.example/);
  assert.match(text, /99[.,]00/);
  const legacy = context.window.EDMPdfLite.buildDocument('quote', { cfg: { business_name: 'EDM28' }, row: { ...row, commercial_model: 'legacy' } });
  const legacyText = decode(await legacy.arrayBuffer());
  assert.doesNotMatch(legacyText, /REF-123|supplier\.example/);
});
