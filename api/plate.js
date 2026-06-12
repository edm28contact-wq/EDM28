export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (error) {
        body = {};
      }
    }

    const plate =
      req.query.plate ||
      req.query.immatriculation ||
      body.plate ||
      body.immatriculation ||
      "";

    const cleanPlate = String(plate)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (!cleanPlate) {
      return res.status(400).json({
        success: false,
        error: "Immatriculation manquante."
      });
    }

    const token = process.env.PLAQUE_API_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        error: "Token API plaque manquant côté serveur."
      });
    }

    const apiUrl = new URL("https://api.apiplaqueimmatriculation.com/plaque");
    apiUrl.searchParams.set("immatriculation", cleanPlate);
    apiUrl.searchParams.set("token", token);
    apiUrl.searchParams.set("pays", "FR");

    const apiResponse = await fetch(apiUrl.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });

    const raw = await apiResponse.text();

    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      return res.status(502).json({
        success: false,
        error: "Réponse API plaque illisible.",
        raw
      });
    }

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        success: false,
        error: "Erreur API plaque.",
        details: json
      });
    }

    const data = json.data || json;

    if (data.erreur && String(data.erreur).trim() !== "") {
      return res.status(404).json({
        success: false,
        error: String(data.erreur),
        details: data
      });
    }

    const vehicle = {
      plate: data.immat || cleanPlate,
      marque: data.marque || "",
      modele: data.modele || "",
      energie: data.energieNGC || "",
      annee: extractYear(data.date1erCir_us || data.date1erCir_fr || ""),
      datePremiereCirculation: data.date1erCir_fr || data.date1erCir_us || "",
      vin: data.vin || "",
      typeMine: data.type_mine || data.cnit || "",
      kType: data.k_type || "",
      tecdocCarId: data.tecdoc_carid || "",
      tecdocManuId: data.tecdoc_manuid || "",
      tecdocModelId: data.tecdoc_modelid || "",
      codeMoteur: data.code_moteur || "",
      puissanceFiscale: data.puisFisc || "",
      puissanceReelle: data.puisFiscReel || "",
      boite: data.boite_vitesse || "",
      carrosserie: data.carrosserieCG || "",
      couleur: data.couleur || ""
    };

    return res.status(200).json({
      success: true,
      vehicle,
      source: "apiplaqueimmatriculation"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

function extractYear(value) {
  const text = String(value || "");

  const match = text.match(/\d{4}/);

  return match ? match[0] : "";
}
