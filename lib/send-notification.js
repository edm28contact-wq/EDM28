import { resolveSupabasePublicConfig } from '../api/supabase-config.js';
import basketPolicy from '../supplier-basket-policy.js';

const supabase = resolveSupabasePublicConfig();
const SUPABASE_URL = supabase.url;
const SUPABASE_ANON_KEY = supabase.key;

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).end(JSON.stringify(body));
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

async function rest(path, authorization, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.hint || 'Requête Supabase impossible.');
  return data;
}

async function authenticate(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Authentification requise.');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error(`Configuration Supabase ${supabase.environment} absente.`);
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !user?.id) throw new Error('Session invalide.');
  const profiles = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role`, authorization);
  if (profiles?.[0]?.role !== 'admin') throw new Error('Accès administrateur requis.');
  return { authorization };
}

function interpolate(text, values) {
  return String(text || '').replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key) => String(values[key] ?? ''));
}

function htmlFromText(text) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;white-space:pre-line">${String(text || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`;
}

async function attachment(path, authorization, filename) {
  if (!path) return null;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/repair-documents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization }
  });
  if (!response.ok) throw new Error('Pièce jointe introuvable.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) throw new Error('Pièce jointe trop volumineuse.');
  return { filename: filename || path.split('/').pop() || 'document.pdf', content: buffer.toString('base64') };
}

function resendConfiguration() {
  const apiKey = clean(process.env.RESEND_API_KEY, 500);
  const from = clean(process.env.RESEND_FROM_EMAIL, 320);
  if (!apiKey || !from) throw new Error('Configuration Resend manquante.');
  if (!/^re_[A-Za-z0-9_-]+$/.test(apiKey)) {
    throw new Error('Clé RESEND_API_KEY invalide : remplacez la valeur masquée par la vraie clé Resend commençant par re_.');
  }
  if (/[^\x20-\x7E]/.test(from)) throw new Error('Adresse RESEND_FROM_EMAIL invalide.');
  return { apiKey, from };
}

function validatedReviewUrl(value) {
  const raw = clean(value, 1200);
  if (!raw) throw new Error('Lien d’avis Google non configuré.');
  let parsed;
  try { parsed = new URL(raw); } catch (_) { throw new Error('Lien d’avis Google invalide.'); }
  if (parsed.protocol !== 'https:') throw new Error('Le lien d’avis Google doit utiliser HTTPS.');
  return parsed.toString();
}

async function protectReviewRequest({ templateKey, relatedType, relatedId, business, authorization }) {
  if (templateKey !== 'review_request') return null;
  if (relatedType !== 'invoice' || !relatedId) throw new Error('Une demande d’avis doit être liée à une facture.');
  const reviewUrl = validatedReviewUrl(business.google_review_url);
  const existing = await rest(
    `outbound_notifications?template_key=eq.review_request&related_type=eq.invoice&related_id=eq.${encodeURIComponent(relatedId)}&status=in.(pending,sent)&select=id,status&limit=1`,
    authorization
  );
  if (existing?.length) throw new Error('Une demande d’avis a déjà été envoyée pour cette facture.');
  return reviewUrl;
}

async function persistedQuote({ templateKey, relatedType, relatedId, userId, attachmentPath, authorization }) {
  if (templateKey !== 'quote_sent') return null;
  if (relatedType !== 'quote' || !/^[0-9a-f-]{36}$/i.test(relatedId || '')) throw new Error('Devis associ\u00e9 obligatoire.');
  const rows = await rest(`quotes?id=eq.${encodeURIComponent(relatedId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,quote_number,commercial_model,total,valid_until,status,visible_to_client,pdf_path,quote_parts_baskets(requires_parts,supplier_url,recommended_parts)`, authorization);
  const quote = rows?.[0];
  if (!quote || !quote.visible_to_client || !['sent', 'accepted', 'refused', 'expired'].includes(quote.status)) throw new Error('Devis publi\u00e9 du client introuvable.');
  if (!quote.pdf_path || attachmentPath !== quote.pdf_path || !attachmentPath.startsWith(`${userId}/quote/`)) throw new Error('La pi\u00e8ce jointe doit \u00eatre le PDF enregistr\u00e9 de ce devis.');
  if (quote.commercial_model === 'customer_supplied_v1') {
    quote.basket = basketPolicy.basket(Array.isArray(quote.quote_parts_baskets) ? quote.quote_parts_baskets[0] : quote.quote_parts_baskets, true);
  }
  return quote;
}

function supplierButton(url) {
  if (!url) return '';
  const safe = basketPolicy.safeUrl(url).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<p><a href="${safe}" style="display:inline-block;padding:12px 18px;background:#18212f;color:#ffffff;text-decoration:none;border-radius:6px">Ouvrir mon panier fournisseur</a></p>`;
}

export async function handleSendNotification(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Méthode non autorisée.' });
  let logId = null;
  try {
    const { authorization } = await authenticate(req);
    const userId = clean(req.body?.userId, 80);
    const templateKey = clean(req.body?.templateKey, 80);
    const relatedType = clean(req.body?.relatedType, 40) || null;
    const relatedId = clean(req.body?.relatedId, 80) || null;
    const attachmentPath = clean(req.body?.attachmentPath, 1000) || null;
    const recipientOverride = clean(req.body?.recipientEmail, 320) || null;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(res, 400, { success: false, error: 'Client invalide.' });
    if (!templateKey) return json(res, 400, { success: false, error: 'Modèle obligatoire.' });

    const [profiles, templates, businessRows, settingsRows] = await Promise.all([
      rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,email`, authorization),
      rest(`message_templates?template_key=eq.${encodeURIComponent(templateKey)}&enabled=eq.true&select=template_key,subject,body`, authorization),
      rest('business_configuration?id=eq.true&select=business_name,email,booking_url,google_review_url', authorization),
      rest('automation_settings?id=eq.true&select=messages_enabled,test_mode,test_recipient', authorization)
    ]);
    const profile = profiles?.[0];
    const template = templates?.[0];
    const business = businessRows?.[0] || {};
    const settings = settingsRows?.[0] || {};
    if (!profile || !template) throw new Error('Client ou modèle introuvable.');
    if (settings.messages_enabled !== true) throw new Error('Envoi de messages désactivé.');

    const quote = await persistedQuote({ templateKey, relatedType, relatedId, userId, attachmentPath, authorization });
    if (quote && recipientOverride && recipientOverride.toLowerCase() !== clean(profile.email, 320).toLowerCase()) throw new Error('Le devis doit rester adressé au client associé.');
    const reviewUrl = await protectReviewRequest({ templateKey, relatedType, relatedId, business, authorization });
    const recipient = settings.test_mode === true ? clean(settings.test_recipient, 320) : (recipientOverride || clean(profile.email, 320));
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Adresse destinataire invalide.');
    const values = {
      ...(req.body?.values || {}),
      ...(reviewUrl ? { review_url: reviewUrl } : {}),
      client_name: clean(`${profile.first_name || ''} ${profile.last_name || ''}`.trim(), 120) || 'Client',
      business_name: business.business_name || 'EDM28',
      booking_url: business.booking_url || ''
    };
    const subject = quote?.basket ? `Votre devis EDM28 ${quote.quote_number}`.slice(0, 180) : interpolate(template.subject, values).slice(0, 180);
    const body = quote?.basket ? basketPolicy.quoteMessage({ quote, basket: quote.basket, clientName: values.client_name, businessName: values.business_name }) : interpolate(template.body, values).slice(0, 8000);

    const inserted = await rest('outbound_notifications?select=id', authorization, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, template_key: templateKey, related_type: relatedType, related_id: relatedId, recipient_email: recipient, subject, body, attachment_path: attachmentPath, status: 'pending' })
    });
    logId = inserted?.[0]?.id || null;

    const { apiKey, from } = resendConfiguration();
    const file = await attachment(attachmentPath, authorization, req.body?.attachmentName);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [recipient], reply_to: business.email || undefined, subject, html: htmlFromText(body) + supplierButton(quote?.basket?.supplier_url), text: body, attachments: file ? [file] : undefined })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.message || `Resend HTTP ${response.status}`);
    if (logId) await rest(`outbound_notifications?id=eq.${encodeURIComponent(logId)}`, authorization, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', provider_message_id: result.id || null, sent_at: new Date().toISOString(), error_message: null })
    });
    return json(res, 200, { success: true, id: logId, providerMessageId: result.id || null, recipient });
  } catch (error) {
    try {
      if (logId && req.headers.authorization) await rest(`outbound_notifications?id=eq.${encodeURIComponent(logId)}`, req.headers.authorization, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error_message: clean(error.message, 1000) })
      });
    } catch (_) {}
    const message = error?.message || 'Envoi impossible.';
    return json(res, /Authentification|Session|administrateur/.test(message) ? 401 : 500, { success: false, error: message });
  }
}
