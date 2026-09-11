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

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function stripeKey() {
  return SUPABASE_ENVIRONMENT === 'production'
    ? clean(process.env.STRIPE_SECRET_KEY, 300)
    : clean(process.env.PREVIEW_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY, 300);
}

async function authenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
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
  if (!response.ok) {
    console.error('Supabase service request failed', response.status, body);
    throw new Error('Accès aux données de paiement impossible.');
  }
  return body;
}

function requestOrigin(req) {
  const forwardedProto = clean(req.headers['x-forwarded-proto'], 20).split(',')[0] || 'https';
  const forwardedHost = clean(req.headers['x-forwarded-host'], 255).split(',')[0];
  const host = forwardedHost || clean(req.headers.host, 255);
  return `${forwardedProto}://${host}`;
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
    if (!disbursementId) return json(res, 400, { success: false, error: 'Débours absent.' });

    const rows = await serviceRequest(`disbursements?id=eq.${encodeURIComponent(disbursementId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,status,payment_status,prepayment_required,authorized_limit,prepaid_amount,description`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(res, 404, { success: false, error: 'Débours introuvable.' });
    if (!row.prepayment_required || row.status !== 'authorized') {
      return json(res, 409, { success: false, error: 'Ce débours n’est pas payable en ligne dans son état actuel.' });
    }
    if (row.payment_status === 'paid') return json(res, 200, { success: true, alreadyPaid: true });

    const required = Number(row.authorized_limit || 0);
    const alreadyPaid = Number(row.prepaid_amount || 0);
    const amount = Math.max(0, required - alreadyPaid);
    if (!(amount > 0)) return json(res, 409, { success: false, error: 'Aucun montant restant à payer.' });
    const unitAmount = Math.round(amount * 100);
    if (unitAmount < 50) return json(res, 409, { success: false, error: 'Montant de paiement invalide.' });

    const inserted = await serviceRequest('disbursement_payments', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        disbursement_id: row.id,
        user_id: user.id,
        provider: 'stripe',
        amount: unitAmount / 100,
        currency: 'eur',
        status: 'creating'
      })
    });
    const payment = Array.isArray(inserted) ? inserted[0] : null;
    if (!payment?.id) throw new Error('Création du paiement impossible.');

    const origin = requestOrigin(req);
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${origin}/?disbursement_payment=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${origin}/?disbursement_payment=cancelled`);
    form.set('customer_email', clean(user.email, 254));
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', 'eur');
    form.set('line_items[0][price_data][unit_amount]', String(unitAmount));
    form.set('line_items[0][price_data][product_data][name]', 'Provision pour débours EDM28');
    form.set('line_items[0][price_data][product_data][description]', clean(row.description || 'Achat de pièce pour le compte du client', 300));
    form.set('metadata[payment_record_id]', payment.id);
    form.set('metadata[disbursement_id]', row.id);
    form.set('metadata[user_id]', user.id);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `disbursement-payment-${payment.id}`
      },
      body: form
    });
    const session = await stripeResponse.json().catch(() => ({}));
    if (!stripeResponse.ok || !session?.id || !session?.url) {
      await serviceRequest(`disbursement_payments?id=eq.${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() })
      }).catch(() => {});
      console.error('Stripe checkout creation failed', stripeResponse.status, session);
      return json(res, 502, { success: false, error: 'Création du paiement en ligne impossible.' });
    }

    await serviceRequest(`disbursement_payments?id=eq.${payment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checkout_session_id: session.id, status: 'created', updated_at: new Date().toISOString() })
    });

    return json(res, 200, { success: true, checkoutUrl: session.url, sessionId: session.id, amount: unitAmount / 100 });
  } catch (error) {
    console.error('disbursement-payment-create error', error);
    return json(res, 500, { success: false, error: error.message || 'Paiement indisponible.' });
  }
}
