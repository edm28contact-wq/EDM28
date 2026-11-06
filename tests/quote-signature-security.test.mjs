import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

test('quote electronic signature stores evidence and defaults to safe staged activation',async()=>{
 const sql=await read('supabase/migrations/20261106215500_quote_signature_evidence.sql');
 for(const marker of ['quote_signature_challenges','quote_signatures','quote_signature_policy',
  'enforced boolean NOT NULL DEFAULT false','edm28_quote_signature_required',
  'edm28_quote_signature_immutable','edm28_signed_quote_immutable',
  'edm28_finalize_signed_quote','edm28_signature_wrong_code',
  'edm28_signed_quotes_no_delete'])assert.ok(sql.includes(marker),marker);
 assert.match(sql,/code_hash text NOT NULL/);
 assert.match(sql,/attempts BETWEEN 0 AND 5/);
 assert.match(sql,/RETURN jsonb_build_object\('quote_id'/);
 assert.doesNotMatch(sql,/DELETE FROM public\.quotes/);
});
test('signing API checks verified Supabase user, document hash and OTP before finalizing',async()=>{
 const src=await read('api/sign-quote.js');
 assert.match(src,/auth\/v1\/user/);
 assert.match(src,/user\.email_confirmed_at/);
 assert.match(src,/createSignedUrl|sourceDocument/);
 assert.match(src,/timingSafeEqual/);
 assert.match(src,/crypto\.randomInt\(10000000,100000000\)/);
 assert.match(src,/action==='start'/);
 assert.match(src,/action!=='sign'/);
 assert.match(src,/consent!==true/);
 assert.match(src,/recordWrongCode/);
 assert.match(src,/client-sign-quote/);
 assert.doesNotMatch(src,/RESEND_API_KEY[^;]*return\s+/);
});
test('signing server fetches canonical PDF and hashes resulting archived PDF',async()=>{
 const src=await read('supabase/functions/client-sign-quote/index.ts');
 assert.match(src,/source_sha256/);
 assert.match(src,/sourceBytes|originalHash/);
 assert.match(src,/pdf\.addPage/);
 assert.match(src,/signed-quotes/);
 assert.match(src,/edm28_finalize_signed_quote/);
 assert.match(src,/x-upsert.*false/);
 assert.match(src,/savedPath/);
});
test('all customer quote acceptance surfaces route to the signature modal',async()=>{
 const journey=await read('client-journey.js');
 const quotes=await read('client-quotes.js');
 const status=await read('client-request-status-history.js');
 const internal=await read('client-internal-booking.js');
 for(const text of [journey,quotes,status,internal])assert.match(text,/EDMQuoteSignature\.sign\(/);
 const modal=await read('quote-signature.js');
 assert.match(modal,/data-qs-consent/);
 assert.match(modal,/createSignedUrl/);
 assert.match(modal,/code.*name.*consent:true/);
 const seo=await read('public-seo.js');
 const app=await read('api/app.js');
 assert.match(seo,/quote-signature\.js\?v=1/);
 assert.match(app,/quote-signature\.js\?v=1/);
});
