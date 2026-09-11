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
  if (!response.ok) throw new Error('Accès aux données de remboursement impossible.');
  return body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Méthode non autorisée.' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !stripeKey()) {
    return json(res, 503, { success: false, configured: false, error: 'Le remboursement en ligne n’est pas configuré.' });
  }
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return json(res, 401, { success: false, error: 'Connexion requise.' });
    const profiles = await serviceRequest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role`);
    if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') return json(res, 403, { success: false, error: 'Accès administrateur requis.' });

    const disbursementId = clean(req.body?.disbursementId, 80);
    const rows = await serviceRequest(`disbursements?id=eq.${encodeURIComponent(disbursementId)}&select=id,status,payment_status,amount,prepaid_amount`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !['eligible','reimbursed'].includes(row.status)) return json(res, 409, { success: false, error: 'Débours non régularisable.' });
    const excessCents = Math.round((Number(row.prepaid_amount || 0) - Number(row.amount || 0)) * 100);
    if (excessCents <= 0) return json(res, 409, { success: false, error: 'Aucun trop-perçu à rembourser.' });

    const payments = await serviceRequest(`disbursement_payments?disbursement_id=eq.${encodeURIComponent(row.id)}&status=in.(paid,partially_refunded)&order=paid_at.desc&select=id,payment_intent_id,amount,refunded_amount,status`);
    let remaining = excessCents;
    for (const payment of Array.isArray(payments) ? payments : []) {
      if (remaining <= 0) break;
      const available = Math.max(0, Math.round((Number(payment.amount || 0) - Number(payment.refunded_amount || 0)) * 100));
      if (!available || !payment.payment_intent_id) continue;
      const refundCents = Math.min(remaining, available);
      const form = new URLSearchParams();
      form.set('payment_intent', payment.payment_intent_id);
      form.set('amount', String(refundCents));
      form.set('metadata[disbursement_id]', row.id);
      const response = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': `disbursement-refund-${row.id}-${payment.id}-${refundCents}`
        },
        body: form
      });
      const refund = await response.json().catch(() => ({}));
      if (!response.ok || refund.status === 'failed') {
        console.error('Stripe refund failed', response.status, refund);
        throw new Error('Le remboursement Stripe a échoué.');
      }
      const refundedAmount = Number(payment.refunded_amount || 0) + refundCents / 100;
      const fullyRefunded = Math.abs(refundedAmount - Number(payment.amount || 0)) <= 0.005;
      await serviceRequest(`disbursement_payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          refunded_amount: refundedAmount,
          status: fullyRefunded ? 'refunded' : 'partially_refunded',
          updated_at: new Date().toISOString()
        })
      });
      remaining -= refundCents;
    }
    if (remaining > 0) throw new Error('Le trop-perçu n’a pas pu être remboursé intégralement.');

    const refreshed = await serviceRequest(`disbursements?id=eq.${encodeURIComponent(row.id)}&select=id,status,payment_status,amount,prepaid_amount,paid_at`);
    return json(res, 200, { success: true, disbursement: Array.isArray(refreshed) ? refreshed[0] : null });
  } catch (error) {
    console.error('disbursement-payment-refund error', error);
    return json(res, 500, { success: false, error: error.message || 'Remboursement impossible.' });
  }
}
