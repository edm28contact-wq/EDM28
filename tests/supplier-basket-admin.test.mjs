import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import policy from '../supplier-basket-policy.js';
const source = await readFile(new URL('../admin-supplier-basket.js', import.meta.url), 'utf8');
function fixture(failure = '') {
  const events = [], statuses = [];
  const fields = { requiresParts: { checked: true }, supplierUrl: { value: 'https://supplier.example/basket/1' }, recommendedParts: { value: 'REF-123 x 2' }, number: { value: '' }, title: { value: 'Prestation freinage' }, description: { value: 'Consommables inclus' }, discount: { value: '0' }, validUntil: { value: '2030-01-01' } };
  const meta = { dataset: { basketRevision: '' } };
  const line = { type: 'labor', designation: 'Prestation', description: 'Consommables inclus', quantity: '1', unit_price: '99', vat_rate: '0' };
  const root = { dataset: { quoteId: 'q1' }, querySelector(selector) { if (selector === '[data-supplier-basket]') return meta; return fields[selector.match(/"([^"]+)"/)[1]]; }, querySelectorAll() { return [{ querySelector(selector) { return { value: line[selector.match(/"([^"]+)"/)[1]] }; } }]; } };
  const query = { select() { return this; }, eq() { return this; }, async single() { events.push('read'); return { data: { id: 'q1', user_id: 'u1' } }; } };
  const db = { from: () => query, auth: { async getSession() { return { data: { session: { access_token: 'test-token' } } }; } }, async rpc(name, params) { events.push(name); if (failure === name) return { error: new Error('Rejected') }; if (name === 'admin_save_service_quote') { assert.equal(params.p_items[0].unit_price, 99); assert.equal(params.p_items[0].purchase_mode, 'customer_supplied'); assert.equal(params.p_basket.recommended_parts, 'REF-123 x 2'); return { data: { revision: 'r1', quote_number: 'D-1' } }; } assert.equal(params.p_revision, 'r1'); assert.equal(params.p_pdf_path, 'u1/quote/q1.pdf'); return { data: { status: 'sent' } }; } };
  const context = { window: { EDMSupplierBasketPolicy: policy, EDMAdmin: { db, esc: s => String(s), status: (...args) => statuses.push(args), async overview() {} }, EDMAdminDocumentPdf: { async generateFor() { events.push('pdf'); if (failure === 'pdf') throw new Error('PDF failed'); return 'u1/quote/q1.pdf'; } }, EDMAdminQuotes: { async load() {} } }, async fetch(_url, options) { events.push('email'); const body = JSON.parse(options.body); assert.equal(body.attachmentPath, 'u1/quote/q1.pdf'); assert.equal(body.relatedId, 'q1'); return { ok: failure !== 'email', async json() { return { success: failure !== 'email', error: 'Provider refused' }; } }; } };
  vm.runInNewContext(source, context);
  return { events, statuses, fields, meta, root, workflow: context.window.EDMAdminSupplierBasket, button: { closest: () => root } };
}
test('save, PDF, atomic publication and one email occur in that order', async () => {
  const f = fixture(); await f.workflow.publish(f.button);
  assert.deepEqual(f.events, ['admin_save_service_quote','read','pdf','admin_publish_service_quote','email']);
  assert.equal(f.meta.dataset.basketRevision, 'r1');
  assert.equal(f.statuses.at(-1)[2], false);
});
for (const fail of ['admin_save_service_quote', 'pdf', 'admin_publish_service_quote']) test(`no email after ${fail} failure`, async () => {
  const f = fixture(fail); await assert.rejects(() => f.workflow.publish(f.button));
  assert.equal(f.events.includes('email'), false);
});
test('invalid basket prevents any database change', async () => {
  const f = fixture(); f.fields.supplierUrl.value = 'javascript:alert(1)';
  await assert.rejects(() => f.workflow.publish(f.button)); assert.equal(f.events.length, 0);
});
test('provider failure is not reported as a successful client email', async () => {
  const f = fixture('email'); await f.workflow.publish(f.button);
  assert.equal(f.statuses.at(-1)[2], true);
  assert.match(f.statuses.at(-1)[1], /email non envoy/);
  assert.equal(f.events.filter(x => x === 'email').length, 1);
});
