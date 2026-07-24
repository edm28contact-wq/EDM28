import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import appHandler from '../api/app.js';

const port = 4196;
const customerId = '22222222-2222-4222-8222-222222222222';
const adminId = '11111111-1111-4111-8111-111111111111';
let publicHtml = '';

appHandler({ method: 'GET' }, {
  setHeader() {},
  status() { return this; },
  send(body) { publicHtml = body; return this; },
  end() { return this; }
});

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(publicHtml);
    return;
  }
  if (pathname === '/api/ai-message-draft') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      draftId: '33333333-3333-4333-8333-333333333333',
      model: 'gpt-test-message-model',
      requiresHumanApproval: true,
      draft: {
        subject: 'Réponse proposée',
        body: 'Bonjour Jean, votre message est bien reçu. Nous vérifions votre demande avant de vous confirmer la suite.',
        urgency: 'normal',
        requires_human_check: true,
        facts_used: ['Message reçu'],
        warnings: []
      }
    }));
    return;
  }

  try {
    const file = pathname === '/admin.html' || pathname === '/admin' ? 'admin.html' : pathname.slice(1);
    const body = await readFile(join(process.cwd(), file));
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const supabaseStub = `
(() => {
  const isAdminPage = location.pathname.startsWith('/admin');
  const customerId = '${customerId}';
  const adminId = '${adminId}';
  const customerUser = { id:customerId, email:'client@example.test', user_metadata:{ first_name:'Jean', last_name:'Dupont', phone:'0612345678' } };
  const adminUser = { id:adminId, email:'admin@example.test', user_metadata:{ first_name:'Admin', last_name:'EDM' } };
  const session = { access_token:isAdminPage ? 'admin-token' : 'customer-token', user:isAdminPage ? adminUser : customerUser };
  const now = new Date().toISOString();
  const profiles = [
    { id:adminId, role:'admin', first_name:'Admin', last_name:'EDM', email:adminUser.email, phone:'0600000000', created_at:now },
    { id:customerId, role:'customer', first_name:'Jean', last_name:'Dupont', email:customerUser.email, phone:'0612345678', created_at:now }
  ];
  const requests = [{ id:'55555555-5555-4555-8555-555555555555', user_id:customerId, status:'submitted', created_at:now, vehicle_id:null, services:[], totals:{} }];
  const messages = isAdminPage ? [
    { id:'66666666-6666-4666-8666-666666666666', user_id:customerId, service_request_id:null, direction:'inbound', subject:'Question client', body:'Bonjour, pouvez-vous vérifier ma demande ?', channel:'site', visible_to_client:true, read_by_client:true, read_by_admin:false, created_at:now }
  ] : [
    { id:'77777777-7777-4777-8777-777777777777', user_id:customerId, service_request_id:null, direction:'outbound', subject:'Information', body:'Votre demande a bien été reçue.', channel:'site', visible_to_client:true, read_by_client:false, read_by_admin:true, created_at:now }
  ];
  const rpcCalls = [];
  const listeners = [];
  const business = { id:true, business_name:'EDM', legal_name:'EDM', siret:'12345678901234', siren:'123456789', vat_status:'franchise', address_line1:'1 rue Test', postal_code:'75000', city:'Paris', country:'France', phone:'0600000000', email:'admin@example.test', payment_terms:'30 jours', late_penalty_text:'Taux légal', recovery_fee_text:'40 EUR', logo_url:'https://example.test/logo.svg', calendar_id:'primary', timezone:'Europe/Paris' };
  const automation = { id:true, automations_enabled:false, messages_enabled:true, booking_enabled:false, reminders_enabled:false, ai_enabled:true, test_mode:true, test_recipient:'admin@example.test' };

  function tableRows(table) {
    if (table === 'profiles') return profiles;
    if (table === 'client_messages') return messages;
    if (table === 'service_requests') return requests;
    if (table === 'business_configuration') return [business];
    if (table === 'automation_settings') return [automation];
    return [];
  }

  function builder(table) {
    let filters = [];
    let orders = [];
    let max = null;
    let head = false;
    let operation = 'select';
    let payload = null;

    const api = {
      select(_columns, options) { head = Boolean(options?.head); return api; },
      eq(column, value) { filters.push({ type:'eq', column, value }); return api; },
      is(column, value) { filters.push({ type:'is', column, value }); return api; },
      in(column, values) { filters.push({ type:'in', column, values }); return api; },
      not() { return api; },
      or() { return api; },
      gt() { return api; },
      order(column, options = {}) { orders.push({ column, ascending:options.ascending !== false }); return api; },
      limit(value) { max = value; return api; },
      insert(value) { operation = 'insert'; payload = value; return api; },
      upsert(value) { operation = 'upsert'; payload = value; return api; },
      update(value) { operation = 'update'; payload = value; return api; },
      delete() { operation = 'delete'; return api; },
      single() { const result = execute(); return Promise.resolve({ data:Array.isArray(result.data) ? result.data[0] || null : result.data, error:result.error }); },
      maybeSingle() { const result = execute(); return Promise.resolve({ data:Array.isArray(result.data) ? result.data[0] || null : result.data, error:result.error }); },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); }
    };

    function filtered() {
      let rows = tableRows(table).slice();
      for (const filter of filters) {
        if (filter.type === 'eq') rows = rows.filter((row) => row?.[filter.column] === filter.value);
        if (filter.type === 'is') rows = rows.filter((row) => row?.[filter.column] === filter.value);
        if (filter.type === 'in') rows = rows.filter((row) => filter.values.includes(row?.[filter.column]));
      }
      for (const order of orders) {
        rows.sort((a, b) => {
          const comparison = String(a?.[order.column] || '').localeCompare(String(b?.[order.column] || ''));
          return order.ascending ? comparison : -comparison;
        });
      }
      if (Number.isInteger(max)) rows = rows.slice(0, max);
      return rows;
    }

    function execute() {
      if (operation === 'insert' || operation === 'upsert') {
        const values = Array.isArray(payload) ? payload : [payload];
        if (table === 'client_messages') messages.push(...values);
        return { data:values, error:null, count:values.length };
      }
      if (operation === 'update') {
        const rows = filtered();
        rows.forEach((row) => Object.assign(row, payload));
        return { data:rows, error:null, count:rows.length };
      }
      if (operation === 'delete') return { data:[], error:null, count:0 };
      const rows = filtered();
      return head ? { data:null, error:null, count:rows.length } : { data:rows, error:null, count:rows.length };
    }

    return api;
  }

  async function rpc(name, args = {}) {
    rpcCalls.push({ name, args });
    if (name === 'client_mark_messages_read') {
      messages.forEach((message) => { if ((args.p_message_ids || []).includes(message.id)) message.read_by_client = true; });
      return { data:(args.p_message_ids || []).length, error:null };
    }
    if (name === 'client_send_message') {
      messages.push({ id:'88888888-8888-4888-8888-888888888888', user_id:customerId, service_request_id:args.p_service_request_id || null, direction:'inbound', subject:args.p_subject || null, body:args.p_body, channel:'site', visible_to_client:true, read_by_client:true, read_by_admin:false, created_at:new Date().toISOString() });
      return { data:'88888888-8888-4888-8888-888888888888', error:null };
    }
    if (name === 'admin_mark_conversation_read') {
      messages.forEach((message) => { if (message.user_id === args.p_user_id && message.direction === 'inbound') message.read_by_admin = true; });
      return { data:1, error:null };
    }
    if (name === 'admin_send_message') {
      messages.push({ id:'99999999-9999-4999-8999-999999999999', user_id:args.p_user_id, service_request_id:args.p_service_request_id || null, direction:'outbound', subject:args.p_subject || null, body:args.p_body, channel:'site', visible_to_client:true, read_by_client:false, read_by_admin:true, created_at:new Date().toISOString(), ai_draft_id:args.p_ai_draft_id || null });
      return { data:'99999999-9999-4999-8999-999999999999', error:null };
    }
    return { data:null, error:null };
  }

  window.__edmMessagingTest = { messages, rpcCalls };
  window.supabase = { createClient(){ return {
    auth:{
      async getSession(){ return { data:{ session }, error:null }; },
      onAuthStateChange(listener){ listeners.push(listener); return { data:{ subscription:{ unsubscribe(){} } } }; },
      async signOut(){ return { error:null }; },
      async signInWithOtp(){ return { data:{}, error:null }; },
      async verifyOtp(){ return { data:{ user:adminUser, session }, error:null }; }
    },
    from:builder,
    rpc,
    storage:{ from(){ return { async upload(){ return { data:{ path:'test' }, error:null }; }, async createSignedUrl(){ return { data:{ signedUrl:'about:blank' }, error:null }; }, async remove(){ return { data:[], error:null }; } }; } }
  }; } };
})();`;

const browser = await chromium.launch();

async function preparePage(path, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('PWA registration failed')) errors.push(message.text());
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ status:200, contentType:'text/javascript', body:supabaseStub }));
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil:'domcontentloaded', timeout:30000 });
  return { page, errors };
}

try {
  const client = await preparePage('/', { width:1280, height:900 });
  await client.page.waitForFunction(() => window.__edmPasswordAuthReady === true && document.querySelector('[data-page="messages"]'));
  await client.page.click('[data-page="messages"]');
  await client.page.waitForFunction(() => document.getElementById('messages')?.classList.contains('active'));
  await client.page.waitForFunction(() => document.getElementById('clientMessageThread')?.textContent.includes('Votre demande a bien été reçue.'));
  await client.page.waitForFunction(() => window.__edmMessagingTest.rpcCalls.some((call) => call.name === 'client_mark_messages_read'));
  await client.page.fill('#clientMessageSubject', 'Ma question');
  await client.page.fill('#clientMessageBody', 'Je confirme que ma question concerne cette demande.');
  await client.page.click('#clientMessageSend');
  await client.page.waitForFunction(() => document.getElementById('clientMessageThread')?.textContent.includes('Je confirme que ma question concerne cette demande.'));
  const clientCalls = await client.page.evaluate(() => window.__edmMessagingTest.rpcCalls.map((call) => call.name));
  assertIncludes(clientCalls, 'client_send_message', 'client send RPC');
  if (client.errors.length) throw new Error(`Client messaging errors:\n${client.errors.join('\n')}`);
  await client.page.close();

  const admin = await preparePage('/admin.html', { width:1440, height:1000 });
  await admin.page.waitForSelector('#dashboard:not(.hidden)', { timeout:15000 });
  await admin.page.waitForSelector('[data-page="messages"]');
  const markedBeforeOpen = await admin.page.evaluate(() => window.__edmMessagingTest.rpcCalls.some((call) => call.name === 'admin_mark_conversation_read'));
  if (markedBeforeOpen) throw new Error('Unread admin conversation was marked read before opening messaging');

  await admin.page.click('[data-page="messages"]');
  await admin.page.waitForFunction(() => document.getElementById('messages')?.classList.contains('active'));
  await admin.page.waitForFunction(() => document.getElementById('adminMessageThread')?.textContent.includes('Bonjour, pouvez-vous vérifier ma demande ?'));
  await admin.page.waitForFunction(() => window.__edmMessagingTest.rpcCalls.some((call) => call.name === 'admin_mark_conversation_read'));

  await admin.page.click('#adminMessageAiDraft');
  await admin.page.waitForFunction(() => document.getElementById('adminMessageBody')?.value.includes('votre message est bien reçu'));
  const sendsBeforeApproval = await admin.page.evaluate(() => window.__edmMessagingTest.rpcCalls.filter((call) => call.name === 'admin_send_message').length);
  if (sendsBeforeApproval !== 0) throw new Error('AI draft was sent without explicit admin approval');

  await admin.page.fill('#adminMessageBody', 'Bonjour Jean, votre message est reçu. Nous vérifions la demande avant de vous répondre.');
  await admin.page.click('#adminMessageSend');
  await admin.page.waitForFunction(() => window.__edmMessagingTest.rpcCalls.some((call) => call.name === 'admin_send_message'));
  await admin.page.waitForFunction(() => document.getElementById('adminMessageThread')?.textContent.includes('Nous vérifions la demande'));
  if (admin.errors.length) throw new Error(`Admin messaging errors:\n${admin.errors.join('\n')}`);
  await admin.page.close();

  console.log('client/admin messaging loop and explicit AI approval ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

function assertIncludes(values, expected, label) {
  if (!values.includes(expected)) throw new Error(`Missing ${label}: ${JSON.stringify(values)}`);
}
