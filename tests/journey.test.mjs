import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../journey-model.js';
import { renderJourneyEmail, handleJourneyDispatch } from '../lib/journey-mail.js';
import policy from '../supplier-basket-policy.js';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const now=Date.parse('2026-10-10T10:00:00Z');
const id='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(64);
const payload={recipient:'isolated@example.test',kind:'held',quote_id:id,quote_number:'TEST-1',title:'Freinage',starts_at:'2026-10-20T10:00:00Z',expires_at:'2026-10-12T10:00:00Z',review_deadline:'2026-10-13T10:00:00Z',requires_parts:true,supplier_url:'https://supplier.example/basket',recommended_parts:'REF-1 x 2',price_details:'REF-1 : 25 EUR TTC x 2',price_observed_at:'2026-10-10'};

test('a held slot expires exactly at its server deadline',()=>{
 const input={quote:{status:'accepted'},reservation:{status:'held',expires_at:'2026-10-10T10:00:00Z'}};
 assert.equal(model.progress(input,now-1).key,'held');assert.equal(model.progress(input,now).key,'choose');
});
test('a submitted proof does not expire because the administrator is late',()=>{
 const state=model.progress({reservation:{status:'review_pending',review_deadline:'2026-10-09T10:00:00Z'}},now);
 assert.equal(state.key,'review');assert.equal(state.overdue,true);assert.equal(state.archived,false);
});
test('pre-generated OR does not count as appointment approval',()=>{
 const state=model.progress({reservation:{id:'r',status:'review_pending'},order:{id:'o',status:'ready'}},now);assert.equal(state.key,'review');
});
test('finished intervention is green for 24 h then becomes history without deleting documents',()=>{
 const input={order:{id:'o',status:'completed',completed_at:'2026-10-09T10:00:00Z'}};
 assert.equal(model.progress(input,now-1).archived,false);assert.equal(model.progress(input,now).archived,true);assert.equal(model.progress(input,now).tone,'green');
});
test('invoice draft does not decide whether an intervention is complete',()=>{
 assert.equal(model.progress({order:{status:'in_progress'}},now).key,'working');
 assert.equal(model.progress({order:{status:'invoiced',completed_at:'2026-10-10T10:00:00Z'}},now).key,'finished');
});
test('history relates documents and an appointment through the repair order, not just request id',()=>{
 const rows=model.group({requests:[{id:'r',vehicle_id:'v'}],quotes:[{id:'q',service_request_id:'r',title:'Freinage',vehicle_id:'v',created_at:'2026-10-10'}],orders:[{id:'o',quote_id:'q',appointment_id:'a',status:'completed',completed_at:'2026-09-01'}],appointments:[{id:'a',vehicle_id:'v'}],invoices:[{id:'i',repair_order_id:'o',pdf_path:'invoice.pdf'}],inspections:[{id:'p',repair_order_id:'o',pdf_path:'inspection.pdf',photo_paths:['photo.jpg']}]});
 assert.equal(rows.length,1);assert.equal(rows[0].appointments[0].id,'a');assert.equal(rows[0].invoices[0].pdf_path,'invoice.pdf');assert.equal(rows[0].inspections[0].photo_paths[0],'photo.jpg');
});
test('price information stays separate from the prestation total',()=>{
 const b=policy.basket({requires_parts:true,supplier_url:payload.supplier_url,recommended_parts:payload.recommended_parts,price_details:payload.price_details,price_observed_at:payload.price_observed_at},true);
 assert.equal(b.price_details,payload.price_details);
 const text=policy.quoteMessage({quote:{id,total:99,quote_number:'TEST-1'},basket:b});
 assert.match(text,/99/);assert.ok(text.includes(payload.price_details));assert.ok(text.includes('?devis='+id));
});
for(const kind of ['held','proof_received','confirmed','reminder','expired','rejected','completed'])test(`email ${kind} uses a secure account link and clear next action`,()=>{
 const email=renderJourneyEmail({...payload,kind});assert.match(email.text,/Mes interventions/);assert.ok(email.html.includes('?devis='+id));assert.doesNotMatch(email.text,/60\s*%|service_role|sb_secret_/);
});
test('stored content cannot inject HTML or unsafe supplier links',()=>{
 const msg=renderJourneyEmail({...payload,title:'<script>alert(1)</script>',recommended_parts:'<img onerror="bad">'});assert.doesNotMatch(msg.html,/<script>|<img/);assert.match(msg.html,/&lt;script&gt;/);
 assert.throws(()=>renderJourneyEmail({...payload,supplier_url:'javascript:alert(1)'}));
});
async function dispatch(t,options={}){
 const old={VERCEL_ENV:process.env.VERCEL_ENV,RESEND_API_KEY:process.env.RESEND_API_KEY,RESEND_FROM_EMAIL:process.env.RESEND_FROM_EMAIL};
 Object.assign(process.env,{VERCEL_ENV:'preview',RESEND_API_KEY:'re_test_fixture',RESEND_FROM_EMAIL:'EDM28 <test@example.test>'});
 t.after(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const calls=[];t.mock.method(globalThis,'fetch',async(input,init)=>{
  const url=new URL(input),body=JSON.parse(init.body);calls.push({url,body,headers:init.headers});
  if(url.hostname==='api.resend.com')return new Response(JSON.stringify(options.providerError?{message:'not sent'}:{id:'fixture-provider'}),{status:options.providerError?503:200});
  if(url.searchParams.get('status')==='eq.dispatching')return new Response(JSON.stringify(options.denied?[]:[{id,payload}]),{status:200});
  return new Response(null,{status:204});
 });
 const res={statusCode:null,setHeader(){},status(s){this.statusCode=s;return this;},end(v){this.body=JSON.parse(v);}};
 await handleJourneyDispatch({method:options.method||'POST',body:options.body||{id,token}},res);return {res,calls};
}
test('dispatcher refuses a missing capability before any request',async t=>{
 const f=await dispatch(t,{body:{id}});assert.equal(f.res.statusCode,403);assert.equal(f.calls.length,0);
});
test('dispatcher cannot turn an arbitrary recipient into an email',async t=>{
 const f=await dispatch(t,{denied:true,body:{id,token,recipient:'attacker@example.test'}});assert.equal(f.res.statusCode,403);assert.equal(f.calls.length,1);
});
test('dispatcher uses only immutable persisted payload and a stable provider idempotency key',async t=>{
 const f=await dispatch(t,{body:{id,token,recipient:'attacker@example.test'}});assert.equal(f.res.statusCode,200);assert.equal(f.calls.length,3);
 assert.deepEqual(f.calls[1].body.to,[payload.recipient]);assert.equal(f.calls[1].headers['Idempotency-Key'],'edm28-journey-'+id);assert.equal(f.calls[2].body.status,'sent');
});
test('provider error is retriable and never reported as sent',async t=>{
 const f=await dispatch(t,{providerError:true});assert.equal(f.res.statusCode,503);assert.equal(f.calls.at(-1).body.status,'pending');
});
test('GET cannot dispatch, accept a quote, or confirm a booking',async t=>{
 const f=await dispatch(t,{method:'GET'});assert.equal(f.res.statusCode,405);assert.equal(f.calls.length,0);
});
test('contact links and placeholder are intentional; auth appears before the vehicle form',async()=>{
 const [seo,client,journey]=await Promise.all(['public-seo.js','public-client.js','client-journey.js'].map(read));
 assert.match(seo,/mailto:/);assert.match(seo,/maps\/dir\/\?api=1/);assert.doesNotMatch(seo,/tel:0000000000/);
 assert.match(seo,/data-client-only hidden/);assert.ok(client.indexOf('id="requestAccountArea"')<client.indexOf('id="requestPlate"'));
 assert.equal((client.match(/id="requestAccountArea"/g)||[]).length,1);assert.match(client,/id="requestPlate" required/);assert.match(client,/is-selected/);
 assert.match(journey,/location\.replace\(target.href\)/);assert.match(journey,/createSignedUrl\(path,120\)/);
});
