import { resolveSupabasePublicConfig } from './supabase-config.js';

const supabase = resolveSupabasePublicConfig();
const SUPABASE_URL = supabase.url;
const SUPABASE_ANON_KEY = supabase.key;
const ENVIRONMENT = supabase.environment;

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-EDM-Environment', ENVIRONMENT);
  return res.end(JSON.stringify(body));
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function emailKey() {
  return ENVIRONMENT === 'production'
    ? clean(process.env.OPENAI_API_KEY, 500)
    : clean(process.env.PREVIEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY, 500);
}

function modelName() {
  return ENVIRONMENT === 'production'
    ? clean(process.env.OPENAI_MESSAGE_MODEL || 'gpt-5', 100)
    : clean(process.env.PREVIEW_OPENAI_MESSAGE_MODEL || process.env.OPENAI_MESSAGE_MODEL || 'gpt-5', 100);
}

async function rest(path, authorization, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.hint || 'Lecture Supabase impossible.');
  return data;
}

async function authenticate(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Authentification requise.');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error(`Configuration Supabase ${ENVIRONMENT} absente.`);

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization }
  });
  const user = await authResponse.json().catch(() => null);
  if (!authResponse.ok || !user?.id) throw new Error('Session invalide.');

  const profiles = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role`, authorization);
  if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') throw new Error('Accès administrateur requis.');
  return { authorization, user };
}

function outputText(response) {
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function safeMessages(rows) {
  return (rows || []).slice().reverse().map((message) => ({
    direction: message.direction,
    subject: clean(message.subject, 160),
    body: clean(message.body, 1500),
    created_at: message.created_at
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Méthode non autorisée.' });

  try {
    const { authorization } = await authenticate(req);
    const userId = clean(req.body?.userId, 80);
    const serviceRequestId = clean(req.body?.serviceRequestId, 80) || null;
    const guidance = clean(req.body?.guidance, 1200);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return sendJson(res, 400, { success: false, error: 'Client invalide.' });
    if (serviceRequestId && !/^[0-9a-f-]{36}$/i.test(serviceRequestId)) return sendJson(res, 400, { success: false, error: 'Demande invalide.' });

    const key = emailKey();
    const model = modelName();
    if (!key) return sendJson(res, 503, { success: false, configured: false, error: `Assistant IA ${ENVIRONMENT} non configuré.` });

    const profiles = await rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,phone,email`, authorization);
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile?.id) return sendJson(res, 404, { success: false, error: 'Client introuvable.' });

    const messages = await rest(`client_messages?user_id=eq.${encodeURIComponent(userId)}&select=id,direction,subject,body,created_at,service_request_id&order=created_at.desc&limit=30`, authorization);

    let request = null;
    let vehicle = null;
    if (serviceRequestId) {
      const requests = await rest(`service_requests?id=eq.${encodeURIComponent(serviceRequestId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,status,selected_basket,services,notes,totals,vehicle_id,created_at`, authorization);
      request = Array.isArray(requests) ? requests[0] : null;
      if (!request?.id) return sendJson(res, 404, { success: false, error: 'Demande introuvable pour ce client.' });
      if (request.vehicle_id) {
        const vehicles = await rest(`vehicles?id=eq.${encodeURIComponent(request.vehicle_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,plate,brand,model,year,energy,mileage`, authorization);
        vehicle = Array.isArray(vehicles) ? vehicles[0] : null;
      }
    }

    const sourceSnapshot = {
      client: {
        id: profile.id,
        first_name: clean(profile.first_name, 80),
        last_name: clean(profile.last_name, 80),
        email: clean(profile.email, 254),
        phone: clean(profile.phone, 40)
      },
      service_request: request,
      vehicle,
      recent_messages: safeMessages(messages),
      guidance
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 700,
        instructions: [
          'Tu aides le back-office EDM AUTO à rédiger un brouillon de réponse client en français.',
          'Utilise uniquement les faits fournis. N’invente jamais un diagnostic, une disponibilité, un prix définitif, une garantie ou un délai.',
          'Ne donne pas d’instruction de réparation dangereuse. Pour tout point incertain, indique qu’une vérification humaine ou technique est nécessaire.',
          'Le texte sera obligatoirement relu et validé par un administrateur avant envoi.',
          'Reste clair, professionnel, concis et courtois.'
        ].join(' '),
        input: [{
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(sourceSnapshot) }]
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'edm_message_draft',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                subject: { type: 'string' },
                body: { type: 'string' },
                urgency: { type: 'string', enum: ['low', 'normal', 'high'] },
                requires_human_check: { type: 'boolean' },
                facts_used: { type: 'array', items: { type: 'string' } },
                warnings: { type: 'array', items: { type: 'string' } }
              },
              required: ['subject', 'body', 'urgency', 'requires_human_check', 'facts_used', 'warnings']
            }
          },
          verbosity: 'low'
        }
      })
    });

    const openaiResult = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('OpenAI message draft failed', response.status, openaiResult?.error?.code || openaiResult?.error?.message || 'unknown');
      return sendJson(res, 502, { success: false, error: 'Génération du brouillon IA impossible.' });
    }

    const raw = outputText(openaiResult);
    const draft = JSON.parse(raw || '{}');
    draft.subject = clean(draft.subject, 160);
    draft.body = clean(draft.body, 4000);
    if (!draft.body) throw new Error('Le brouillon IA est vide.');
    draft.requires_human_check = true;

    const inserted = await rest('ai_drafts?select=id', authorization, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        vehicle_id: vehicle?.id || null,
        service_request_id: request?.id || null,
        document_type: 'message',
        source_snapshot: sourceSnapshot,
        draft_payload: draft,
        model,
        status: 'draft',
        validation_errors: Array.isArray(draft.warnings) ? draft.warnings : []
      })
    });

    return sendJson(res, 200, {
      success: true,
      draftId: inserted?.[0]?.id || null,
      draft,
      model,
      requiresHumanApproval: true
    });
  } catch (error) {
    const message = error?.message || 'Erreur serveur.';
    const status = /Authentification|Session|administrateur/.test(message) ? 401 : 500;
    console.error('ai-message-draft error', message);
    return sendJson(res, status, { success: false, error: message });
  }
}
