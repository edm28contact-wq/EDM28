import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4180',out='journey-browser-artifacts';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();const report={checks:[],realEmails:0,realBusinessWrites:0};
function fixture(){
 const uid='11111111-1111-4111-8111-111111111111',qid='22222222-2222-4222-8222-222222222222',vid='12121212-1212-4212-8212-121212121212',rid='77777777-7777-4777-8777-777777777777',oid='88888888-8888-4888-8888-888888888888';
 const q={id:qid,user_id:uid,vehicle_id:vid,status:'sent',visible_to_client:true,commercial_model:'customer_supplied_v1',quote_number:'TEST-99',title:'Freinage avant',subtotal:99,total:99,discount:0,valid_until:'2099-12-31',created_at:new Date().toISOString(),pdf_path:uid+'/quote/test.pdf',quote_parts_baskets:{requires_parts:true,supplier_url:'https://supplier.example/panier',recommended_parts:'REF-123 x 2\nREF-456 x 1',price_details:'REF-123 : 25 EUR TTC x 2',price_observed_at:'2026-09-01'}};
 const f={uid,q,rows:{quotes:[q],vehicles:[{id:vid,user_id:uid,plate:'AA-123-BB',brand:'Renault',model:'Clio',created_at:new Date().toISOString()},{id:'98989898-9898-4989-8989-989898989898',user_id:uid,plate:'CC-456-DD',brand:'Peugeot',model:'208',created_at:new Date().toISOString()}],profiles:[{id:uid,email:'client@example.test',role:'customer'}],service_requests:[],appointments:[],repair_orders:[],invoices:[],inspection_reports:[],interventions:[],booking_reservations:[],site_services:[{id:'service-1',name:'Freinage avant',slug:'disques-plaquettes-avant',displayed_price:99,labor_price:99,duration_minutes:60,client_description:'Prestation avec consommables',active:true,published_at:'2026-01-01'}]},calls:[],listeners:[],logged:localStorage.getItem('journey-test-login')==='yes'};
 f.user={id:uid,email:'client@example.test',email_confirmed_at:'2026-01-01'};
 f.emit=()=>f.listeners.forEach(fn=>fn('SIGNED_IN',f.logged?{user:f.user,access_token:'fixture-only'}:null));
 f.makeHold=()=>{const r={id:rid,user_id:uid,vehicle_id:vid,quote_id:qid,status:'held',created_at:new Date().toISOString(),starts_at:new Date(Date.now()+10*86400000).toISOString(),ends_at:new Date(Date.now()+10*86400000+3600000).toISOString(),expires_at:new Date(Date.now()+48*3600000).toISOString()};f.rows.booking_reservations=[r];return r;};
 f.db={auth:{getSession:async()=>({data:{session:f.logged?{user:f.user,access_token:'fixture-only'}:null},error:null}),onAuthStateChange:fn=>{f.listeners.push(fn);return{data:{subscription:{unsubscribe(){}}}};},signUp:async(args)=>{f.calls.push('auth:signup');f.signup=args;return{data:{user:f.user,session:null},error:null};},signInWithPassword:async()=>{if(f.loginError)return{data:{session:null},error:{message:'Identifiants incorrects.'}};f.logged=true;localStorage.setItem('journey-test-login','yes');f.emit();return{data:{session:{user:f.user,access_token:'fixture-only'}},error:null};},signOut:async()=>{f.logged=false;localStorage.removeItem('journey-test-login');f.emit();return{error:null};}},
 from(table){const filters=[];let mutation=null;const b={};for(const method of ['select','order','limit','not'])b[method]=()=>b;b.eq=(k,v)=>{filters.push(row=>row[k]===v);return b;};b.in=(k,v)=>{filters.push(row=>v.includes(row[k]));return b;};b.neq=(k,v)=>{filters.push(row=>row[k]!==v);return b;};for(const method of ['insert','upsert','update'])b[method]=value=>{mutation={method,value};return b;};
 const rows=()=>{
  if(mutation){f.calls.push(table+':'+mutation.method);if(mutation.method==='update'){for(const row of f.rows[table]||[])if(filters.every(fn=>fn(row)))Object.assign(row,mutation.value);}else{const record={id:table==='vehicles'?vid:'55555555-5555-4555-8555-555555555555',...mutation.value};if(table==='vehicles')return[record];f.rows[table]=[...(f.rows[table]||[]),record];return[record];}}
  const data=(f.rows[table]||[]).filter(row=>filters.every(fn=>fn(row)));
  if(table==='booking_reservations')return data.map(row=>({...row,profiles:{email:f.user.email},vehicles:{plate:'AA-123-BB'},quotes:f.q}));return data;
 };b.then=(resolve,reject)=>Promise.resolve({data:rows(),error:null}).then(resolve,reject);b.single=b.maybeSingle=async()=>({data:rows()[0]||null,error:null});return b;},
 storage:{from:bucket=>({upload:async(path)=>{f.calls.push('upload:'+bucket);return{data:{path},error:null};},createSignedUrl:async(path)=>({data:{signedUrl:location.origin+'/fixture-document.pdf?path='+encodeURIComponent(path)},error:null})})},
 async rpc(name,args){f.calls.push(name);let data=null;
  if(name==='client_respond_quote'){q.status=args.p_response;data=q.status;}
  if(name==='get_reservation_slots')data=[{starts_at:new Date(Date.now()+10*86400000).toISOString(),ends_at:new Date(Date.now()+10*86400000+3600000).toISOString()}];
  if(name==='reserve_quote_slot')data=f.makeHold().id;
  if(name==='submit_reservation_proof')Object.assign(f.rows.booking_reservations[0],{status:'review_pending',proof_path:args.p_path,proof_received_at:new Date().toISOString(),review_deadline:new Date(Date.now()+86400000).toISOString()});
  if(name==='admin_prepare_reservation'){f.rows.repair_orders=[{id:oid,user_id:uid,vehicle_id:vid,quote_id:qid,status:'ready',visible_to_client:false,created_at:new Date().toISOString()}];data=oid;}
  if(name==='admin_confirm_reservation'){f.rows.booking_reservations[0].status='confirmed';Object.assign(f.rows.repair_orders[0],{visible_to_client:true,pdf_path:args.p_pdf_path});}
  return{data,error:null};}
 };window.__journey=f;window.supabase={createClient:()=>f.db};
}
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.addInitScript(fixture);
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'/* isolated auth fixture */'});
   if(url.hostname.endsWith('.supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
   if(url.origin===origin&&url.pathname==='/api/submit-request-v2'&&req.method()==='POST')return route.fulfill({contentType:'application/json',body:'{"success":true,"emailSent":true}'});
   if(url.origin!==origin||!['GET','HEAD'].includes(req.method()))return route.abort('blockedbyclient');return route.continue();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin+'/mes-interventions?devis=22222222-2222-4222-8222-222222222222',{waitUntil:'networkidle'});
  await page.waitForURL('**/demande?**');assert.equal(await page.locator('[data-client-only]:visible').count(),0);
  await page.locator('#requestAuthEmail').waitFor({state:'visible'});
  await page.locator('#requestAuthEmail').fill('client@example.test');await page.locator('#requestAuthPassword').fill('fixture-password');await page.locator('[data-auth-signin]').click();
  await page.waitForURL('**/mes-interventions?devis=22222222-2222-4222-8222-222222222222');
  await page.evaluate(()=>localStorage.removeItem('journey-test-login'));
  await page.goto(origin+'/demande',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.hero [data-request-cta]').innerText(),'Me connecter');assert.equal(await page.locator('#requestSubmit').isDisabled(),true);
  await page.locator('#requestSignupAuthEmail').waitFor({state:'visible'});
  assert.equal(await page.locator('#connexion').isVisible(),false);
  assert.ok(await page.locator('#requestServices').evaluate(el=>!!(el.compareDocumentPosition(document.getElementById('requestAccountStep'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  assert.deepEqual(await page.locator('#edmRequestApp .section-kicker:visible').allTextContents(),['1 \u00b7 V\u00e9hicule','2 \u00b7 Prestation','3 \u00b7 Compte client']);
  await page.locator('#requestPlate').fill('AB-123-CD');await page.locator('#requestBrand').fill('Renault');
  await page.locator('#requestNotes').fill('Bruit au freinage');await page.locator('.service-choice input').first().check();
  await page.screenshot({path:`${out}/guest-request-${width}.png`,fullPage:true});
  await page.locator('#requestSignupAuthEmail').fill('client@example.test');await page.locator('#requestSignupAuthPassword').fill('fixture-password');
  await page.locator('[data-auth-signup="requestSignup"]').click();
  await page.waitForFunction(()=>document.getElementById('requestSignupAuthStatus').textContent.includes('Compte cr\u00e9\u00e9'));
  assert.equal(await page.locator('#requestSubmit').isDisabled(),true);assert.equal(await page.locator('#requestAccountStep').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>__journey.calls),['auth:signup']);
  assert.equal(await page.evaluate(()=>__journey.signup.options.emailRedirectTo),origin+'/');
  await page.evaluate(()=>__journey.emit());
  await page.waitForFunction(()=>document.getElementById('requestSignupAuthStatus').textContent.includes('Compte cr\u00e9\u00e9'));
  assert.equal(await page.locator('#requestSignupAuthEmail').inputValue(),'client@example.test');
  await page.locator('.hero [data-request-cta]').click();await page.locator('#requestAuthEmail').waitFor({state:'visible'});
  await page.locator('#requestAuthEmail').fill('client@example.test');await page.locator('#requestAuthPassword').fill('fixture-password');
  await page.evaluate(()=>__journey.loginError=true);await page.locator('[data-auth-signin]').click();
  await page.waitForFunction(()=>document.getElementById('requestAuthStatus').textContent.includes('Identifiants incorrects'));
  assert.equal(await page.locator('#requestAccountStep').isVisible(),true);assert.equal(await page.locator('#requestSubmit').isDisabled(),true);
  await page.evaluate(()=>__journey.loginError=false);await page.locator('[data-auth-signin]').click();
  await page.locator('#requestAccountStep').waitFor({state:'hidden'});
  assert.equal(await page.locator('[data-auth-signup]').count(),0);
  assert.equal(await page.locator('#requestPlate').inputValue(),'AB-123-CD');assert.equal(await page.locator('#requestBrand').inputValue(),'Renault');
  assert.equal(await page.locator('#requestNotes').inputValue(),'Bruit au freinage');assert.equal(await page.locator('.service-choice input:checked').count(),1);
  assert.equal((await page.evaluate(()=>__journey.calls)).includes('service_requests:insert'),false);
  await page.reload({waitUntil:'networkidle'});await page.locator('#requestVehiclePicker').waitFor({state:'visible'});
  assert.equal(await page.locator('#requestAccountStep').isVisible(),false);assert.equal(await page.locator('[data-auth-signup]').count(),0);
  await page.locator('#requestSignOut').click();await page.locator('#requestSignupAuthEmail').waitFor({state:'visible'});
  assert.equal(await page.locator('#requestSubmit').isDisabled(),true);assert.equal(await page.locator('#requestVehiclePicker').isVisible(),false);
  await page.locator('#requestAccountStep a[href="#connexion"]').click();
  await page.locator('#requestAuthEmail').fill('client@example.test');await page.locator('#requestAuthPassword').fill('fixture-password');await page.locator('[data-auth-signin]').click();
  await page.locator('#requestVehiclePicker').waitFor({state:'visible'});await page.locator('#requestVehicleSelect option[value="12121212-1212-4212-8212-121212121212"]').waitFor({state:'attached'});
  await page.locator('#requestVehicleSearch').fill('Renault');assert.equal(await page.locator('#requestVehicleSelect option').count(),2);
  await page.locator('#requestVehicleSelect').selectOption('12121212-1212-4212-8212-121212121212');assert.equal(await page.locator('#requestPlate').inputValue(),'AA-123-BB');
  await page.locator('.service-choice input').first().check();assert.equal(await page.locator('.service-choice.is-selected').count(),1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.service-choice.is-selected')).backgroundColor==='rgba(235, 136, 62, 0.13)');
  await page.screenshot({path:`${out}/request-${width}.png`,fullPage:true});
  await page.locator('#requestPlate').fill('');await page.locator('#requestSubmit').click();assert.equal((await page.evaluate(()=>__journey.calls)).includes('service_requests:insert'),false);
  await page.locator('#requestPlate').fill('AA-123-BB');for(const field of ['requestBrand','requestModel','requestYear','requestEnergy','requestMileage','requestFirstName','requestLastName','requestPhone'])await page.locator('#'+field).fill('');
  await page.locator('#requestSubmit').click();await page.waitForFunction(()=>document.getElementById('requestSubmit').dataset.sent==='true');
  assert.equal((await page.evaluate(()=>__journey.calls)).filter(x=>x==='service_requests:insert').length,1);
  report.checks.push(`guest vehicle/prestation/signup, email confirmation pending, login failure/success, draft preservation, signed-in reload, logout, vehicle filter and plate-only request ${width}: PASS`);

  await page.goto(origin+'/mes-interventions?devis=22222222-2222-4222-8222-222222222222&action=accepter',{waitUntil:'networkidle'});
  await page.locator('[data-response="accepted"]').waitFor();assert.equal(await page.evaluate(()=>__journey.q.status),'sent');
  await page.locator('[data-response="refused"]').click();await page.getByRole('link',{name:'\u00c9crire \u00e0 EDM28'}).waitFor();assert.match(await page.getByRole('link',{name:'\u00c9crire \u00e0 EDM28'}).getAttribute('href'),/^mailto:contact@edm28.fr/);
  await page.evaluate(()=>{__journey.q.status='sent';__journey.emit();});await page.locator('[data-response="accepted"]').click();
  await page.locator('[data-planning]').click();await page.locator('[data-slot]').first().click();await page.locator('[data-proof-file]').waitFor();
  await page.locator('.basket-details summary').click();assert.match(await page.locator('[data-case]').innerText(),/REF-123/);assert.match(await page.locator('[data-case]').innerText(),/25 EUR/);
  await page.screenshot({path:`${out}/hold-${width}.png`,fullPage:true});
  await page.locator('[data-proof-file]').setInputFiles({name:'purchase.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 isolated test proof')});
  await page.locator('[data-proof-submit]').click();await page.waitForFunction(()=>__journey.rows.booking_reservations[0].status==='review_pending');
  await page.waitForFunction(()=>document.getElementById('edmInterventionsApp').textContent.includes('Justificatif re\u00e7u'));
  assert.equal(await page.locator('[data-proof-submit]').count(),0);
  await page.evaluate(()=>{const f=__journey;f.rows.booking_reservations[0].status='confirmed';f.rows.repair_orders=[{id:'88888888-8888-4888-8888-888888888888',user_id:f.uid,vehicle_id:f.q.vehicle_id,quote_id:f.q.id,status:'ready',visible_to_client:true,pdf_path:f.uid+'/order/test.pdf',created_at:new Date().toISOString()}];f.emit();});
  await page.waitForFunction(()=>document.getElementById('edmInterventionsApp').textContent.includes('Rendez-vous valid\u00e9'));
  assert.match(await page.locator('[data-case]').innerText(),/Ordre de r\u00e9paration/);
  await page.evaluate(()=>{Object.assign(__journey.rows.repair_orders[0],{status:'completed',completed_at:new Date().toISOString()});__journey.emit();});
  await page.locator('.journey-card.is-green').waitFor();await page.screenshot({path:`${out}/finished-${width}.png`,fullPage:true});
  await page.evaluate(()=>{__journey.rows.repair_orders[0].completed_at=new Date(Date.now()-25*3600000).toISOString();__journey.emit();});
  await page.waitForFunction(()=>document.getElementById('edmInterventionsApp').textContent.includes('Aucune intervention en cours'));
  await page.locator('.vehicle-archive').first().locator('summary').first().click();await page.locator('.intervention-archive summary').first().click();assert.equal(await page.locator('.intervention-archive [data-file]').count(),3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  report.checks.push(`quote response, 48h hold, proof, pending review, confirmation and 24h history ${width}: PASS`);

  await page.goto(origin+'/contact',{waitUntil:'networkidle'});assert.equal(await page.locator('a[href^="tel:000"]').count(),0);assert.equal(await page.locator('.contact-card a[href^="mailto:"]').count(),1);assert.equal(await page.locator('.contact-card a[href*="maps/dir"]').count(),1);await page.screenshot({path:`${out}/contact-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(origin+'/admin-reset',{waitUntil:'networkidle'});await page.setContent(`<html><head><link rel="stylesheet" href="${origin}/admin.css"></head><body><main style="padding:16px"><section id="operations"></section></main></body></html>`);
  await page.evaluate(()=>{const f=__journey;f.q.status='accepted';const r=f.makeHold();r.status='review_pending';r.proof_path=f.uid+'/'+r.id+'/test.pdf';r.review_deadline=new Date(Date.now()+86400000).toISOString();f.calls=[];
   window.EDMAdmin={db:f.db,esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),overview:async()=>{}};
   window.EDMAdminDocumentPdf={generateFor:async()=>{f.calls.push('generateOR');return f.uid+'/order/88888888-8888-4888-8888-888888888888-test.pdf';}};
  });
  await page.addScriptTag({url:origin+'/admin-reservation-review.js'});await page.evaluate(()=>EDMAdminReservations.load());
  await page.locator('[data-review-confirm]').click();assert.equal((await page.evaluate(()=>__journey.calls)).includes('admin_prepare_reservation'),false);
  await page.locator('[data-review-checked]').check();await page.screenshot({path:`${out}/admin-review-${width}.png`,fullPage:true});await page.locator('[data-review-confirm]').click();await page.waitForFunction(()=>__journey.rows.booking_reservations[0].status==='confirmed');
  assert.deepEqual(await page.evaluate(()=>__journey.calls),['admin_prepare_reservation','generateOR','admin_confirm_reservation']);
  assert.deepEqual(errors,[]);report.checks.push(`contact and administrator approval after proof check and OR ${width}: PASS`);
  await context.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
