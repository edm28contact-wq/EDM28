import test from 'node:test';
import assert from 'node:assert/strict';

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

test('Gemini FAQ calls Google server-side without exposing the API key', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-test-model';

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return response(200, {
      status: 'completed',
      output_text: 'Les pièces sont achetées directement par le client. EDM28 facture la prestation.'
    });
  };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?success=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.10' },
      body: { question: 'Les pièces sont-elles comprises ?' }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.match(res.payload.answer, /pièces/i);
    assert.equal(res.payload.model, 'gemini-test-model');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'preview-gemini-secret');
    assert.doesNotMatch(calls[0].options.body, /preview-gemini-secret/);

    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.model, 'gemini-test-model');
    assert.equal(body.store, false);
    assert.equal(body.input, 'Les pièces sont-elles comprises ?');
    assert.match(body.system_instruction, /assistant FAQ public officiel d’EDM28/i);
    assert.match(body.system_instruction, /15 €/);
    assert.match(body.system_instruction, /erreur de préconisation EDM28/i);
    assert.equal(body.generation_config.thinking_level, 'minimal');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
  }
});

test('Gemini FAQ stays unavailable until a server-side API key is configured', async () => {
  process.env.VERCEL_ENV = 'preview';
  delete process.env.PREVIEW_GEMINI_API_KEY;

  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not call'); };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?missing=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.11' },
      body: { question: 'Comment fonctionne EDM28 ?' }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.configured, false);
    assert.match(res.payload.error, /non configuré/i);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Gemini FAQ rejects cross-origin browser calls', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  try {
    const { default: handler } = await import(`../api/faq-ai.js?origin=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://example.com', 'x-forwarded-for': '203.0.113.12' },
      body: { question: 'Quels sont vos tarifs ?' }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.payload.error, /origine/i);
  } finally {
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});

test('public FAQ page loads the Gemini client only on Conseils & FAQ', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public-seo.js', import.meta.url), 'utf8');
  const client = await readFile(new URL('../public-faq-ai.js', import.meta.url), 'utf8');

  assert.match(source, /id="edmFaqAiForm"/);
  assert.match(source, /Assistant Gemini/);
  assert.match(source, /public-faq-ai\.js/);
  assert.match(source, /page\.path === '\/transparence'/);
  assert.match(client, /fetch\('\/api\/faq-ai'/);
  assert.match(client, /textContent = data\.answer/);
  assert.doesNotMatch(client, /GEMINI_API_KEY|x-goog-api-key|generativelanguage\.googleapis\.com/);
});
