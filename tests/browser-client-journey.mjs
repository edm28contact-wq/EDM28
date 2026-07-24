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
if (!html.includes('client-account-safe.js?v=13')) throw new Error('Preview account asset mismatch');
if (!html.includes('request-history.js?v=2')) throw new Error('Preview history asset mismatch');
if (!html.includes('client-simple-flow.js?v=8')) throw new Error('Preview password flow asset mismatch');

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
  let confirmed = false;
  let accountPassword = '';
  const vehicles = [];
  const requests = [];
  const profile = { id:'u1', first_name:'Jean', last_name:'Dupont', phone:'0612345678', email:user.email };

  function emit(event) {
    listeners.forEach((listener) => listener(event, session));
  }

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
        if(op==='insert'){
          const row={id:'request-e2e-1',created_at:new Date().toISOString(),submitted_at:new Date().toISOString(),...(Array.isArray(payload)?payload[0]:payload)};
          requests.splice(0,requests.length,row);
          return {data:[row],error:null};
        }
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
      async signUp({email,password,options}){
        if(email!==user.email)return {data:{user:null,session:null},error:new Error('unexpected email')};
        accountPassword=password;
        user.user_metadata={...user.user_metadata,...(options?.data||{})};
        return {data:{user,session:null},error:null};
      },
      async verifyOtp({email,token,type}){
        if(email!==user.email || token!=='12345678' || !['email','signup','recovery'].includes(type)){
          return {data:{user:null,session:null},error:new Error('invalid token')};
        }
        confirmed=true;
        session={access_token:'token',user};
        emit('SIGNED_IN');
        return {data:{session,user},error:null};
      },
      async signInWithPassword({email,password}){
        if(!confirmed || email!==user.email || password!==accountPassword){
          return {data:{user:null,session:null},error:new Error('Invalid login credentials')};
        }
        session={access_token:'token',user};
        emit('SIGNED_IN');
        return {data:{session,user},error:null};
      },
      async signInWithOtp(){return {data:{},error:null}},
      async resend(){return {data:{},error:null}},
      async updateUser({password}){accountPassword=password;return {data:{user},error:null}},
      async signOut(){session=null;emit('SIGNED_OUT');return {error:null}},
      onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}}}
    },
    from:builder,
    storage:{from(){return{async createSignedUrl(){return {data:{signedUrl:'about:blank'},error:null}}}}}
  }}};
})();`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status:200, contentType:'text/javascript', body:stub }));

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForFunction(() => window.__edmPasswordAuthReady === true);
  await page.waitForSelector('#btnSignUp', { timeout:15000 });

  const privatePages = new Set(['account','garage','history']);
  for (const id of ['home','appointment','account','garage','history','about']) {
    await page.click('#openMenu');
    await page.click(`[data-page="${id}"]`);
    const expected = privatePages.has(id) ? 'appointment' : id;
    await page.waitForFunction((pageId) => document.getElementById(pageId)?.classList.contains('active'), expected);
  }

  await page.fill('#lastName','Dupont');
  await page.fill('#firstName','Jean');
  await page.fill('#phone','0612345678');
  await page.fill('#email','client@example.test');
  await page.fill('#password','MotDePasse-test-2026');
  await page.fill('#passwordConfirm','MotDePasse-test-2026');
  await page.click('#btnSignUp');
  await page.waitForSelector('#passwordVerificationPanel:not(.hidden)');
  await page.fill('#passwordVerificationCode','12345678');
  await page.click('#btnPasswordVerify');
  await page.waitForFunction(() => state?.user?.id === 'u1');

  await page.click('#btnSignOut');
  await page.waitForFunction(() => !state?.user?.id);
  await page.fill('#email','client@example.test');
  await page.fill('#password','MotDePasse-test-2026');
  await page.click('#btnSignIn');
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
  await page.waitForFunction(() => window.__edmComboSuspended === true);

  for (const filter of ['all','Freinage','Train avant']) await page.click(`[data-filter="${filter}"]`);
  await page.click('[data-filter="all"]');
  await page.click('[data-more]');

  const comboPolicy = await page.evaluate(() => ({
    disabled: document.getElementById('comboExplainBtn')?.disabled,
    text: document.getElementById('comboExplainBtn')?.textContent,
    policy: document.documentElement.dataset.comboPolicy
  }));
  if (!comboPolicy.disabled || comboPolicy.policy !== 'suspended' || !comboPolicy.text?.includes('suspendue')) {
    throw new Error(`Combo policy not suspended: ${JSON.stringify(comboPolicy)}`);
  }

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

  await page.waitForSelector('#historyList [data-service-request-id="request-e2e-1"]', { timeout:5000 });
  const historyText = await page.locator('#historyList [data-service-request-id="request-e2e-1"]').textContent();
  if (!historyText?.includes('AA-123-BC') || (!historyText.includes('Transmise') && !historyText.includes('Enregistrée'))) {
    throw new Error(`Submitted request is missing from history: ${historyText}`);
  }

  await page.click('#openMenu');
  await page.click('[data-page="account"]');
  await page.click('#accountSignOutBtn');
  await page.waitForFunction(() => !state?.user?.id);

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('password signup, one-time verification, password login, buttons and history ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
