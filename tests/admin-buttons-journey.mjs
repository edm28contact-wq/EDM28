import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = 4193;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req,res) => {
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  try {
    const file = path === '/' ? 'admin.html' : path.slice(1);
    const body = await readFile(join(process.cwd(), file));
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(port,'127.0.0.1',resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1440, height:1000 }, acceptDownloads:true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('dialog', async (dialog) => dialog.dismiss());

const stub = `
(() => {
  const user={id:'admin-1',email:'admin@example.test'};
  const session={access_token:'admin-token',user};
  const profile={id:user.id,role:'admin',first_name:'Admin',last_name:'EDM',email:user.email,phone:'0600000000',external_client_id:'CLI-1',created_at:new Date().toISOString()};
  const business={id:true,business_name:'EDM',legal_name:'EDM',siret:'12345678901234',siren:'123456789',vat_status:'franchise',address_line1:'1 rue Test',postal_code:'75000',city:'Paris',country:'France',phone:'0600000000',email:'admin@example.test',payment_terms:'30 jours',late_penalty_text:'Taux legal',recovery_fee_text:'40 EUR',logo_url:'https://example.test/logo.svg',calendar_id:'primary',timezone:'Europe/Paris'};
  function rows(table){
    if(table==='profiles') return [profile];
    if(table==='business_configuration') return [business];
    if(table==='site_services') return [{id:'svc-1',name:'Freinage',category:'Freinage',labor_price:69,duration_minutes:60,client_description:'Test',active:true,published_at:new Date().toISOString(),online_booking_enabled:true,display_order:10,pricing_type:'fixed'}];
    return [];
  }
  function builder(table){
    let head=false;
    const api={
      select(_columns,options){head=Boolean(options?.head);return api}, eq(){return api}, is(){return api}, in(){return api}, not(){return api}, or(){return api}, limit(){return api}, order(){return Promise.resolve(result())},
      insert(){return Promise.resolve({data:[],error:null})}, upsert(){return Promise.resolve({data:[],error:null})}, update(){return api}, delete(){return api},
      single(){const list=rows(table);return Promise.resolve({data:list[0]||null,error:null})}, maybeSingle(){const list=rows(table);return Promise.resolve({data:list[0]||null,error:null})},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}
    };
    function result(){const data=rows(table);return head?{data:null,count:data.length,error:null}:{data,error:null,count:data.length}}
    return api;
  }
  window.supabase={createClient(){return{
    auth:{async getSession(){return {data:{session},error:null}},async signInWithOtp(){return {data:{},error:null}},async verifyOtp(){return {data:{user,session},error:null}},async signOut(){return {error:null}}},
    from:builder,
    storage:{from(){return{async upload(){return {data:{path:'test'},error:null}},async createSignedUrl(){return {data:{signedUrl:'about:blank'},error:null}}}}}
  }}};
})();`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({status:200,contentType:'text/javascript',body:stub}));

try {
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)', {timeout:15000});

  const pages=['overview','requests','quotes','clients','services','documents','accounting','business','settings'];
  for (const id of pages) {
    await page.click(`[data-page="${id}"]`);
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  const safeIds=['requestRefresh','quoteRefresh','clientSearchBtn','newServiceBtn','createDraftBtn','accountingExport','saveBusinessBtn','saveAutomationBtn'];
  for (const id of safeIds) {
    const button=page.locator(`#${id}`);
    if (await button.count() && await button.isVisible() && await button.isEnabled()) {
      await button.click();
      await page.waitForTimeout(100);
    }
  }

  if (await page.locator('#cancelServiceBtn').count()) await page.click('#cancelServiceBtn');
  await page.click('[data-page="clients"]');
  if (await page.locator('[data-client]').count()) await page.locator('[data-client]').first().click();
  await page.click('[data-page="services"]');
  if (await page.locator('[data-service]').count()) {
    await page.locator('[data-service]').first().click();
    if (await page.locator('#cancelServiceBtn').count()) await page.click('#cancelServiceBtn');
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('admin safe buttons ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
