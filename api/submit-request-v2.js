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

async function fetchSingle(path, params, authorization) {
  const query = new URLSearchParams({ ...params, limit: '1' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}?${query}`, {
    headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY }
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Lecture des données impossible.');
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function loadCanonicalRequest(requestId, user, authorization) {
  const request = await fetchSingle('service_requests', {
    id: `eq.${requestId}`,
    user_id: `eq.${user.id}`,
    select: 'id,user_id,vehicle_id,status,selected_basket,services,notes,totals,j7_accepted,refuse_control,submitted_at'
  }, authorization);
  if (!request) return null;

  const [profile, vehicle] = await Promise.all([
    fetchSingle('profiles', {
      id: `eq.${user.id}`,
      select: 'id,first_name,last_name,phone,email'
    }, authorization),
    request.vehicle_id ? fetchSingle('vehicles', {
      id: `eq.${request.vehicle_id}`,
      user_id: `eq.${user.id}`,
      select: 'id,plate,brand,model,year,energy,mileage'
    }, authorization) : Promise.resolve(null)
  ]);

  return { request, profile, vehicle };
}

async function markSubmitted(requestId, userId, authorization) {
  const query = new URLSearchParams({
    id: `eq.${requestId}`,
    user_id: `eq.${userId}`,
    status: 'eq.draft',
    select: 'id,status'
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/service_requests?${query}`, {
    method: 'PATCH',
    headers: {
      Authorization: authorization,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() })
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Email envoyé, mais statut non mis à jour.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Méthode non autorisée.' });

  try {
    const { user, authorization } = await authenticate(req);
    const requestId = clean(req.body?.requestId, 80);
    if (!requestId) return sendJson(res, 400, { success: false, error: 'Identifiant de demande absent.' });

    const canonical = await loadCanonicalRequest(requestId, user, authorization);
    if (!canonical) return sendJson(res, 404, { success: false, error: 'Demande introuvable ou non autorisée.' });

    const { request, profile, vehicle } = canonical;
    if (request.status === 'submitted') {
      return sendJson(res, 200, { success: true, requestId: request.id, alreadySubmitted: true });
    }
    if (request.status !== 'draft') {
      return sendJson(res, 409, { success: false, saved: true, error: 'Cette demande ne peut plus être transmise.' });
    }

    const services = Array.isArray(request.services) ? request.services : [];
    if (!vehicle?.plate || services.length === 0) {
      return sendJson(res, 400, { success: false, saved: true, error: 'Demande enregistrée mais incomplète.' });
    }

    const required = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_TO_EMAIL'];
    if (required.some((name) => !process.env[name])) {
      return sendJson(res, 503, { success: false, saved: true, error: 'Demande enregistrée, mais service email non configuré.' });
    }

    const totals = request.totals || {};
    const labor = services.reduce((sum, service) => sum + amount(service.labor), 0);
    const control = request.j7_accepted ? amount(totals.j7Saving ?? totals.controlPrice ?? 30) : 0;
    const estimatedMin = totals.totalMin ?? totals.totalAllMin ?? totals.laborAfter ?? totals.laborTotal ?? labor;
    const estimatedMax = totals.totalMax ?? totals.totalAllMax ?? estimatedMin;
    const serviceLines = services.map((service) => `- ${clean(service.name, 120)}`).join('\n');
    const clientEmail = clean(user.email || profile?.email, 254).toLowerCase();

    const text = [
      'Nouvelle demande EDM AUTO',
      `ID Demande : ${request.id}`,
      '',
      'CLIENT',
      `Nom : ${clean(profile?.last_name, 80)}`,
      `Prenom : ${clean(profile?.first_name, 80)}`,
      `Telephone : ${clean(profile?.phone, 40)}`,
      `Email : ${clientEmail}`,
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
      `PANIER : ${clean(request.selected_basket, 20)}`,
      '',
      'CONTROLE PREALABLE',
      `Controle ajoute : ${request.j7_accepted ? 'Oui' : 'Non'}`,
      `Controle refuse : ${request.refuse_control ? 'Oui' : 'Non'}`,
      '',
      'ESTIMATION',
      `Main d oeuvre estimee : ${euros(totals.laborBase ?? totals.laborTotal ?? labor)} EUR`,
      `Remise combo : ${euros(totals.comboSaving ?? totals.comboDiscount)} EUR`,
      `Controle prealable : ${euros(control)} EUR`,
      `Pieces estimees : ${euros(totals.partsMin)} EUR a ${euros(totals.partsMax)} EUR`,
      `Total estime tout compris : ${euros(estimatedMin)} EUR a ${euros(estimatedMax)} EUR`,
      '',
      'NOTES CLIENT',
      clean(request.notes, 2000) || 'Aucune',
      '',
      `Recue le : ${new Date().toISOString()}`
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `service-request/${request.id}`
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.RESEND_TO_EMAIL],
        reply_to: clientEmail || undefined,
        subject: `Nouvelle demande EDM AUTO - ${clean(profile?.first_name, 80)} ${clean(profile?.last_name, 80)} - ${clean(vehicle.plate, 20)}`,
        text,
        tags: [{ name: 'request_id', value: request.id }]
      })
    });
    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      const concurrent = emailResponse.status === 409 && emailResult.name === 'concurrent_idempotent_requests';
      return sendJson(res, concurrent ? 409 : 502, {
        success: false,
        saved: true,
        retryable: concurrent,
        error: emailResult.message || 'Demande enregistrée, mais échec de l’envoi email.'
      });
    }

    await markSubmitted(request.id, user.id, authorization);
    return sendJson(res, 200, { success: true, requestId: request.id, emailId: emailResult.id || null });
  } catch (error) {
    const message = error.message || 'Erreur serveur.';
    const status = /Session|Configuration Supabase/.test(message) ? 401 : 500;
    return sendJson(res, status, { success: false, error: message });
  }
}
