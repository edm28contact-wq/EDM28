import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import policy from '../supplier-basket-policy.js';
import cards from '../quote-product-cards.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const sample={
  name:'Disques de frein avant', brand:'Fabricant', reference:'SKU-EXACT-701',
  quantity:2, photo_url:'https://edm28.fr/images/part.jpg',
  merchants:[
    {name:'Vendeur A',url:'https://supplier.example/product?ref=701',price_ttc:45.29},
    {name:'Vendeur B',url:'https://other.example/item/701',price_ttc:null}
  ]
};
test('product cards preserve exact SKU, 2 independent merchant URLs and optional indicative price',()=>{
 const normalized=cards.normalize([sample]);
 assert.deepEqual(normalized[0],sample);
 const summary=cards.summary(normalized);
 assert.match(summary.references,/SKU-EXACT-701/);
 assert.match(summary.prices,/45\.29 EUR TTC/);
 assert.equal(summary.firstUrl,sample.merchants[0].url);
 const productBasket=policy.basket({requires_parts:true,supplier_url:summary.firstUrl,
   recommended_parts:summary.references,product_cards:normalized},true);
 assert.equal(productBasket.product_cards[0].merchants.length,2);
 assert.equal(productBasket.product_cards[0].quantity,2);
});
test('invalid merchant links, missing SKU and suspicious image URLs are rejected',()=>{
 for(const change of [
   {reference:''},
   {quantity:0},
   {photo_url:'javascript:alert(1)'},
   {photo_url:'http://supplier.example/image.png'},
   {merchants:[{name:'Vendeur A',url:'https://user:password@supplier.example/',price_ttc:2}]},
   {merchants:[{name:'X',url:'javascript:alert(1)',price_ttc:10}]},
   {merchants:[{name:'X',url:'https://valid.example',price_ttc:-1}]},
   {merchants:[]}
 ])assert.throws(()=>cards.normalize([{...sample,...change}]));
 assert.throws(()=>cards.normalize(Array.from({length:13},()=>sample)));
});
test('structured product cards never become paid items in EDM28 quote',()=>{
 const parts=policy.basket({
   requires_parts:true,supplier_url:sample.merchants[0].url,
   recommended_parts:'Disques avant SKU-EXACT-701 x2',product_cards:[sample]
 },true);
 assert.equal(Object.hasOwn(parts,'purchase_total'),false);
 const email=policy.quoteMessage({quote:{id:'abc',total:99,valid_until:'2030-01-01'},
   basket:parts,clientName:'Client test'});
 assert.match(email,/SKU-EXACT-701/);
 assert.match(email,/supplier\.example\/product/);
 assert.match(email,/other\.example\/item/);
 assert.match(email,/45\.29 EUR/);
 assert.match(email,/Montant des prestations.*99/);
});
test('PDF annex includes merchant links for new quotes and old quote format remains readable',async()=>{
 const context={window:{},Blob,Uint8Array,TextEncoder,atob:s=>Buffer.from(s,'base64').toString('binary')};
 vm.runInNewContext(await read('pdf-lite.js'),context);
 const row={
   id:'test',quote_number:'D-100',commercial_model:'customer_supplied_v1',
   total:99,subtotal:99,discount:0,quote_parts_baskets: {
     requires_parts:true,supplier_url:sample.merchants[0].url,
     recommended_parts:'SKU-EXACT-701 x2',product_cards:[sample]
   },
   profiles:{first_name:'Client',last_name:'Test'},
   quote_items:[{item_type:'labor',designation:'Freinage',quantity:1,unit_price:99,total:99,vat_rate:0}]
 };
 const pdf=context.window.EDMPdfLite.buildDocument('quote',{cfg:{business_name:'EDM28'},row});
 const text=[...Buffer.from(await pdf.arrayBuffer()).toString('latin1').matchAll(/<([0-9A-F]+)> Tj/g)]
   .map(x=>Buffer.from(x[1],'hex').toString('latin1')).join('\n');
 assert.match(text,/SKU-EXACT-701/);
 assert.match(text,/supplier\.example\/product/);
 assert.match(text,/other\.example\/item/);
});
test('quote, merchant recommendations and customer view share the same stored basket',async()=>{
 const [admin,journey,mail,html]=await Promise.all([
   read('admin-supplier-basket.js'),read('client-journey.js'),
   read('lib/send-notification.js'),read('admin.html')
 ]);
 assert.match(admin,/product_cards:cards/);
 assert.match(admin,/summary\(cards\)/);
 assert.match(journey,/product_cards/);
 assert.match(journey,/Pièces à acheter/);
 assert.match(journey,/referrerpolicy="no-referrer"/);
 assert.match(mail,/product_cards/);
 assert.ok(html.indexOf('/quote-product-cards.js')<html.indexOf('/admin-supplier-basket.js'));
});
