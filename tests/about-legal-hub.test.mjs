import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('About includes full legal documents with accessible disclosure navigation',async()=>{
 const [seo,pages,css]=await Promise.all([
   read('public-seo.js'),read('legal-pages.js'),read('public-site.css')
 ]);
 assert.match(seo,/function renderAboutLegalHub\(business, consumerLegal\)/);
 for(const slug of ['mentions-legales','conditions-generales','confidentialite',
   'cookies','pieces-economie-circulaire','retractation']){
   assert.ok(seo.includes("['"+slug+"',"),slug+' About category');
   assert.ok(pages.includes(slug),slug+' source');
 }
 assert.match(seo,/const document = pageWithBusiness\(source, business, consumerLegal\)/);
 assert.match(seo,/document\.sections\.map/);
 assert.match(seo,/about-legal-detail/);
 assert.match(seo,/page\.path === '\/a-propos' \? renderAboutLegalHub\(business, consumerLegal\)/);
 assert.match(seo,/\$\{aboutLegalHub\}<div class="links"/);
 assert.match(seo,/\['\/mentions-legales','\/conditions-generales','\/confidentialite','\/a-propos'\]/);
 assert.match(seo,/renderPage\(page, getOrigin\(req\), services, clientConfig, business, consumerLegal\)/);
 assert.match(css,/about-legal-detail>summary:focus-visible/);
});
test('Independent legal routes remain available to customers',async()=>{
 const routes=JSON.parse(await read('vercel.json')).routes;
 for(const slug of ['mentions-legales','conditions-generales','confidentialite','cookies',
   'pieces-economie-circulaire','retractation']){
   assert.ok(routes.some(x=>x.src==='/'+slug),slug);
 }
});
