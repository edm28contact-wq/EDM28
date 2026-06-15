module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const plateFromQuery =
      req.query?.plate ||
      req.query?.immatriculation ||
      "";

    const plateFromBody =
      req.body?.plate ||
      req.body?.immatriculation ||
      "";

    const rawPlate = String(plateFromQuery || plateFromBody || "")
      .trim()
      .toUpperCase();

    const cleanPlate = rawPlate
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9-]/g, "");

    if (!cleanPlate) {
      return res.status(400).json({
        success: false,
        error: "Plaque d'immatriculation manquante."
      });
    }

    const token = process.env.PLAQUE_API_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        error: "Variable Vercel PLAQUE_API_TOKEN manquante."
      });
    }

    const apiUrl = new URL("https://api.apiplaqueimmatriculation.com/plaque");
    apiUrl.searchParams.set("immatriculation", cleanPlate);
    apiUrl.searchParams.set("token", token);
    apiUrl.searchParams.set("pays", "FR");

    const apiResponse = await fetch(apiUrl.toString(), {
      method: "POST",
      headers: {
        "Accept": "application/json"
      }
    });

    const text = await apiResponse.text();

    let apiData = null;
    try {
      apiData = JSON.parse(text);
    } catch (error) {
      return res.status(502).json({
        success: false,
        error: "L'API plaque n'a pas renvoyé du JSON.",
        status: apiResponse.status,
        preview: text.slice(0, 180)
      });
    }

    if (!apiResponse.ok || apiData.code_erreur || apiData.message?.toLowerCase?.().includes("abonnement")) {
      return res.status(apiResponse.status || 502).json({
        success: false,
        error: apiData.message || "Erreur API plaque.",
        status: apiResponse.status,
        code_erreur: apiData.code_erreur || null
      });
    }

    const root = apiData.data || apiData;

    const immat = root.donnees_immatriculation_vehicule || {};
    const tech = root.caracteristiques_techniques_vehicule || {};

    const datePremiereImmat =
      immat.date_premiere_immatriculation ||
      apiData.date1erCir_fr ||
      apiData.date_premiere_immatriculation ||
      "";

    const annee =
      datePremiereImmat && String(datePremiereImmat).length >= 4
        ? String(datePremiereImmat).slice(0, 4)
        : "";

    const vehicle = {
      plaque:
        immat.numero_immatriculation ||
        apiData.immatriculation ||
        cleanPlate,

      marque:
        tech.marque ||
        apiData.marque ||
        "",

      modele:
        tech.denomination_commerciale ||
        apiData.modele ||
        apiData.modele_etude ||
        "",

      annee,

      energie:
        tech.type_carburant?.label ||
        tech.type_carburant?.code ||
        apiData.energieNGC ||
        apiData.energie ||
        "",

      motorisation:
        tech.cylindree
          ? `${tech.cylindree} cm3`
          : apiData.motorisation || "",

      typeMine:
        tech.type_variante_version ||
        apiData.type_mine ||
        "",

      kType:
        apiData.k_type ||
        "",

      vin:
        apiData.vin ? "Disponible côté API, non affiché publiquement" : "",

      categorie:
        tech.categorie_vehicule?.code ||
        "",

      genre:
        tech.genre_national?.code ||
        "",

      co2:
        tech.taux_co2 ||
        "",

      normeEuro:
        tech.classe_environnementale?.code ||
        "",

      datePremiereImmatriculation: datePremiereImmat
    };

    return res.status(200).json({
      success: true,
      vehicle
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur dans /api/plate.",
      details: error.message || String(error)
    });
  }
};
