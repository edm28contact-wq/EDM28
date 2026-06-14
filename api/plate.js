// api/plate.js

export default async function handler(req, res) {
  try {
    const body = req.body || {};

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
      method: "POST"
    });

    const data = await apiResponse.json().catch(() => null);

    if (!apiResponse.ok || !data) {
      return res.status(502).json({
        success: false,
        error: "Erreur API plaque.",
        status: apiResponse.status,
        raw: data
      });
    }

    return res.status(200).json({
      success: true,
      vehicle: {
        plaque: cleanPlate,
        marque: data.marque || "",
        modele: data.modele || "",
        energie: data.energieNGC || data.energie || "",
        vin: data.vin || "",
        typeMine: data.type_mine || "",
        kType: data.k_type || "",
        tecdocCarId: data.tecdoc_carid || "",
        tecdocManuId: data.tecdoc_manuid || "",
        tecdocModelId: data.tecdoc_modelid || "",
        codeMoteur: data.code_moteur || "",
        datePremiereCirculation: data.date1erCir_fr || ""
      },
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erreur serveur."
    });
  }
}
