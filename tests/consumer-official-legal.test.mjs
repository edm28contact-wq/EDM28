import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('official legal identity and hosting coordinates remain configurable without invented values', async()=>{
 const [admin,seo,sql]=await Promise.all([
  read('admin-legal.js'),read('public-seo.js'),
  read('supabase/migrations/20261111175000_legal_registration_and_host_contact.sql')
 ]);
 for(const field of ['registered_business_address','host_phone','siren','siret','vat_status','mediator_name'])
  assert.ok(admin.includes(field),field);
 assert.ok(seo.includes('legal.registered_business_address'));
 assert.ok(seo.includes('legal.host_phone'));
 assert.match(sql,/ADD COLUMN IF NOT EXISTS registered_business_address/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS host_phone/);
});

test('consumer cookie information and AI FAQ third-party disclosure are linked site-wide',async()=>{
 const [pages,seo,route,client]=await Promise.all([
  read('legal-pages.js'),read('public-seo.js'),read('vercel.json'),read('public-client.js')
 ]);
 const routes=JSON.parse(route).routes;
 for(const path of ['/cookies','/pieces-economie-circulaire']){
  assert.ok(routes.some(x=>x.src===path),path);
 }
 assert.match(pages,/Cookies et stockage local/);
 assert.match(pages,/R\.224-25/);
 assert.match(seo,/href="\/cookies"/);
 assert.match(seo,/href="\/pieces-economie-circulaire"/);
 assert.match(seo,/La question saisie est envoyée au service Gemini de Google/);
 assert.match(client,/Données personnelles et vos droits/);
});

test('privacy notice documents purpose, lawful bases and subject rights',async()=>{
 const page=await read('legal-pages.js');
 for(const required of ['Mesures précontractuelles','RGPD, art. 6.1.b','6.1.c','6.1.f','Supabase','Vercel','Resend','CNIL','durées opérationnelles']){
  assert.ok(page.toLowerCase().includes(required.toLowerCase()),required);
 }
});
