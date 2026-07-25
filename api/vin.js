import utils from "./utils.cjs";

const { sendJson, sendOptions, readJsonBody, readJsonResponse } = utils;

function normalizeVin(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
}

function pick() {
  for (const value of arguments) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (!["GET", "POST"].includes(req.method)) {
    return sendJson(res, 405, { success: false, error: "Méthode non autorisée." });
  }

  try {
    const body = req.method === "POST" ? await readJsonBody(req) : {};
    const vin = normalizeVin(req.query?.vin || body.vin || "");
    const modelYear = String(req.query?.year || body.year || "").replace(/[^0-9]/g, "").slice(0, 4);

    if (vin.length < 11) {
      return sendJson(res, 400, { success: false, error: "VIN trop court. Entre au moins 11 caractères, idéalement 17." });
    }

    const url = new URL(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}`);
    url.searchParams.set("format", "json");
    if (modelYear) url.searchParams.set("modelyear", modelYear);

    const upstream = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const { json, text } = await readJsonResponse(upstream);

    if (!upstream.ok || !json) {
      return sendJson(res, 502, {
        success: false,
        error: "API VIN gratuite indisponible.",
        preview: String(text || "").slice(0, 180)
      });
    }

    const row = Array.isArray(json.Results) ? json.Results[0] || {} : {};
    const errorText = pick(row.ErrorText);

    return sendJson(res, 200, {
      success: true,
      source: "nhtsa_vpic_free_vin",
      warning: "Décodage VIN gratuit. Ce n'est pas une recherche par plaque et les données peuvent être incomplètes pour certains véhicules européens.",
      vehicle: {
        vin,
        marque: pick(row.Make),
        modele: pick(row.Model),
        annee: pick(row.ModelYear),
        energie: pick(row.FuelTypePrimary, row.FuelTypeSecondary),
        motorisation: [pick(row.DisplacementL) ? `${row.DisplacementL} L` : "", pick(row.EngineConfiguration), pick(row.EngineCylinders) ? `${row.EngineCylinders} cyl.` : ""].filter(Boolean).join(" · "),
        typeMine: "",
        categorie: pick(row.VehicleType),
        genre: pick(row.BodyClass),
        co2: "",
        normeEuro: "",
        errorText
      }
    });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error?.message || "Erreur serveur VIN." });
  }
}
