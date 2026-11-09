import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('consumer legal routes and direct withdrawal control stay visible',async()=>{
 const [pages,seo,route,ui]=await Promise.all([
  source('legal-pages.js'),source('public-seo.js'),source('vercel.json'),source('legal-withdrawal.js')
 ]);
 for(const word of ['conditions-generales','mentions-legales','confidentialite','retractation','medíateur'.normalize('NFC').replace('í','i')]){
  assert.ok(pages.toLowerCase().includes(word.toLowerCase()),word);
 }
 assert.match(pages,/60 % du prix de la réparation n’est dû/);
 assert.match(pages,/14 jours/);
 assert.match(pages,/EDM28 reste responsable/);
 assert.match(seo,/legalPages/);
 assert.match(seo,/edmWithdrawalForm/);
 assert.match(seo,/Renoncer au contrat ici/);
 const routes=JSON.parse(route).routes;
 for(const path of ['/conditions-generales','/mentions-legales','/confidentialite','/retractation'])
  assert.ok(routes.find(item=>item.src===path),path);
 assert.match(ui,/data-qs-no-such-element|Confirmer la rétractation|Enregistrement de la déclaration/);
});
test('withdrawal receipt API enforces identity fields and records before emailing',async()=>{
 const api=await source('api/withdrawal.js');
 for(const phrase of ['consumer_withdrawal_requests','confirmed!==true','request_digest','receipt_status',
 'submittedAt','receiptSent','api.resend.com','contact@edm28.fr'])
  assert.ok(api.includes(phrase),phrase);
 assert.doesNotMatch(api,/DELETE FROM (?:public\.)?quotes|status\s*=\s*['"]cancelled/);
 const sql=await source('supabase/migrations/20261109120000_consumer_withdrawals.sql');
 const guard=await source('supabase/migrations/20261109123000_withdrawal_statement_immutable.sql');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL/);
 assert.match(guard,/REVOKE UPDATE/);
 assert.match(guard,/edm28_preserve_withdrawal_statement/);
});
