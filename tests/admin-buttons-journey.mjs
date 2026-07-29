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
const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, acceptDownloads:true, serviceWorkers:'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('dialog', async (dialog) => dialog.dismiss());

const stub = `
(() => {
  const user={id:'admin-1',email:'admin@example.test'};
  let session=null;
  const profile={id:user.id,role:'admin',first_name:'Admin',last_name:'EDM',email:user.email,phone:'0600000000',external_client_id:'CLI-1',created_at:new Date().toISOString()};
  const business={id:true,business_name:'EDM',legal_name:'EDM',siret:'12345678901234',siren:'123456789',vat_status:'franchise',address_line1:'1 rue Test',postal_code:'75000',city:'Paris',country:'France',phone:'0600000000',email:'admin@example.test',payment_terms:'30 jours',late_penalty_text:'Taux legal',recovery_fee_text:'40 EUR',logo_url:'https://example.test/logo.svg',calendar_id:'primary',booking_url:'https://example.test/booking',timezone:'Europe/Paris'};
  const automation={id:true,automations_enabled:false,request_ack_enabled:false,quote_reminder_enabled:false,appointment_reminder_enabled:false,invoice_reminder_enabled:false,quote_reminder_days:5,appointment_reminder_hours:24,invoice_reminder_days:7};
  const hours=Array.from({length:7},(_,weekday)=>({weekday,is_open:weekday<5,morning_start:weekday<5?'08:00:00':null,morning_end:weekday<5?'12:00:00':null,afternoon_start:weekday<5?'13:30:00':null,afternoon_end:weekday<5?'18:00:00':null}));
  function rows(table){
    if(table==='profiles') return [profile];
    if(table==='business_configuration') return [business];
    if(table==='automation_settings') return [automation];
    if(table==='business_hours') return hours;
    if(table==='site_services') return [{id:'svc-1',name:'Freinage',category:'Freinage',labor_price:69,duration_minutes:60,client_description:'Test',active:true,published_at:new Date().toISOString(),online_booking_enabled:true,display_order:10,pricing_type:'fixed'}];
    return [];
  }
  function builder(table){
    let head=false;
    const api={
      select(_columns,options){head=Boolean(options?.head);return api}, eq(){return api}, is(){return api}, in(){return api}, not(){return api}, or(){return api}, limit(){return api}, order(){return api},
      gte(){return api}, lte(){return api}, gt(){return api}, lt(){return api}, neq(){return api}, contains(){return api}, match(){return api},
      insert(){return api}, upsert(){return api}, update(){return api}, delete(){return api},
      single(){const list=rows(table);return Promise.resolve({data:list[0]||null,error:null})}, maybeSingle(){const list=rows(table);return Promise.resolve({data:list[0]||null,error:null})},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}
    };
    function result(){const data=rows(table);return head?{data:null,count:data.length,error:null}:{data,error:null,count:data.length}}
    return api;
  }
  window.supabase={createClient(){return{
    auth:{
      async getSession(){return {data:{session},error:null}},
      async setSession(){return {data:{session},error:null}},
      async signInWithOtp(){return {data:{},error:null}},
      async verifyOtp(){session={access_token:'admin-token',refresh_token:'admin-refresh',user};return {data:{user,session},error:null}},
      async signOut(){session=null;return {error:null}}
    },
    from:builder,
    async rpc(name){return {data:name==='next_document_number'?'TEST-001':null,error:null}},
    storage:{from(){return{
      async upload(){return {data:{path:'test'},error:null}},
      async createSignedUrl(){return {data:{signedUrl:'about:blank'},error:null}},
      async remove(){return {data:{},error:null}},
      async list(){return {data:[],error:null}}
    }}}
  }}};
})();`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({status:200,contentType:'text/javascript',body:stub}));

try {
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#adminOtpSend', {timeout:15000});

  const remember = page.locator('#rememberAdmin');
  if (await remember.count()) {
    await remember.uncheck();
    if (await page.evaluate(() => localStorage.getItem('edm_admin_remember')) !== '0') throw new Error('Admin remember-off preference was not saved.');
    await remember.check();
    if (await page.evaluate(() => localStorage.getItem('edm_admin_remember')) !== '1') throw new Error('Admin remember-on preference was not saved.');
  } else throw new Error('Admin remember-me control is missing.');

  await page.fill('#adminEmail','admin@example.test');
  await page.click('#adminOtpSend');
  await page.waitForSelector('#adminOtpPanel:not(.hidden)');
  await page.fill('#adminOtpCode','12345678');
  await page.click('#adminOtpVerify');
  await page.waitForSelector('#dashboard:not(.hidden)', {timeout:15000});
  await page.waitForSelector('[data-page="planning"]', {timeout:5000});
  await page.waitForSelector('[data-page="messages"]', {timeout:5000});

  const pages=['overview','requests','quotes','operations','planning','interventions','finalization','invoice-actions','notifications','clients','messages','services','documents','document-pdf','accounting','business','settings','audit-log'];
  for (const id of pages) {
    const nav=page.locator(`[data-page="${id}"]`);
    if (!(await nav.count())) throw new Error(`Missing back-office navigation button: ${id}`);
    await nav.click();
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  const safeIds=[
    'requestRefresh','quoteRefresh','operationRefresh','planningPrev','planningToday','planningNext','planningRefresh',
    'businessHoursRefresh','businessHoursSave','exceptionAdd','interventionRefresh','finalizationRefresh','invoiceActionRefresh',
    'notificationRefresh','adminMessageRefresh','clientSearchBtn','newServiceBtn','createDraftBtn','documentPdfRefresh',
    'accountingExport','saveBusinessBtn','saveAutomationBtn','auditLogRefresh'
  ];
  for (const id of safeIds) {
    const button=page.locator(`#${id}`);
    if (!(await button.count())) throw new Error(`Missing back-office control: ${id}`);
    if (await button.isVisible() && await button.isEnabled()) {
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

  const technicalStatusErrors = await page.locator('.status.error').allTextContents();
  const technicalFailures = technicalStatusErrors.filter((text) => /is not a function|undefined|module indisponible|cannot read/i.test(text));
  if (technicalFailures.length) errors.push(...technicalFailures);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('complete back-office navigation, persistence and safe controls ok');
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
