const { sendJson, sendOptions, readJsonBody } = require("./_utils.cjs");

function normalizePlate(input) {
  return String(input || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function formatFrenchPlate(cleanPlate) {
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cleanPlate)) {
    return `${cleanPlate.slice(0, 2)}-${cleanPlate.slice(2, 5)}-${cleanPlate.slice(5)}`;
  }
  return cleanPlate;
}

function getPlateType(cleanPlate) {
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cleanPlate)) return "SIV";
  if (/^\d{1,4}[A-Z]{1,3}\d{2,3}$/.test(cleanPlate)) return "Ancien format FNI probable";
  if (/^W[A-Z0-9]{1,10}$/.test(cleanPlate)) return "Garage / provisoire probable";
  if (/^WW[A-Z0-9]{1,10}$/.test(cleanPlate)) return "WW provisoire probable";
  return "Format à vérifier";
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (!["GET", "POST"].includes(req.method)) {
    return sendJson(res, 405, { success: false, error: "Méthode non autorisée." });
  }

  try {
    const body = req.method === "POST" ? await readJsonBody(req) : {};
    const rawPlate = req.query?.plate || req.query?.immatriculation || body.plate || body.immatriculation || "";
    const cleanPlate = normalizePlate(rawPlate);

    if (!cleanPlate) {
      return sendJson(res, 400, { success: false, error: "Immatriculation manquante." });
    }

    const formatted = formatFrenchPlate(cleanPlate);
    const validFrenchPlate = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cleanPlate) || /^\d{1,4}[A-Z]{1,3}\d{2,3}$/.test(cleanPlate);

    return sendJson(res, 200, {
      success: true,
      source: "gratuit_sans_base_siv",
      manualRequired: true,
      warning: "Mode gratuit : aucune base plaque officielle n'est interrogée. Le site valide seulement le format de plaque. Le client doit remplir marque, modèle, énergie, année et motorisation.",
      vehicle: {
        plaque: formatted,
        plate: formatted,
        plaqueNormalisee: cleanPlate,
        plateNormalized: cleanPlate,
        plateType: getPlateType(cleanPlate),
        validFrenchPlate,
        marque: "",
        modele: "",
        annee: "",
        energie: "",
        motorisation: "",
        typeMine: "",
        kType: "",
        co2: "",
        normeEuro: ""
      }
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      error: error?.message || "Erreur serveur plaque gratuite."
    });
  }
};
