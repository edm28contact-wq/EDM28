export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const query = new URL(req.url || '/', 'https://edm28.fr').searchParams;
  const plate = String(req.query?.plate || req.query?.immatriculation || query.get('plate') || query.get('immatriculation') || "")
    .trim()
    .toUpperCase();

  if (!plate) {
    return res.status(400).json({
      success: false,
      error: "Plaque manquante.",
    });
  }

  return res.status(200).json({
    success: true,
    source: "manual_mode",
    manualRequired: true,
    vehicle: {
      plate,
      marque: "",
      modele: "",
      annee: "",
      energie: "",
      motorisation: "",
    },
    message:
      "API plaque en pause. Le client complète les informations véhicule manuellement.",
  });
}
