import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:4180';
const output = 'basket-browser-artifacts';
await mkdir(output, {recursive:true});
const browser = await chromium.launch();
const report = {checks:[], realBusinessWrites:0};
function fixtures() {
  const user = {id:'11111111-1111-4111-8111-111111111111',email:'client@example.test'};
  const q = {id:'22222222-2222-4222-8222-222222222222',user_id:user.id,vehicle_id:'vehicle-fixture',status:'sent',visible_to_client:true,commercial_model:'customer_supplied_v1',quote_number:'TEST-099',title:'Prestation freinage',subtotal:99,discount:0,total:99,valid_until:'2099-12-31',created_at:'2026-09-29T12:00:00Z',pdf_path:user.id+'/quote/test.pdf',profiles:{email:user.email},vehicles:{plate:'AA-123-BB'},quote_items:[{item_type:'labor',designation:'Prestation freinage',description:'Consommables inclus',quantity:1,unit_price:99,vat_rate:0}],quote_parts_baskets:{requires_parts:true,supplier_url:'https://supplier.example/basket/client-1',recommended_parts:'REF-123 x 2\nREF-456 x 1',price_details:'REF-123: 25 EUR TTC x 2',price_observed_at:'2026-09-01',revision:'revision-1'}};
  const calls = [];
  const db = {
    auth:{getSession:async()=>({data:{session:{user,access_token:'test-only'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    from(table) {const builder={}; for(const key of ['select','eq','order','in','limit','neq']) builder[key]=()=>builder;
      const rows=()=>table==='quotes'?[q]:table==='vehicles'?[{id:q.vehicle_id,plate:'AA-123-BB',brand:'Vehicule',model:'Test'}]:[];
      builder.then=(resolve,reject)=>Promise.resolve({data:rows(),error:null}).then(resolve,reject);
      builder.single=async()=>({data:q,error:null});return builder;},
    async rpc(name,body){calls.push(name); if(name==='admin_save_service_quote'){q.quote_number='TEST-099';return {data:{revision:'revision-2',quote_number:q.quote_number,total:99},error:null};} if(name==='admin_publish_service_quote')q.status='sent';if(name==='client_respond_quote')q.status=body.p_response;return {data:{id:q.id,status:q.status},error:null};}
  };
  window.__basketFixture={q,calls,db};
  window.EDM_PUBLIC_SUPABASE={url:'https://fixture.supabase.co',key:'sb_publishable_fixture'};
  window.supabase={createClient:()=>db};
}
try {
  for(const width of [320,390,1280]) {
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    await context.addInitScript(fixtures);
    await context.route('**/*',async(route)=>{const req=route.request(),url=new URL(req.url());
      if(url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'/* Supabase replaced by isolated fixture. */'});
      if(url.hostname.endsWith('.supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
      if(url.origin!==origin || !['GET','HEAD'].includes(req.method()))return route.abort('blockedbyclient');
      return route.continue();});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const path of ['/fonctionnement','/tarifs']) {
      const res=await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(res.status(),200);
      const text=await page.locator('body').innerText();assert.doesNotMatch(text,/d[ée]bours|mandat d.achat/i);assert.match(text,/consommables/i);
    }
    await page.goto(origin+'/mes-interventions',{waitUntil:'networkidle'});
    await page.locator('[data-response="accepted"]').waitFor();
    await page.locator('.basket-details summary').click();
    const link=page.getByRole('link',{name:'Ouvrir mon panier fournisseur'});
    assert.equal(await link.getAttribute('href'),'https://supplier.example/basket/client-1');
    assert.match(await page.locator('#edmInterventionsApp').innerText(),/REF-123/);
    assert.doesNotMatch(await page.locator('#edmInterventionsApp').innerText(),/d[ée]bours|60\s*%/i);
    await page.screenshot({path:`${output}/client-${width}.png`,fullPage:true});
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-response="accepted"]').click();
    await page.waitForFunction(()=>window.__basketFixture.q.status==='accepted');
    assert.deepEqual(errors,[]);report.checks.push(`public information and customer basket/acceptance ${width}: PASS`);

    await page.goto(origin+'/admin-reset',{waitUntil:'networkidle'});
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+origin+'/admin.css"></head><body><main style="padding:16px;max-width:1100px;margin:auto"><div id="quoteStatus"></div><div id="quoteList"></div></main></body></html>');
    await page.evaluate(()=>{const f=window.__basketFixture;f.q.status='draft';f.calls.length=0;
      window.EDMAdmin={db:f.db,$:id=>document.getElementById(id),esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money:v=>Number(v).toFixed(2)+' EUR',status:(id,text)=>{document.getElementById(id).textContent=text;},overview:async()=>{}};
      window.EDMAdminDocumentPdf={generateFor:async()=>{f.calls.push('pdf');return f.q.pdf_path;}};
      window.fetch=async()=>{f.calls.push('email');return {ok:true,json:async()=>({success:true})};};});
    for(const script of ['supplier-basket-policy.js','admin-supplier-basket.js','admin-quotes.js','admin-publish-email.js']) await page.addScriptTag({url:origin+'/'+script});
    await page.evaluate(()=>window.EDMAdminQuotes.load());
    assert.deepEqual(await page.locator('[data-line="type"] option').evaluateAll(nodes=>nodes.map(n=>n.value)),['labor','other']);
    await page.locator('[data-field="supplierUrl"]').fill('javascript:alert(1)');
    await page.locator('[data-publish]').click();
    assert.equal(await page.evaluate(()=>window.__basketFixture.calls.length),0);
    await page.locator('[data-field="supplierUrl"]').fill('https://supplier.example/basket/client-1');
    await page.screenshot({path:`${output}/admin-${width}.png`,fullPage:true});
    await page.locator('[data-publish]').click();
    await page.waitForFunction(()=>window.__basketFixture.calls.includes('email'));
    assert.deepEqual(await page.evaluate(()=>window.__basketFixture.calls),['admin_save_service_quote','pdf','admin_publish_service_quote','email']);
    assert.deepEqual(errors,[]);report.checks.push(`admin editor validation and one quote/basket email ${width}: PASS`);
    await context.close();
  }
  report.status='PASS';
} catch(error) {report.status='FAIL';report.error=error.stack;process.exitCode=1;}
finally {await browser.close();await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
