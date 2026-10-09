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
      output_text: JSON.stringify({
        answer: 'Les pièces sont achetées directement par le client. EDM28 facture la prestation.',
        grounded: true,
        needs_vehicle_check: false,
        category: 'business_rule',
        fact_ids: ['pricing_model','parts_purchase']
      })
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
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1/interactions');
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'preview-gemini-secret');
    assert.doesNotMatch(calls[0].options.body, /preview-gemini-secret/);

    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.model, 'gemini-test-model');
    assert.equal(body.store, false);
    assert.equal(body.input, 'Les pièces sont-elles comprises ?');
    assert.match(body.system_instruction, /assistant FAQ public officiel d’EDM28/i);
    assert.match(body.system_instruction, /15 €/);
    assert.match(body.system_instruction, /erreur de préconisation EDM28/i);
    assert.equal(body.response_format.type, 'text');
    assert.equal(body.response_format.mime_type, 'application/json');
    assert.equal(body.response_format.schema.properties.grounded.type, 'boolean');
    assert.equal(body.generation_config.thinking_level, 'low');
    assert.equal(body.generation_config.temperature, 0.1);
    assert.equal(res.payload.verified, true);
    assert.equal(res.payload.source, 'gemini_grounded');
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


test('Gemini FAQ replaces an unsupported answer with a safe server fallback', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-test-model';

  const originalFetch = global.fetch;
  global.fetch = async () => response(200, {
    status: 'completed',
    output_text: JSON.stringify({
      answer: 'EDM28 est ouvert tous les jours et facture 89 €.',
      grounded: false,
      needs_vehicle_check: false,
      category: 'unknown',
      fact_ids: []
    })
  });

  try {
    const { default: handler } = await import(`../api/faq-ai.js?fallback=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.21' },
      body: { question: 'Vous êtes ouvert quand et c’est combien ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.verified, false);
    assert.equal(res.payload.source, 'server_fallback');
    assert.doesNotMatch(res.payload.answer, /89|tous les jours/i);
    assert.match(res.payload.answer, /pas assez d’informations fiables/i);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
  }
});

test('Gemini FAQ rejects invented prices even when the model marks them grounded', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-test-model';

  const originalFetch = global.fetch;
  global.fetch = async () => response(200, {
    status: 'completed',
    output_text: JSON.stringify({
      answer: 'Cette prestation coûte 79 €.',
      grounded: true,
      needs_vehicle_check: false,
      category: 'business_rule',
      fact_ids: ['pricing_model']
    })
  });

  try {
    const { default: handler } = await import(`../api/faq-ai.js?price=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.22' },
      body: { question: 'Combien coûte cette prestation ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.source, 'server_fallback');
    assert.doesNotMatch(res.payload.answer, /79/);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
  }
});

test('Gemini FAQ blocks repair procedures before calling the model', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('Gemini should not be called'); };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?procedure=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.23' },
      body: { question: 'Comment changer mes plaquettes de frein étape par étape ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.source, 'server_guard');
    assert.equal(res.payload.model, null);
    assert.equal(called, false);
    assert.match(res.payload.answer, /pas fournir une procédure de réparation/i);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});

test('Conseils & FAQ no longer contains the four generic intro questions', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public-seo.js', import.meta.url), 'utf8');
  const transparency = source.split('transparence: {')[1].split("'a-propos': {")[0];

  assert.match(transparency, /sections: \[\]/);
  assert.doesNotMatch(transparency, /Pourquoi faire contrôler ses freins \?/);
  assert.doesNotMatch(transparency, /Quand intervenir sur le freinage \?/);
  assert.doesNotMatch(transparency, /Pourquoi surveiller la liaison au sol \?/);
  assert.doesNotMatch(transparency, /La transparence EDM28 envers ses clients/);
});
