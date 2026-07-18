const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function amount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function euros(value) {
  return amount(value).toFixed(2).replace('.', ',');
}

async function authenticate(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Session absente.');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuration Supabase absente.');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY }
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw new Error('Session invalide.');
  return { user, authorization };
}

async function findOwnedRequest(requestId, userId, authorization) {
  const query = new URLSearchParams({ id: `eq.${requestId}`, user_id: `eq.${userId}`, select: 'id,status' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/service_requests?${query}`, {
    headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY }
  });
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function markSubmitted(requestId, userId, authorization) {
  const query = new URLSearchParams({ id: `eq.${requestId}`, user_id: `eq.${userId}` });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/service_requests?${query}`, {
    method: 'PATCH',
    headers: {
      Authorization: authorization,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error('Email envoyé, mais statut non mis à jour.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Méthode non autorisée.' });
  try {
    const { user, authorization } = await authenticate(req);
    const body = req.body || {};
    const client = body.client || {};
    const vehicle = body.vehicle || {};
    const services = Array.isArray(body.services) ? body.services : [];
    const totals = body.totals || {};
    const requestId = clean(body.requestId, 80);
    if (!requestId || !clean(vehicle.plate, 20) || !services.length) {
      return sendJson(res, 400, { success: false, error: 'Demande incomplète.' });
    }
    if (clean(client.email, 254).toLowerCase() !== clean(user.email, 254).toLowerCase()) {
      return sendJson(res, 403, { success: false, error: 'Identité client incohérente.' });
    }
    const requestRow = await findOwnedRequest(requestId, user.id, authorization);
    if (!requestRow) return sendJson(res, 404, { success: false, error: 'Demande introuvable ou non autorisée.' });
    const required = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_TO_EMAIL'];
    if (required.some((name) => !process.env[name])) {
      return sendJson(res, 503, { success: false, saved: true, error: 'Demande enregistrée, mais service email non configuré.' });
    }

    const labor = services.reduce((sum, service) => sum + amount(service.labor), 0);
    const control = body.j7Accepted ? amount(totals.j7Saving ?? totals.controlPrice ?? 30) : 0;
    const serviceLines = services.map((service) => `- ${clean(service.name, 120)}`).join('\n');
    const text = [
      'Nouvelle demande EDM AUTO',
      `ID Demande : ${requestId}`,
      '',
      'CLIENT',
      `Nom : ${clean(client.lastName, 80)}`,
      `Prenom : ${clean(client.firstName, 80)}`,
      `Telephone : ${clean(client.phone, 40)}`,
      `Email : ${clean(client.email, 254)}`,
      '',
      'VEHICULE',
      `Plaque : ${clean(vehicle.plate, 20)}`,
      `Marque : ${clean(vehicle.brand, 80)}`,
      `Modele : ${clean(vehicle.model, 80)}`,
      `Annee : ${clean(vehicle.year, 10)}`,
      `Energie : ${clean(vehicle.energy, 40)}`,
      `Kilometrage : ${clean(vehicle.mileage, 20)}`,
      '',
      'PRESTATIONS',
      serviceLines,
      '',
      `PANIER : ${clean(body.selectedBasket, 20)}`,
      '',
      'CONTROLE PREALABLE',
      `Controle ajoute : ${body.j7Accepted ? 'Oui' : 'Non'}`,
      `Controle refuse : ${body.refuseControl ? 'Oui' : 'Non'}`,
      '',
      'ESTIMATION',
      `Main d oeuvre estimee : ${euros(totals.laborBase ?? totals.laborTotal ?? labor)} EUR`,
      `Remise combo : ${euros(totals.comboSaving ?? totals.comboDiscount)} EUR`,
      `Controle prealable : ${euros(control)} EUR`,
      `Pieces estimees : ${euros(totals.partsMin)} EUR a ${euros(totals.partsMax)} EUR`,
      `Total estime tout compris : ${euros(totals.totalAllMin)} EUR a ${euros(totals.totalAllMax)} EUR`,
      '',
      'NOTES CLIENT',
      clean(body.notes, 2000) || 'Aucune',
      '',
      `Recue le : ${new Date().toISOString()}`
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.RESEND_TO_EMAIL],
        reply_to: clean(client.email, 254),
        subject: `Nouvelle demande EDM AUTO - ${clean(client.firstName, 80)} ${clean(client.lastName, 80)} - ${clean(vehicle.plate, 20)}`,
        text
      })
    });
    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      return sendJson(res, 502, { success: false, saved: true, error: emailResult.message || 'Demande enregistrée, mais échec de l’envoi email.' });
    }
    await markSubmitted(requestRow.id, user.id, authorization);
    return sendJson(res, 200, { success: true, requestId: requestRow.id, emailId: emailResult.id || null });
  } catch (error) {
    const status = /Session|Configuration Supabase/.test(error.message || '') ? 401 : 500;
    return sendJson(res, status, { success: false, error: error.message || 'Erreur serveur.' });
  }
}