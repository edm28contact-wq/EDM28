import submitRequest from './submit-request-v2.js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

async function request(path, options = {}) {
  const response = await fetch(`${URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: options.apikey || SERVICE,
      Authorization: `Bearer ${options.token || SERVICE}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function callSubmit(token, requestId) {
  let statusCode = 200;
  let payload = null;
  const req = {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: { requestId }
  };
  const res = {
    status(code) { statusCode = code; return this; },
    setHeader() { return this; },
    end(text) { payload = JSON.parse(text); return this; }
  };
  await submitRequest(req, res);
  return { statusCode, payload };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false });
  if (process.env.VERCEL_ENV === 'production') return json(res, 403, { success: false, error: 'Preview uniquement.' });
  if (req.headers['x-e2e-key'] !== process.env.E2E_TEST_KEY) return json(res, 401, { success: false, error: 'Clé de test invalide.' });
  if (!URL || !ANON || !SERVICE) return json(res, 503, { success: false, error: 'Configuration Supabase absente.' });

  const stamp = Date.now();
  const email = `edm28.realtest+${stamp}@gmail.com`;
  const password = `Edm-${stamp}-Test!`;
  let userId;
  let vehicleId;
  let requestId;

  try {
    const created = await request('/auth/v1/admin/users', {
      method: 'POST',
      body: {
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Client', last_name: 'Test Reel', phone: '0600000000' }
      }
    });
    userId = created.id;

    const session = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', apikey: ANON, token: ANON, body: { email, password }
    });
    const token = session.access_token;

    await request('/rest/v1/profiles', {
      method: 'POST', token, apikey: ANON, prefer: 'resolution=merge-duplicates,return=minimal',
      body: { id: userId, first_name: 'Client', last_name: 'Test Reel', phone: '0600000000', email }
    });

    const vehicles = await request('/rest/v1/vehicles?select=id', {
      method: 'POST', token, apikey: ANON, prefer: 'return=representation',
      body: { user_id: userId, plate: 'TEST-28', plate_normalized: `TEST28${stamp}`, brand: 'PEUGEOT', model: '308', year: 2020, energy: 'Essence', mileage: 125000 }
    });
    vehicleId = vehicles[0].id;

    const services = [{ id: 'FR_DISC_PLAQ_AV', name: 'Disques + plaquettes avant', labor: 99, category: 'Freinage', parts: { standard: [120, 170] } }];
    const totals = { selected: services, laborBase: 99, comboSaving: 0, j7Saving: 30, partsMin: 120, partsMax: 170, laborAfter: 129, totalAllMin: 249, totalAllMax: 299 };
    const rows = await request('/rest/v1/service_requests?select=id', {
      method: 'POST', token, apikey: ANON, prefer: 'return=representation',
      body: { user_id: userId, vehicle_id: vehicleId, status: 'draft', selected_basket: 'standard', services, notes: 'TEST REEL AUTOMATISE - ne pas traiter', totals, j7_accepted: true, refuse_control: false }
    });
    requestId = rows[0].id;

    const result = await callSubmit(token, requestId);
    if (result.statusCode !== 200 || result.payload?.success !== true) throw new Error(`Envoi échoué: ${JSON.stringify(result)}`);

    return json(res, 200, { success: true, emailId: result.payload.emailId, requestId, testEmail: email });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message });
  } finally {
    try { if (requestId) await request(`/rest/v1/service_requests?id=eq.${requestId}`, { method: 'DELETE' }); } catch {}
    try { if (vehicleId) await request(`/rest/v1/vehicles?id=eq.${vehicleId}`, { method: 'DELETE' }); } catch {}
    try { if (userId) await request(`/rest/v1/profiles?id=eq.${userId}`, { method: 'DELETE' }); } catch {}
    try { if (userId) await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' }); } catch {}
  }
}
