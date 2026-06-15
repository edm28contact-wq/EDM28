const { sendJson, sendOptions, readJsonBody, readJsonResponse, previewText } = require("./_utils.cjs");

function value(input) {
  return String(input ?? "").trim();
}

function servicePayload(services) {
  return (services || [])
    .map((s) => ({
      id: value(s.id),
      ID_Service: value(s.id),
      name: value(s.name),
      Nom_Service: value(s.name),
      labor: s.labor || s.price || 0,
      Prix_Base: s.labor || s.price || 0,
      Main_Oeuvre: s.labor || s.price || 0
    }))
    .filter((s) => s.id || s.name);
}

async function postAppsScript(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });

  const { text, json } = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(json?.error || previewText(text) || `Apps Script HTTP ${response.status}`);
  }

  if (json && json.success === false) {
    throw new Error(json.error || "Apps Script a refusé la demande.");
  }

  return json || { success: true, rawPreview: previewText(text) };
}

async function submitLegacy(url, input) {
  const client = input.client || {};
  const vehicle = input.vehicle || {};
  const totals = input.totals || {};
  const services = servicePayload(input.services);

  return postAppsScript(url, {
    client: {
      name: `${value(client.firstName)} ${value(client.lastName)}`.trim(),
      Nom: value(client.lastName),
      Prenom: value(client.firstName),
      email: value(client.email),
      phone: value(client.phone)
    },
    vehicle: {
      plate: value(vehicle.plate || vehicle.plaque),
      brand: value(vehicle.brand || vehicle.marque),
      model: value(vehicle.model || vehicle.modele),
      engine: value(vehicle.engine || vehicle.motorisation || vehicle.typeMine),
      energy: value(vehicle.energy || vehicle.energie),
      year: value(vehicle.year || vehicle.annee),
      mileage: value(vehicle.mileage || vehicle.kilometrage)
    },
    services,
    panier: value(input.selectedBasket || "STANDARD").toUpperCase(),
    Controle_J7_Accepte: input.j7Accepted ? "Oui" : "Non",
    Remise_Controle_Eligible: input.j7Accepted ? "Oui" : "Non",
    Decharge_Refus_Controle: input.refuseControl ? "Oui" : "Non",
    Notes_EDM: JSON.stringify({
      source: "SITE_V3_PROXY_LEGACY",
      ai: input.aiRecommendation || null,
      totals,
      createdAt: new Date().toISOString()
    })
  });
}

async function submitAction(url, apiKey, input) {
  const client = input.client || {};
  const vehicle = input.vehicle || {};
  const services = servicePayload(input.services);

  const createdClient = await postAppsScript(url, {
    apiKey,
    action: "createClient",
    payload: {
      Nom: value(client.lastName),
      Prenom: value(client.firstName),
      Email: value(client.email),
      Telephone: value(client.phone),
      Consentement_RGPD: "A_confirmer",
      Statut_Client: "Actif"
    }
  });

  const userId = createdClient?.data?.ID_User || createdClient?.ID_User || value(client.email || client.phone);

  const createdVehicle = await postAppsScript(url, {
    apiKey,
    action: "createVehicle",
    payload: {
      ID_User: userId,
      Plaque: value(vehicle.plate || vehicle.plaque),
      Marque: value(vehicle.brand || vehicle.marque),
      Modele: value(vehicle.model || vehicle.modele),
      Motorisation: value(vehicle.engine || vehicle.motorisation || vehicle.typeMine),
      Energie: value(vehicle.energy || vehicle.energie),
      Annee: value(vehicle.year || vehicle.annee),
      Kilometrage_Actuel: value(vehicle.mileage || vehicle.kilometrage),
      Source_Detection: "SITE_V3_API_PLAQUE"
    }
  });

  const vehicleId = createdVehicle?.data?.ID_Vehicle || createdVehicle?.ID_Vehicle || value(vehicle.plate || vehicle.plaque);

  const createdOperation = await postAppsScript(url, {
    apiKey,
    action: "createOperation",
    payload: {
      ID_User: userId,
      ID_Vehicle: vehicleId,
      Source_Demande: "SITE_V3_PROXY_ACTION",
      Services_Selectionnes: services.map((s) => s.id || s.name).join(" + "),
      services,
      Panier_Choisi: value(input.selectedBasket || "STANDARD").toUpperCase(),
      Controle_J7_Propose: "Oui",
      Controle_J7_Accepte: input.j7Accepted ? "Oui" : "Non",
      Decharge_Refus_Controle: input.refuseControl ? "Oui" : "Non",
      Remise_Controle_Eligible: input.j7Accepted ? "Oui" : "Non",
      Forfait_Immobilisation: input.refuseControl ? 40 : 0,
      Statut_Operation: "Nouvelle_demande_site",
      Notes_EDM: JSON.stringify({
        source: "SITE_V3_ACTION_MODE",
        vehiclePublic: vehicle,
        totals: input.totals || {},
        ai: input.aiRecommendation || null,
        createdAt: new Date().toISOString()
      }),
      calculate: true
    }
  });

  return {
    success: true,
    mode: "action",
    client: createdClient?.data || createdClient,
    vehicle: createdVehicle?.data || createdVehicle,
    operation: createdOperation?.data || createdOperation
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (req.method !== "POST") return sendJson(res, 405, { success: false, error: "Méthode non autorisée." });

  try {
    const backendUrl = process.env.EDM28_BACKEND_URL || process.env.APPS_SCRIPT_WEBAPP_URL;
    if (!backendUrl) {
      return sendJson(res, 500, { success: false, error: "EDM28_BACKEND_URL ou APPS_SCRIPT_WEBAPP_URL manquant dans Vercel." });
    }

    const input = await readJsonBody(req);
    if (!input.client?.email && !input.client?.phone) return sendJson(res, 400, { success: false, error: "Email ou téléphone client requis." });
    if (!input.vehicle?.plate && !input.vehicle?.plaque) return sendJson(res, 400, { success: false, error: "Plaque véhicule requise." });
    if (!Array.isArray(input.services) || !input.services.length) return sendJson(res, 400, { success: false, error: "Sélectionnez au moins une prestation." });

    const apiKey = process.env.EDM28_API_KEY || process.env.APPS_SCRIPT_API_KEY || "";
    const requestedMode = String(process.env.EDM28_SUBMIT_MODE || "auto").toLowerCase();
    const useAction = requestedMode === "action" || (requestedMode === "auto" && apiKey);

    const result = useAction ? await submitAction(backendUrl, apiKey, input) : await submitLegacy(backendUrl, input);

    return sendJson(res, 200, { success: true, mode: useAction ? "action" : "legacy", result });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      error: error?.message || "Erreur pendant l’envoi de la demande."
    });
  }
};
