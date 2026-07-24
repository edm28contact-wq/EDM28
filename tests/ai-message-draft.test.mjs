import test from 'node:test';
import assert from 'node:assert/strict';

const adminId = '11111111-1111-4111-8111-111111111111';
const customerId = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; }
  };
}

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(body) { this.payload = JSON.parse(body); return this; }
  };
}

test('AI messaging creates a stored draft without sending a client message', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_OPENAI_API_KEY = 'preview-openai-test-key';
  process.env.PREVIEW_OPENAI_MESSAGE_MODEL = 'gpt-test-message-model';

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, options });

    if (href.endsWith('/auth/v1/user')) return response(200, { id: adminId, email: 'admin@example.test' });
    if (href.includes('/rest/v1/profiles?id=eq.') && href.includes('select=id,role')) {
      return response(200, [{ id: adminId, role: 'admin' }]);
    }
    if (href.includes('/rest/v1/automation_settings')) {
      return response(200, [{ ai_enabled: true, test_mode: true }]);
    }
    if (href.includes(`/rest/v1/profiles?id=eq.${customerId}`)) {
      return response(200, [{ id: customerId, first_name: 'Jean', last_name: 'Dupont', role: 'customer' }]);
    }
    if (href.includes('/rest/v1/client_messages?')) {
      return response(200, [{
        id: '44444444-4444-4444-8444-444444444444',
        direction: 'inbound',
        subject: 'Question',
        body: 'Le client demande une précision sur son rendez-vous.',
        created_at: '2026-07-24T18:00:00.000Z',
        service_request_id: null
      }]);
    }
    if (href === 'https://api.openai.com/v1/responses') {
      return response(200, {
        status: 'completed',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              subject: 'Précision sur votre rendez-vous',
              body: 'Bonjour Jean, votre demande est bien enregistrée. Un membre de l’équipe vous confirmera les détails après vérification.',
              urgency: 'normal',
              requires_human_check: true,
              facts_used: ['La demande est enregistrée'],
              warnings: ['Vérifier les détails du rendez-vous avant envoi']
            })
          }]
        }]
      });
    }
    if (href.includes('/rest/v1/ai_drafts?select=id') && options.method === 'POST') {
      return response(201, [{ id: draftId }]);
    }

    throw new Error(`Unexpected fetch: ${href}`);
  };

  try {
    const { default: handler } = await import(`../api/ai-message-draft.js?test=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: customerId, serviceRequestId: null, guidance: 'Répondre sans promettre de date.' }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.draftId, draftId);
    assert.equal(res.payload.requiresHumanApproval, true);
    assert.equal(res.payload.model, 'gpt-test-message-model');

    const openAiCall = calls.find((call) => call.href === 'https://api.openai.com/v1/responses');
    assert.ok(openAiCall, 'OpenAI Responses API was not called');
    assert.equal(openAiCall.options.headers.Authorization, 'Bearer preview-openai-test-key');
    const openAiBody = JSON.parse(openAiCall.options.body);
    assert.equal(openAiBody.store, false);
    assert.equal(openAiBody.text.format.type, 'json_schema');
    assert.equal(openAiBody.text.format.strict, true);
    assert.match(openAiBody.instructions, /données non fiables/);
    assert.doesNotMatch(openAiBody.input[0].content[0].text, /admin@example\.test|0600000000/);

    const insertCall = calls.find((call) => call.href.includes('/rest/v1/ai_drafts?select=id'));
    assert.ok(insertCall, 'AI draft was not stored');
    const inserted = JSON.parse(insertCall.options.body);
    assert.equal(inserted.document_type, 'message');
    assert.equal(inserted.status, 'draft');
    assert.equal(inserted.user_id, customerId);

    assert.equal(calls.some((call) => call.href.includes('/rest/v1/client_messages') && call.options.method === 'POST'), false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_OPENAI_API_KEY;
    delete process.env.PREVIEW_OPENAI_MESSAGE_MODEL;
  }
});

test('AI messaging refuses to run without an explicitly configured model', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_OPENAI_API_KEY = 'preview-openai-test-key';
  delete process.env.PREVIEW_OPENAI_MESSAGE_MODEL;

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, options });
    if (href.endsWith('/auth/v1/user')) return response(200, { id: adminId, email: 'admin@example.test' });
    if (href.includes('/rest/v1/profiles?id=eq.') && href.includes('select=id,role')) {
      return response(200, [{ id: adminId, role: 'admin' }]);
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  try {
    const { default: handler } = await import(`../api/ai-message-draft.js?missing-model=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: customerId, serviceRequestId: null, guidance: '' }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.success, false);
    assert.equal(res.payload.configured, false);
    assert.match(res.payload.error, /clé ou modèle manquant/);
    assert.equal(calls.some((call) => call.href === 'https://api.openai.com/v1/responses'), false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_OPENAI_API_KEY;
    delete process.env.PREVIEW_OPENAI_MESSAGE_MODEL;
  }
});
