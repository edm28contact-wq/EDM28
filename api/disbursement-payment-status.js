import { resolveSupabaseServiceConfig } from './supabase-config.js';

const supabase = resolveSupabaseServiceConfig();
const SUPABASE_URL = supabase.url;
const SUPABASE_ANON_KEY = supabase.key;
const SUPABASE_SERVICE_ROLE_KEY = supabase.serviceRoleKey;
const SUPABASE_ENVIRONMENT = supabase.environment;

function json(res, status, body) {
  res.setHeader('X-EDM-Environment', SUPABASE_ENVIRONMENT);
  return res.status(status).json(body);
}

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function stripeKey() {
  return SUPABASE_ENVIRONMENT === 'production'
    ? clean(process.env.STRIPE_SECRET_KEY, 300)
    : clean(process.env.PREVIEW_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY, 300);
}

async function authenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}

async function serviceRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Accès aux données de paiement impossible.');
  return body;
}

async function stripeSession(id) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Vérification du paiement impossible.');
  return body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Méthode non autorisée.' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !stripeKey()) {
    return json(res, 503, { success: false, configured: false, error: 'Le paiement en ligne des débours n’est pas encore configuré.' });
  }

  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return json(res, 401, { success: false, error: 'Connexion requise.' });
    const disbursementId = clean(req.body?.disbursementId, 80);
    const requestedSessionId = clean(req.body?.sessionId, 160);
    if (!disbursementId) return json(res, 400, { success: false, error: 'Débours absent.' });

    const profiles = await serviceRequest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role`);
    const role = Array.isArray(profiles) ? profiles[0]?.role : null;
    const disbursements = await serviceRequest(`disbursements?id=eq.${encodeURIComponent(disbursementId)}&select=id,user_id,status,payment_status,prepayment_required,authorized_limit,amount,prepaid_amount,paid_at`);
    const row = Array.isArray(disbursements) ? disbursements[0] : null;
    if (!row || (row.user_id !== user.id && role !== 'admin')) return json(res, 404, { success: false, error: 'Débours introuvable.' });

    const payments = await serviceRequest(`disbursement_payments?disbursement_id=eq.${encodeURIComponent(row.id)}&status=in.(creating,created)&order=created_at.desc&select=id,checkout_session_id,amount,currency,status`);
    const candidates = Array.isArray(payments) ? payments : [];
    for (const payment of candidates) {
      if (!payment.checkout_session_id) continue;
      if (requestedSessionId && payment.checkout_session_id !== requestedSessionId) continue;
      const session = await stripeSession(payment.checkout_session_id);
      if (session?.metadata?.disbursement_id !== row.id || session?.metadata?.user_id !== row.user_id || session?.metadata?.payment_record_id !== payment.id) {
        continue;
      }
      const expectedCents = Math.round(Number(payment.amount || 0) * 100);
      if (session.currency !== payment.currency || Number(session.amount_total || 0) !== expectedCents) continue;

      if (session.status === 'complete' && session.payment_status === 'paid') {
        await serviceRequest(`disbursement_payments?id=eq.${encodeURIComponent(payment.id)}&status=in.(creating,created)`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'paid',
            payment_intent_id: clean(session.payment_intent, 180) || null,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      } else if (session.status === 'expired') {
        await serviceRequest(`disbursement_payments?id=eq.${encodeURIComponent(payment.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() })
        });
      }
    }

    const refreshed = await serviceRequest(`disbursements?id=eq.${encodeURIComponent(row.id)}&select=id,status,payment_status,authorized_limit,amount,prepaid_amount,paid_at`);
    const current = Array.isArray(refreshed) ? refreshed[0] : row;
    return json(res, 200, {
      success: true,
      disbursement: current,
      amountDue: Math.max(0, Number(current.authorized_limit || 0) - Number(current.prepaid_amount || 0))
    });
  } catch (error) {
    console.error('disbursement-payment-status error', error);
    return json(res, 500, { success: false, error: error.message || 'Vérification indisponible.' });
  }
}
