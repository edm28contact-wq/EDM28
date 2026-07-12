const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ojjbnwpkfvzjfukgqddz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function authenticate(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Session absente.');

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: SUPABASE_ANON_KEY
    }
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw new Error('Session invalide.');
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Méthode non autorisée.' });

  try {
    const user = await authenticate(req);
    const body = req.body || {};
    const client = body.client || {};
    const vehicle = body.vehicle || {};
    const services = Array.isArray(body.services) ? body.services : [];
    const totals = body.totals || {};

    if (!body.requestId || !vehicle.plate || !services.length) {
      return json(res, 400, { success: false, error: 'Demande incomplète.' });
    }
    if (clean(client.email, 254).toLowerCase() !== clean(user.email, 254).toLowerCase()) {
      return json(res, 403, { success: false, error: 'Identité client incohérente.' });
    }
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.RESEND_TO_EMAIL) {
      return json(res, 503, { success: false, error: 'Service email non configuré.' });
    }

    const serviceLines = services.map((service) => `- ${clean(service.name, 120)} : ${Number(service.labor || 0).toFixed(2)} €`).join('\n');
    const text = [
      `Nouvelle demande EDM AUTO : ${clean(body.requestId, 80)}`,
      '',
      `Client : ${clean(client.firstName, 80)} ${clean(client.lastName, 80)}`,
      `Email : ${clean(client.email, 254)}`,
      `Téléphone : ${clean(client.phone, 40)}`,
      '',
      `Véhicule : ${clean(vehicle.plate, 20)} · ${clean(vehicle.brand, 80)} ${clean(vehicle.model, 80)}`,
      `Année : ${clean(vehicle.year, 10)} · Énergie : ${clean(vehicle.energy, 40)} · Kilométrage : ${clean(vehicle.mileage, 20)}`,
      '',
      'Prestations :',
      serviceLines,
      '',
      `Panier : ${clean(body.selectedBasket, 20)}`,
      `Contrôle préalable : ${body.j7Accepted ? 'oui' : 'non'}`,
      `Refus du contrôle : ${body.refuseControl ? 'oui' : 'non'}`,
      `Total estimé : ${Number(totals.totalAllMin || 0).toFixed(2)} € à ${Number(totals.totalAllMax || 0).toFixed(2)} €`,
      `Notes : ${clean(body.notes, 2000) || 'Aucune'}`
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.RESEND_TO_EMAIL],
        reply_to: clean(client.email, 254),
        subject: `Demande EDM AUTO · ${clean(vehicle.plate, 20)} · ${clean(body.requestId, 80)}`,
        text
      })
    });
    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      return json(res, 502, { success: false, error: emailResult.message || 'Échec de l’envoi email.' });
    }

    return json(res, 200, { success: true, requestId: body.requestId, emailId: emailResult.id || null });
  } catch (error) {
    return json(res, 401, { success: false, error: error.message || 'Authentification impossible.' });
  }
}
