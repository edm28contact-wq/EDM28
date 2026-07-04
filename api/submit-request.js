function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
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

function pickBasket(body) {
  return body.selectedBasket || body.basket || body.panier || "standard";
}

function normalizeTotals(body) {
  const totals = body.totals || {};

  return {
    laborBase: Number(totals.laborBase || body.laborBase || 0),
    basketExtra: Number(totals.basketExtra || body.basketExtra || 0),
    comboSaving: Number(totals.comboSaving || body.comboSaving || 0),
    j7Saving: Number(totals.j7Saving || body.j7Saving || 0),
    immobilisation: Number(totals.immobilisation || body.immobilisation || 0),
    laborAfter: Number(totals.laborAfter || body.totalMainOeuvre || 0),
    partsMin: Number(totals.partsMin || body.totalPiecesMin || 0),
    partsMax: Number(totals.partsMax || body.totalPiecesMax || 0),
    totalBefore: Number(totals.totalBefore || body.totalMin || 0),
  };
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

    const apiKey = process.env.APPS_SCRIPT_API_KEY || process.env.EDM28_API_KEY || "";
    const basket = pickBasket(body);
    const totals = normalizeTotals(body);

    const normalizedRequest = {
      source: "SITE_EDM_AUTO_V3",
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
        plateNormalized: body.vehicle?.plateNormalized || "",
        brand: body.vehicle?.brand || "",
        model: body.vehicle?.model || "",
        year: body.vehicle?.year || "",
        energy: body.vehicle?.energy || "",
        engine: body.vehicle?.engine || "",
        emissions: body.vehicle?.emissions || "",
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
      panier: basket,
      basket,
      selectedBasket: basket,
      notes: body.notes || "",

      totals: {
        laborBase: totals.laborBase,
        basketExtra: totals.basketExtra,
        comboSaving: totals.comboSaving,
        j7Saving: totals.j7Saving,
        immobilisation: totals.immobilisation,
        laborAfter: totals.laborAfter,
        partsMin: totals.partsMin,
        partsMax: totals.partsMax,
      },

      totalMainOeuvre: totals.laborAfter,
      totalPiecesMin: totals.partsMin,
      totalPiecesMax: totals.partsMax,

      j7Accepted: Boolean(body.j7Accepted),
      refuseControl: Boolean(body.refuseControl),
      aiRecommendation: body.aiRecommendation || null,
      aiBasketResult: body.aiBasketResult || body.aiRecommendation || null,

      status: "Nouveau",
      note: "Demande envoyée depuis le site EDM AUTO.",
    };

    if (!normalizedRequest.client.firstName || !normalizedRequest.client.lastName || !normalizedRequest.client.phone || !normalizedRequest.client.email) {
      return res.status(400).json({
        success: false,
        error: "Informations client incomplètes.",
        received: normalizedRequest,
      });
    }

    if (!normalizedRequest.vehicle.plate) {
      return res.status(400).json({
        success: false,
        error: "Plaque véhicule manquante.",
        received: normalizedRequest,
      });
    }

    if (!Array.isArray(normalizedRequest.services) || !normalizedRequest.services.length) {
      return res.status(400).json({
        success: false,
        error: "Aucune prestation sélectionnée.",
        received: normalizedRequest,
      });
    }

    if (!appsScriptUrl) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: "Variable Vercel APPS_SCRIPT_WEBAPP_URL manquante.",
        received: normalizedRequest,
      });
    }

    const headers = {
      "Content-Type": "text/plain;charset=utf-8",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers,
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
      sent: normalizedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur dans api/submit-request.js",
      details: error.message || String(error),
    });
  }
}
