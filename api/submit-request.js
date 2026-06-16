function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (req.body && typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      api: "submit-request",
      message: "Route demande active. Utilise POST pour envoyer une demande.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée. Utilise POST.",
    });
  }

  try {
    const body = await readJsonBody(req);

    const appsScriptUrl =
      process.env.APPS_SCRIPT_WEBAPP_URL ||
      process.env.EDM28_BACKEND_URL ||
      "";

    const normalizedRequest = {
      source: "SITE_EDM_AUTO_VITE",
      createdAt: new Date().toISOString(),

      client: {
        firstName: body.client?.firstName || "",
        lastName: body.client?.lastName || "",
        phone: body.client?.phone || "",
        email: body.client?.email || "",

        Prenom: body.client?.firstName || "",
        Nom: body.client?.lastName || "",
        Telephone: body.client?.phone || "",
        Email: body.client?.email || "",
      },

      vehicle: {
        plate: body.vehicle?.plate || "",
        brand: body.vehicle?.brand || "",
        model: body.vehicle?.model || "",
        year: body.vehicle?.year || "",
        energy: body.vehicle?.energy || "",
        engine: body.vehicle?.engine || "",
        mileage: body.vehicle?.mileage || "",

        Plaque: body.vehicle?.plate || "",
        Marque: body.vehicle?.brand || "",
        Modele: body.vehicle?.model || "",
        Annee: body.vehicle?.year || "",
        Energie: body.vehicle?.energy || "",
        Motorisation: body.vehicle?.engine || "",
        Kilometrage: body.vehicle?.mileage || "",
      },

      services: body.services || [],
      panier: body.basket || "",
      basket: body.basket || "",

      totals: {
        totalMainOeuvre: body.totalMainOeuvre || 0,
        totalPiecesMin: body.totalPiecesMin || 0,
        totalPiecesMax: body.totalPiecesMax || 0,
        totalMin: body.totalMin || 0,
        totalMax: body.totalMax || 0,
      },

      j7Accepted: body.j7Accepted || false,
      refuseControl: body.refuseControl || false,
      aiBasketResult: body.aiBasketResult || null,

      status: "Nouveau",
      note: "Demande envoyée depuis le site EDM AUTO.",
    };

    if (!appsScriptUrl) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: "Variable Vercel APPS_SCRIPT_WEBAPP_URL manquante.",
        received: normalizedRequest,
      });
    }

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(normalizedRequest),
    });

    const text = await response.text();

    let appsScriptResult = null;

    try {
      appsScriptResult = JSON.parse(text);
    } catch {
      appsScriptResult = {
        raw: text.slice(0, 500),
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "Apps Script a refusé la demande.",
        status: response.status,
        appsScriptResult,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Demande envoyée à EDM AUTO.",
      appsScriptResult,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur dans api/submit-request.js",
      details: error.message || String(error),
    });
  }
}
