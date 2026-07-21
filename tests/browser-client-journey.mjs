import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import appHandler from '../api/app.js';

const port = 4180;
let html = '';
appHandler({ method: 'GET' }, {
  setHeader() {},
  status() { return this; },
  send(body) { html = body; return this; },
  end() { return this; }
});
if (!html.includes('client-account-safe.js?v=12')) throw new Error('Preview asset mismatch');

const server = createServer(async (req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  if (path === '/api/submit-request-v2') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, requestId: 'request-e2e-1' }));
    return;
  }
  try {
    const body = await readFile(join(process.cwd(), path.slice(1)));
    res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(message.text());
});

const stub = `
(() => {
  const listeners = [];
  const user = { id:'u1', email:'client@example.test', user_metadata:{ first_name:'Jean', last_name:'Dupont', phone:'0612345678' } };
  let session = null;
  const vehicles = [];
  const requests = [];
  const profile = { id:'u1', first_name:'Jean', last_name:'Dupont', phone:'0612345678', email:user.email };
  function builder(table) {
    let op='select', payload=null;
    const api={
      select(){return api}, eq(){return api}, order(){return Promise.resolve(result())},
      single(){const r=result();return Promise.resolve({data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error})},
      maybeSingle(){const r=result();return Promise.resolve({data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error})},
      upsert(v){op='upsert';payload=v;return api}, insert(v){op='insert';payload=v;return api}, update(v){op='update';payload=v;return api},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}
    };
    function result(){
      if(table==='profiles') return {data:[profile],error:null};
      if(table==='vehicles'){
        if(op==='upsert'){const row={id:'v1',...payload};vehicles.splice(0,vehicles.length,row);return {data:[row],error:null}}
        return {data:vehicles,error:null};
      }
      if(table==='service_requests'){
        if(op==='insert'){const row={id:'request-e2e-1',...(Array.isArray(payload)?payload[0]:payload)};requests.splice(0,requests.length,row);return {data:[row],error:null}}
        return {data:requests,error:null};
      }
      if(table==='repairs') return {data:[],error:null};
      return {data:[],error:null};
    }
    return api;
  }
  window.supabase={createClient(){return{
    auth:{
      async getSession(){return {data:{session},error:null}},
      async signInWithOtp(){return {data:{},error:null}},
      async verifyOtp({token}){if(token!=='12345678')return {data:{},error:new Error('invalid token')};session={access_token:'token',user};listeners.forEach(fn=>fn('SIGNED_IN',session));return {data:{session,user},error:null}},
      async signOut(){session=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return {error:null}},
      onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}}}
    },
    from:builder,
    storage:{from(){return{async createSignedUrl(){return {data:{signedUrl:'about:blank'},error:null}}}}}
  }}};
})();`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status:200, contentType:'text/javascript', body:stub }));

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForSelector('#btnOtpSend', { timeout:15000 });

  for (const id of ['home','appointment','account','garage','history','about']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${id}"]`);
    const expected = id === 'account' ? 'appointment' : id;
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), expected);
  }

  await page.fill('#lastName','Dupont');
  await page.fill('#firstName','Jean');
  await page.fill('#phone','0612345678');
  await page.fill('#email','client@example.test');
  await page.click('#btnOtpSend');
  await page.fill('#otpCode','12345678');
  await page.click('#btnOtpVerify');
  await page.waitForFunction(() => state?.user?.id === 'u1');

  await page.fill('#plate','AA123BC');
  await page.fill('#mileage','145000');
  await page.fill('#brand','PEUGEOT');
  await page.fill('#model','308');
  await page.fill('#year','2020');
  await page.fill('#energy','Essence');
  await page.click('#btnSaveVehicle');
  await page.click('#btnAccessServices');
  await page.waitForSelector('#servicesArea:not(.hidden)');

  for (const filter of ['all','Freinage','Train avant']) await page.click(`[data-filter="${filter}"]`);
  await page.click('[data-filter="all"]');
  await page.click('[data-more]');
  await page.click('#comboExplainBtn');
  await page.click('[data-select-pack="freinage"]');
  for (const basket of ['eco','standard','premium']) await page.click(`[data-basket="${basket}"]`);
  await page.click('#j7Accepted');
  await page.click('#refuseControl');
  await page.fill('#clientNotes','Bruit au freinage');
  await page.click('#btnSubmit');
  await page.waitForFunction(() => document.querySelector('#submitStatus')?.textContent.includes('Demande transmise'));

  for (const id of ['account','garage','history']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${id}"]`);
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  await page.click('#openMenu');
  await page.click('[data-page="account"]');
  await page.click('#accountSignOutBtn');
  await page.waitForFunction(() => !state?.user?.id);

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('public Preview buttons ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
