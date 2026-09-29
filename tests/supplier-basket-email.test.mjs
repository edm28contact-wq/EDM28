import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSendNotification } from '../lib/send-notification.js';
const userId = '11111111-1111-4111-8111-111111111111';
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const quoteId = '22222222-2222-4222-8222-222222222222';
const pdfPath = `${userId}/quote/${quoteId}.pdf`;
async function run(t, options = {}) {
  const sent = [], logs = [];
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.RESEND_FROM_EMAIL;
  process.env.RESEND_API_KEY = 're_test_fixture'; process.env.RESEND_FROM_EMAIL = 'EDM28 <noreply@example.test>';
  t.after(() => { if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = oldFrom; });
  const quote = { id: quoteId, user_id: userId, total: 99, quote_number: 'DEV-TEST', valid_until: '2030-01-01', status: 'sent', visible_to_client: true, pdf_path: pdfPath, commercial_model: 'customer_supplied_v1', quote_parts_baskets: { requires_parts: true, supplier_url: 'https://supplier.example/basket?code=one&safe=two', recommended_parts: 'REF-123 - 2 discs\nREF-456 - 1 set\n<script>not HTML</script>' }, ...options.quote };
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input); const table = url.pathname.split('/').at(-1);
    if (url.pathname === '/auth/v1/user') return response({ id: adminId });
    if (url.hostname === 'api.resend.com') { sent.push(JSON.parse(init.body)); return response(options.providerFailure ? { message: 'Rejected' } : { id: 'provider-id' }, options.providerFailure ? 422 : 200); }
    if (url.pathname.includes('/storage/v1/')) { assert.ok(url.pathname.endsWith(pdfPath)); return new Response('%PDF-1.4 fixture'); }
    if (table === 'profiles') return response(url.searchParams.get('id') === `eq.${adminId}` ? [{ id: adminId, role: options.nonAdmin ? 'customer' : 'admin' }] : [{ id: userId, first_name: 'Customer', last_name: 'Test', email: 'customer@example.test' }]);
    if (table === 'message_templates') return response([{ subject: 'Old template', body: 'Old body' }]);
    if (table === 'business_configuration') return response([{ business_name: 'EDM28', email: 'contact@example.test' }]);
    if (table === 'automation_settings') return response([{ messages_enabled: true, test_mode: false }]);
    if (table === 'quotes') {
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      assert.equal(url.searchParams.get('id'), `eq.${quoteId}`);
      return response(options.missingQuote ? [] : [quote]);
    }
    if (table === 'outbound_notifications') { logs.push(JSON.parse(init.body)); return response(init.method === 'POST' ? [{ id: 'log-id' }] : []); }
    throw new Error(`Unexpected network destination: ${url.origin}${url.pathname}`);
  });
  const res = { statusCode: 0, setHeader() {}, status(code) { this.statusCode = code; return this; }, end(body) { this.body = JSON.parse(body); } };
  await handleSendNotification({ method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: { userId, templateKey: 'quote_sent', relatedType: 'quote', relatedId: quoteId, attachmentPath: pdfPath, attachmentName: 'devis-test.pdf', values: { total: '9999', supplier_url: 'https://wrong.example/' }, ...options.body } }, res);
  return { res, sent, logs, quote };
}
test('one email carries the saved quote PDF and saved supplier basket, not caller values', async t => {
  const { res, sent, quote } = await run(t);
  assert.equal(res.statusCode, 200); assert.equal(sent.length, 1);
  assert.equal(sent[0].attachments.length, 1);
  assert.equal(Buffer.from(sent[0].attachments[0].content, 'base64').toString(), '%PDF-1.4 fixture');
  assert.equal(sent[0].to[0], 'customer@example.test');
  assert.ok(sent[0].text.includes(quote.quote_parts_baskets.supplier_url));
  assert.ok(sent[0].text.includes(quote.quote_parts_baskets.recommended_parts));
  assert.match(sent[0].html, /href="https:\/\/supplier\.example\/basket\?code=one&amp;safe=two"/);
  assert.doesNotMatch(sent[0].html, /<script>|9999|wrong\.example/);
});
for (const [name, opts] of [
  ['wrong document', { body: { attachmentPath: 'other-client/quote/secret.pdf' } }],
  ['another recipient', { body: { recipientEmail: 'other@example.test' } }],
  ['missing owned quote', { missingQuote: true }],
  ['draft', { quote: { status: 'draft', visible_to_client: false } }],
  ['bad supplier link', { quote: { quote_parts_baskets: { requires_parts: true, supplier_url: 'javascript:alert(1)', recommended_parts: 'REF' } } }],
  ['non admin', { nonAdmin: true }]
]) test(`${name} cannot send a quote`, async t => {
  const { res, sent } = await run(t, opts); assert.notEqual(res.statusCode, 200); assert.equal(sent.length, 0);
});
test('no-parts prestation sends its PDF without inventing a supplier order', async t => {
  const { res, sent } = await run(t, { quote: { quote_parts_baskets: { requires_parts: false, supplier_url: null, recommended_parts: '' } } });
  assert.equal(res.statusCode, 200); assert.equal(sent[0].attachments.length, 1);
  assert.doesNotMatch(sent[0].html, /Ouvrir mon panier fournisseur/);
});
test('provider errors are logged as failed and never confirmed as delivered', async t => {
  const { res, logs } = await run(t, { providerFailure: true });
  assert.equal(res.body.success, false); assert.equal(logs.at(-1).status, 'failed');
});
