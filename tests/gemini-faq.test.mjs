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
      body: { question: 'Est-ce que je dois payer les composants au garage ou au vendeur ?' }
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
    assert.equal(body.input, 'Est-ce que je dois payer les composants au garage ou au vendeur ?');
    assert.match(body.system_instruction, /assistant FAQ public officiel d’EDM28/i);
    assert.match(body.system_instruction, /CONNAISSANCES EDM28 PERTINENTES/i);
    assert.match(body.system_instruction, /client achète et paie directement les pièces/i);
    assert.equal(body.response_format.type, 'text');
    assert.equal(body.response_format.mime_type, 'application/json');
    assert.equal(body.response_format.schema.properties.grounded.type, 'boolean');
    assert.equal('minLength' in body.response_format.schema.properties.answer, false);
    assert.equal('maxLength' in body.response_format.schema.properties.answer, false);
    assert.equal('temperature' in body.generation_config, false);
    assert.equal(body.generation_config.thinking_level, 'low');
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
      body: { question: 'Pouvez-vous confirmer une disponibilité précise et un prix exact qui ne figurent pas dans mon dossier ?' }
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


test('Gemini FAQ returns a safe diagnostic code for upstream API errors', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  const originalFetch = global.fetch;
  global.fetch = async () => response(400, {
    error: { status: 'INVALID_ARGUMENT', message: 'bad request' }
  });

  try {
    const { default: handler } = await import(`../api/faq-ai.js?diag=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.30' },
      body: { question: 'Est-ce que je dois payer les composants au garage ou au vendeur ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(res.payload.success, false);
    assert.equal(res.payload.diagnostic, 'GEMINI-400-INVALID_ARGUMENT');
    assert.doesNotMatch(JSON.stringify(res.payload), /preview-gemini-secret/);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});


test('Gemini FAQ retries with gemini-3.5-flash after a 400 from the configured model', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-3.8-flash';

  const models = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    if (models.length === 1) {
      return response(400, { error: { status: 'INVALID_ARGUMENT' } });
    }
    return response(200, {
      status: 'completed',
      output_text: JSON.stringify({
        answer: 'Les pièces sont achetées directement par le client.',
        grounded: true,
        needs_vehicle_check: false,
        category: 'business_rule',
        fact_ids: ['parts_purchase']
      })
    });
  };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?fallback-model=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.31' },
      body: { question: 'Est-ce que je dois payer les composants au garage ou au vendeur ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(models, ['gemini-3.8-flash','gemini-3.6-flash']);
    assert.equal(res.payload.model, 'gemini-3.6-flash');
    assert.equal(res.payload.requestedModel, 'gemini-3.8-flash');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
  }
});


test('Gemini FAQ retries a transient 503 on the same model before failing over', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FAQ_RETRY_BASE_MS = '0';

  const models = [];
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    calls += 1;
    if (calls === 1) {
      return response(503, { error: { status: 'service_unavailable' } });
    }
    return response(200, {
      status: 'completed',
      output_text: JSON.stringify({
        answer: 'Les pièces sont contrôlées avant tout démontage.',
        grounded: true,
        needs_vehicle_check: false,
        category: 'business_rule',
        fact_ids: ['parts_check']
      })
    });
  };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?retry-503=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.32' },
      body: { question: 'Vous contrôlez les pièces avant de commencer ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls, 2);
    assert.deepEqual(models, ['gemini-3.8-flash','gemini-3.8-flash']);
    assert.equal(res.payload.model, 'gemini-3.8-flash');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
    delete process.env.GEMINI_FAQ_RETRY_BASE_MS;
  }
});

test('Gemini FAQ falls back to another current model after repeated 503s', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FAQ_RETRY_BASE_MS = '0';

  const models = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    if (body.model === 'gemini-3.8-flash') {
      return response(503, { error: { status: 'service_unavailable' } });
    }
    return response(200, {
      status: 'completed',
      output_text: JSON.stringify({
        answer: 'EDM28 fonctionne sur rendez-vous.',
        grounded: true,
        needs_vehicle_check: false,
        category: 'general_info',
        fact_ids: ['appointment']
      })
    });
  };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?fallback-503=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.33' },
      body: { question: 'Vous travaillez sur rendez-vous ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(models, ['gemini-3.8-flash','gemini-3.8-flash','gemini-3.6-flash']);
    assert.equal(res.payload.model, 'gemini-3.6-flash');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
    delete process.env.GEMINI_FAQ_RETRY_BASE_MS;
  }
});


test('Gemini FAQ uses only the final model_output step when an interaction has multiple outputs', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-test-model';

  const originalFetch = global.fetch;
  global.fetch = async () => response(200, {
    status: 'completed',
    steps: [
      {
        type: 'model_output',
        content: [{ type: 'text', text: '{"answer":"brouillon"' }]
      },
      {
        type: 'model_output',
        content: [{
          type: 'text',
          text: JSON.stringify({
            answer: 'EDM28 vérifie les pièces avant tout démontage.',
            grounded: true,
            needs_vehicle_check: false,
            category: 'business_rule',
            fact_ids: ['parts_check']
          })
        }]
      }
    ]
  });

  try {
    const { default: handler } = await import(`../api/faq-ai.js?multi-output=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.40' },
      body: { question: 'Vous contrôlez les pièces avant de démonter ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.match(res.payload.answer, /avant tout démontage/i);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
  }
});

test('Gemini FAQ retries when the first successful HTTP response contains malformed JSON output', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';
  process.env.PREVIEW_GEMINI_FAQ_MODEL = 'gemini-test-model';
  process.env.GEMINI_FAQ_RETRY_BASE_MS = '0';

  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return response(200, {
        status: 'completed',
        output_text: '{not-valid-json'
      });
    }
    return response(200, {
      status: 'completed',
      output_text: JSON.stringify({
        answer: 'EDM28 fonctionne sur rendez-vous.',
        grounded: true,
        needs_vehicle_check: false,
        category: 'general_info',
        fact_ids: ['appointment']
      })
    });
  };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?malformed-retry=${Date.now()}`);
    const req = {
      method: 'POST',
      headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.41' },
      body: { question: 'Vous travaillez sur rendez-vous ?' }
    };
    const res = createRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls, 2);
    assert.match(res.payload.answer, /rendez-vous/i);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
    delete process.env.PREVIEW_GEMINI_FAQ_MODEL;
    delete process.env.GEMINI_FAQ_RETRY_BASE_MS;
  }
});


test('Gemini FAQ answers contact questions locally without calling Gemini', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('Gemini should not be called'); };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?contact-local=${Date.now()}`);
    for (const question of [
      'Comment contacter EDM28 ?',
      'Je peux vous joindre comment ?',
      'Quel est votre mail ?'
    ]) {
      const req = {
        method: 'POST',
        headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': '203.0.113.50' },
        body: { question }
      };
      const res = createRes();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.success, true);
      assert.equal(res.payload.source, 'verified_local');
      assert.equal(res.payload.model, null);
      assert.match(res.payload.answer, /contact@edm28\.fr/);
      assert.match(res.payload.answer, /edm28\.fr\/contact/);
    }
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});




test('EDM28 FAQ knowledge base is complete, unique and reusable', async () => {
  const { FAQ_KNOWLEDGE, FAQ_IDS } = await import('../faq-knowledge.js');
  assert.ok(FAQ_KNOWLEDGE.length >= 60);
  assert.equal(new Set(FAQ_IDS).size, FAQ_IDS.length);
  for (const entry of FAQ_KNOWLEDGE) {
    assert.ok(entry.id);
    assert.ok(entry.category);
    assert.ok(entry.question.endsWith('?'));
    assert.ok(entry.answer.length >= 20);
    assert.ok(Array.isArray(entry.aliases) && entry.aliases.length >= 2);
    assert.ok(Array.isArray(entry.keywords) && entry.keywords.length >= 2);
  }
});

test('FAQ exact canonical questions are answered locally without Gemini', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  const { FAQ_KNOWLEDGE } = await import('../faq-knowledge.js');
  const sampleIds = [
    'identity','address','contact','appointment','pricing_model',
    'parts_purchase','client_wrong_parts_15','edm_recommendation_error',
    'brake_pads','brake_fluid','running_gear_scope','documents',
    'symptom_not_diagnosis','unknown_info'
  ];
  const entries = FAQ_KNOWLEDGE.filter((entry) => sampleIds.includes(entry.id));

  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('Gemini should not be called'); };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?kb-local=${Date.now()}`);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const req = {
        method: 'POST',
        headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': `203.0.113.${100 + index}` },
        body: { question: entry.question }
      };
      const res = createRes();
      await handler(req, res);
      assert.equal(res.statusCode, 200, entry.id);
      assert.equal(res.payload.source, 'verified_local', entry.id);
      assert.equal(res.payload.knowledgeId, entry.id, entry.id);
      assert.equal(res.payload.answer, entry.answer, entry.id);
    }
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});

test('FAQ aliases are learned from the canonical knowledge base', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_GEMINI_API_KEY = 'preview-gemini-secret';

  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Gemini should not be called for exact aliases'); };

  try {
    const { default: handler } = await import(`../api/faq-ai.js?kb-alias=${Date.now()}`);
    const cases = [
      ['Je peux vous appeler ?', 'phone'],
      ['Vous êtes ouvert quand ?', 'opening_hours'],
      ['Vous prenez sans rendez-vous ?', 'appointment'],
      ['Il y a encore la règle des 60 % ?', 'legacy_wrong_parts_fees'],
      ['Vous faites les rotules de direction ?', 'direction_links'],
      ['Gemini peut-il trouver ma panne ?', 'symptom_not_diagnosis']
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const [question, id] = cases[index];
      const req = {
        method: 'POST',
        headers: { host: 'edm28.fr', origin: 'https://edm28.fr', 'x-forwarded-for': `203.0.114.${10 + index}` },
        body: { question }
      };
      const res = createRes();
      await handler(req, res);
      assert.equal(res.statusCode, 200, question);
      assert.equal(res.payload.source, 'verified_local', question);
      assert.equal(res.payload.knowledgeId, id, question);
    }
  } finally {
    global.fetch = originalFetch;
    delete process.env.PREVIEW_GEMINI_API_KEY;
  }
});
