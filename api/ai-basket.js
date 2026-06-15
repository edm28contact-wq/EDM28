const { sendJson, sendOptions, readJsonBody } = require("./_utils.cjs");

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function moneyNumber(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function vehicleYear(vehicle) {
  const raw = vehicle?.annee || vehicle?.year || String(vehicle?.datePremiereImmatriculation || "").slice(0, 4);
  const year = toNumber(raw, 0);
  const current = new Date().getFullYear();
  return year >= 1970 && year <= current + 1 ? year : null;
}

function vehicleAge(vehicle) {
  const year = vehicleYear(vehicle);
  return year ? new Date().getFullYear() - year : null;
}

function serviceText(service) {
  return `${service?.id || ""} ${service?.name || ""} ${service?.category || ""}`.toLowerCase();
}

function hasAny(services, patterns) {
  return services.some((service) => patterns.some((pattern) => pattern.test(serviceText(service))));
}

function sumPartsRange(services, basket) {
  return services.reduce(
    (acc, service) => {
      const range = service?.parts?.[basket] || [0, 0];
      acc.min += toNumber(range[0], 0);
      acc.max += toNumber(range[1], 0);
      return acc;
    },
    { min: 0, max: 0 }
  );
}

function calculateLabor(services, basketKey, baskets, options) {
  const basket = baskets?.[basketKey] || { extra: 0 };
  const laborBase = services.reduce((sum, service) => sum + toNumber(service.labor, 0), 0);
  const eligible = services.filter((service) => service.eligible && !service.excluded);
  let comboSaving = 0;
  let discountServiceId = "";

  if (eligible.length >= 2) {
    const cheapest = [...eligible].sort((a, b) => toNumber(a.labor, 0) - toNumber(b.labor, 0))[0];
    comboSaving = moneyNumber(toNumber(cheapest.labor, 0) * 0.30);
    discountServiceId = cheapest.id || "";
  }

  const basketExtra = toNumber(basket.extra, 0);
  const totalBefore = laborBase + basketExtra;
  const afterCombo = totalBefore - comboSaving;
  const j7Saving = options?.j7Accepted ? moneyNumber(afterCombo * 0.10) : 0;
  const immobilisation = options?.refuseControl ? 40 : 0;
  const laborAfter = moneyNumber(afterCombo - j7Saving + immobilisation);

  return { laborBase, basketExtra, totalBefore, comboSaving, discountServiceId, j7Saving, immobilisation, laborAfter };
}

function buildServiceNotes(services) {
  return services.map((service) => {
    const text = serviceText(service);
    let riskLevel = "normal";
    let advice = "Vérifier dimensions, montage, accessoires et compatibilité avant achat.";
    let partsToVerify = ["Référence exacte", "Compatibilité véhicule", "Accessoires inclus", "Marque et gamme"];

    if (/triangle|suspension/.test(text)) {
      riskLevel = "élevé";
      advice = "Prévoir contrôle des silentblocs/rotules, vérifier gauche/droite et conseiller un parallélisme après intervention.";
      partsToVerify = ["Côté gauche/droit", "Type de triangle", "Rotule intégrée", "Silentblocs", "Parallélisme après montage"];
    } else if (/direction|rotule|biellette/.test(text)) {
      riskLevel = "élevé";
      advice = "Vérifier filetage, longueur, côté, rotule intérieure/extérieure et conseiller un parallélisme après remplacement.";
      partsToVerify = ["Longueur", "Filetage", "Côté", "Rotule intérieure/extérieure", "Parallélisme"];
    } else if (/disque|disc/.test(text)) {
      riskLevel = /avant et arrière|av_ar/.test(text) ? "élevé" : "normal";
      advice = "Vérifier diamètre, épaisseur, hauteur, nombre de trous, plaquettes compatibles et présence éventuelle de capteur d’usure.";
      partsToVerify = ["Diamètre disque", "Épaisseur", "Nombre de trous", "Capteur usure", "Visserie/accessoires"];
    } else if (/plaquette|plaq/.test(text)) {
      advice = "Vérifier montage exact, forme de plaquette, capteur d’usure et accessoires de pose.";
      partsToVerify = ["Forme plaquette", "Capteur usure", "Accessoires", "Système de freinage"];
    } else if (/purge/.test(text)) {
      riskLevel = "annexe";
      advice = "Prestation hors combo. Vérifier type de liquide et état général du circuit de freinage.";
      partsToVerify = ["Liquide adapté", "État purgeurs", "Niveau", "Fuite éventuelle"];
    }

    return {
      serviceId: String(service.id || ""),
      serviceName: String(service.name || service.id || "Prestation"),
      riskLevel,
      advice,
      partsToVerify
    };
  });
}


const SUPPLIER = Object.freeze({
  name: "Motointegrator",
  homeUrl: "https://pro.motointegrator.fr/",
  publicUrl: "https://www.motointegrator.fr/",
  mode: "semi_automatique_sans_scraping"
});

const CATEGORY_URLS = Object.freeze({
  brakePads: "https://www.motointegrator.fr/produits/plaquettes-de-frein-1140102/",
  brakeDiscs: "https://www.motointegrator.fr/produits/disques-de-frein-1140103/",
  suspensionArm: "https://pro.motointegrator.fr/produits/bras-de-suspension-11502/",
  stabilizerLink: "https://pro.motointegrator.fr/produits/biellettes-antiroulis-11514/",
  steering: "https://pro.motointegrator.fr/produits/direction-117/",
  brakeFluid: "https://www.motointegrator.fr/"
});

const BASKET_BRANDS = Object.freeze({
  eco: { title: "ÉCO", brands: ["marque prix contenu", "FEBI", "MEYLE"], rule: "Choisir compatible et correct, sans viser le haut de gamme." },
  standard: { title: "STANDARD", brands: ["BOSCH", "TRW", "VALEO", "FEBI", "MEYLE"], rule: "Choix recommandé EDM AUTO : bon équilibre prix/fiabilité." },
  premium: { title: "PREMIUM", brands: ["ATE", "BREMBO", "LEMFÖRDER", "TRW", "SKF"], rule: "Priorité qualité, freinage complet, train avant ou véhicule récent/premium." }
});

function vehicleSearchText(vehicle) {
  return [vehicle?.brand || vehicle?.marque, vehicle?.model || vehicle?.modele, vehicle?.year || vehicle?.annee, vehicle?.energy || vehicle?.energie, vehicle?.engine || vehicle?.motorisation || vehicle?.typeMine]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function serviceParts(service) {
  const id = String(service?.id || "");
  const map = {
    FR_PLAQ_AV: [{ label: "Jeu de plaquettes de frein avant", side: "avant", category: "brakePads", checks: ["forme plaquette", "capteur d'usure", "système de freinage", "accessoires"] }],
    FR_PLAQ_AR: [{ label: "Jeu de plaquettes de frein arrière", side: "arrière", category: "brakePads", checks: ["forme plaquette", "frein de stationnement", "capteur d'usure", "accessoires"] }],
    FR_PLAQ_AV_AR: [
      { label: "Jeu de plaquettes de frein avant", side: "avant", category: "brakePads", checks: ["forme plaquette", "capteur d'usure", "accessoires"] },
      { label: "Jeu de plaquettes de frein arrière", side: "arrière", category: "brakePads", checks: ["forme plaquette", "frein de stationnement", "accessoires"] }
    ],
    FR_DISC_PLAQ_AV: [
      { label: "Paire de disques de frein avant", side: "avant", category: "brakeDiscs", checks: ["diamètre", "épaisseur", "hauteur", "nombre de trous", "ventilé/plein"] },
      { label: "Jeu de plaquettes de frein avant", side: "avant", category: "brakePads", checks: ["forme plaquette", "capteur d'usure", "accessoires"] }
    ],
    FR_DISC_PLAQ_AR: [
      { label: "Paire de disques de frein arrière", side: "arrière", category: "brakeDiscs", checks: ["diamètre", "épaisseur", "hauteur", "roulement/ABS intégré", "ventilé/plein"] },
      { label: "Jeu de plaquettes de frein arrière", side: "arrière", category: "brakePads", checks: ["forme plaquette", "frein de stationnement", "accessoires"] }
    ],
    FR_DISC_PLAQ_AV_AR: [
      { label: "Paire de disques de frein avant", side: "avant", category: "brakeDiscs", checks: ["diamètre", "épaisseur", "hauteur", "nombre de trous"] },
      { label: "Jeu de plaquettes de frein avant", side: "avant", category: "brakePads", checks: ["forme plaquette", "capteur d'usure", "accessoires"] },
      { label: "Paire de disques de frein arrière", side: "arrière", category: "brakeDiscs", checks: ["diamètre", "épaisseur", "roulement/ABS intégré"] },
      { label: "Jeu de plaquettes de frein arrière", side: "arrière", category: "brakePads", checks: ["forme plaquette", "frein de stationnement", "accessoires"] }
    ],
    FR_PURGE: [{ label: "Liquide de frein DOT adapté", side: "circuit", category: "brakeFluid", checks: ["DOT 4/DOT 5.1 selon véhicule", "quantité", "purgeurs", "fuite"] }],
    SUS_TRIANGLES: [
      { label: "Triangle / bras de suspension gauche", side: "gauche", category: "suspensionArm", checks: ["côté", "rotule intégrée", "silentblocs", "forme du bras"] },
      { label: "Triangle / bras de suspension droit", side: "droit", category: "suspensionArm", checks: ["côté", "rotule intégrée", "silentblocs", "forme du bras"] }
    ],
    DIR_BIELLETTES_ROTULES: [
      { label: "Rotule de direction gauche/droite", side: "direction", category: "steering", checks: ["filetage", "longueur", "cône", "côté"] },
      { label: "Biellette axiale de direction", side: "direction", category: "steering", checks: ["longueur", "filetage intérieur/extérieur", "côté"] }
    ],
    STAB_BIELLETTES: [{ label: "Biellettes de barre stabilisatrice la paire", side: "gauche + droit", category: "stabilizerLink", checks: ["longueur", "filetage", "forme", "côté si asymétrique"] }]
  };
  return map[id] || [{ label: service?.name || "Pièce automobile", side: "à confirmer", category: "generic", checks: ["référence exacte", "compatibilité", "dimensions"] }];
}

function buildSearchQuery(part, vehicle, basketKey) {
  const profile = BASKET_BRANDS[basketKey] || BASKET_BRANDS.standard;
  return [part.label, vehicleSearchText(vehicle), profile.brands.slice(0, 3).join(" ")]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSupplierBaskets(input, recommendedBasket) {
  const vehicle = input?.vehicle || {};
  const services = Array.isArray(input?.services) ? input.services : [];
  const parts = [];
  const seen = new Set();

  services.forEach((service) => {
    serviceParts(service).forEach((part) => {
      const key = `${part.label}|${part.side}|${part.category}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      parts.push({ ...part, serviceName: service.name || service.id || "Prestation" });
    });
  });

  const makeBasket = (key) => {
    const profile = BASKET_BRANDS[key] || BASKET_BRANDS.standard;
    return {
      title: profile.title,
      supplier: SUPPLIER.name,
      supplierUrl: SUPPLIER.homeUrl,
      mode: SUPPLIER.mode,
      recommended: key === recommendedBasket,
      rule: profile.rule,
      brands: profile.brands,
      parts: parts.map((part) => ({
        serviceName: part.serviceName,
        name: part.label,
        side: part.side,
        brands: profile.brands,
        categoryUrl: CATEGORY_URLS[part.category] || SUPPLIER.homeUrl,
        supplierHomeUrl: SUPPLIER.homeUrl,
        searchQuery: buildSearchQuery(part, vehicle, key),
        checks: part.checks,
        warning: "Lien de recherche, pas une référence validée. EDM AUTO doit vérifier la compatibilité avant achat."
      }))
    };
  };

  return { eco: makeBasket("eco"), standard: makeBasket("standard"), premium: makeBasket("premium") };
}

function createRecommendation(input) {
  const vehicle = input?.vehicle || {};
  const services = Array.isArray(input?.services) ? input.services : [];
  const baskets = input?.basketPrices || {
    eco: { label: "ÉCO", extra: 0 },
    standard: { label: "STANDARD", extra: 15 },
    premium: { label: "PREMIUM", extra: 40 }
  };

  const mileage = toNumber(vehicle.mileage || vehicle.kilometrage || vehicle.kilometrageActuel, 0);
  const age = vehicleAge(vehicle);
  const brand = String(vehicle.marque || vehicle.brand || "").trim();
  const model = String(vehicle.modele || vehicle.model || "").trim();
  const energy = String(vehicle.energie || vehicle.energy || "").trim();
  const engine = String(vehicle.motorisation || vehicle.engine || vehicle.typeMine || "").trim();
  const vehicleName = `${brand} ${model}`.trim();
  const notes = String(input?.notes || "").toLowerCase();

  const trainAvant = hasAny(services, [/train/, /triangle/, /suspension/, /direction/, /rotule/, /biellette/]);
  const freinage = hasAny(services, [/frein/, /plaquette/, /disque/, /purge/]);
  const freinageComplet = hasAny(services, [/disc.*plaq.*av.*ar/, /avant et arrière/, /av_ar/]);
  const purgeOnly = services.length === 1 && hasAny(services, [/purge/]);
  const premiumVehicle = /BMW|MERCEDES|AUDI|LEXUS|VOLVO|TESLA|PORSCHE|LAND ROVER|JAGUAR|ALFA ROMEO|CUPRA/i.test(`${brand} ${model}`);
  const heavyOrRecent = (age !== null && age <= 7) || /SUV|HYBRIDE|ELECTRIQUE|TESLA|4X4|CROSSOVER/i.test(`${vehicleName} ${energy} ${engine}`);
  const oldVehicle = age !== null && age >= 13;
  const veryHighMileage = mileage >= 190000;
  const highMileage = mileage >= 150000;
  const lowMileage = mileage > 0 && mileage <= 85000;
  const clientBudget = /budget|pas cher|moins cher|eco|éco|minimum|limite/.test(notes);
  const clientQuality = /premium|qualité|qualite|durable|longtemps|autoroute|sécurité|securite|meilleur/.test(notes);

  const scores = {
    eco: 50,
    standard: 72,
    premium: 58
  };

  const reasons = { eco: [], standard: [], premium: [] };

  if (clientBudget) { scores.eco += 18; scores.standard += 5; scores.premium -= 8; reasons.eco.push("budget client prioritaire"); }
  if (clientQuality) { scores.premium += 24; scores.standard += 8; reasons.premium.push("priorité qualité/durabilité exprimée"); }
  if (premiumVehicle) { scores.premium += 22; scores.standard += 8; scores.eco -= 12; reasons.premium.push("véhicule premium"); }
  if (heavyOrRecent) { scores.premium += 15; scores.standard += 7; scores.eco -= 6; reasons.premium.push("véhicule récent, lourd ou technique"); }
  if (oldVehicle && highMileage && !premiumVehicle) { scores.eco += 10; scores.standard += 6; scores.premium -= 6; reasons.eco.push("véhicule âgé/kilométré"); }
  if (veryHighMileage && !trainAvant && !freinageComplet) { scores.eco += 10; reasons.eco.push("kilométrage élevé avec prestation simple"); }
  if (lowMileage && freinageComplet) { scores.premium += 12; scores.standard += 8; reasons.premium.push("véhicule peu kilométré avec freinage complet"); }
  if (freinageComplet) { scores.premium += 15; scores.standard += 10; scores.eco -= 8; reasons.premium.push("freinage complet"); }
  if (trainAvant) { scores.premium += 12; scores.standard += 12; scores.eco -= 6; reasons.standard.push("train avant à sécuriser"); }
  if (freinage && !freinageComplet) { scores.standard += 8; reasons.standard.push("freinage courant : équilibre prix/fiabilité"); }
  if (purgeOnly) { scores.standard += 8; scores.eco += 4; scores.premium -= 10; reasons.standard.push("purge seule : panier simple suffisant"); }
  if (services.length >= 3) { scores.standard += 6; scores.premium += 8; reasons.standard.push("plusieurs prestations regroupées"); }

  Object.keys(scores).forEach((key) => { scores[key] = clamp(scores[key], 0, 100); });

  const recommendedBasket = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const confidence = moneyNumber(clamp(Math.max(...Object.values(scores)) / 100, 0.55, 0.93));
  const ranges = {
    eco: sumPartsRange(services, "eco"),
    standard: sumPartsRange(services, "standard"),
    premium: sumPartsRange(services, "premium")
  };
  const totals = {
    eco: calculateLabor(services, "eco", baskets, input),
    standard: calculateLabor(services, "standard", baskets, input),
    premium: calculateLabor(services, "premium", baskets, input)
  };

  const genericWarning = "Les paniers préparent la gamme de pièces, mais EDM AUTO doit valider les références exactes avant achat : plaque, VIN si disponible, type mine, dimensions et montage réel.";

  const position = (key) => key === recommendedBasket ? "recommandé" : key === "standard" ? "très conseillé" : "possible";
  const scoreText = (key) => `${scores[key]}/100`;

  const basketsOut = {
    eco: {
      title: "ÉCO",
      position: position("eco"),
      score: scores.eco,
      why: reasons.eco.length
        ? `Choix budget cohérent car ${reasons.eco.join(", ")}. À garder seulement si les références sont propres et compatibles.`
        : "Solution budget pour contenir la dépense, adaptée aux prestations simples ou véhicules à faible valeur d’usage.",
      estimatedPartsMin: ranges.eco.min,
      estimatedPartsMax: ranges.eco.max,
      estimatedLaborAfter: totals.eco.laborAfter,
      pros: ["Budget le plus bas", "Simple à expliquer au client", "Suffisant sur prestation basique"],
      cons: ["Durabilité parfois inférieure", "Moins recommandé sur freinage complet, train avant ou véhicule lourd", "Choix de marques à contrôler"],
      referencesToVerify: ["Plaque", "Type mine / TVV", "Dimensions", "Montage exact", "Accessoires inclus"],
      warning: `${genericWarning} Score ÉCO : ${scoreText("eco")}.`
    },
    standard: {
      title: "STANDARD",
      position: position("standard"),
      score: scores.standard,
      why: reasons.standard.length
        ? `Meilleur équilibre car ${reasons.standard.join(", ")}. C’est le choix par défaut EDM AUTO.`
        : "Meilleur équilibre prix/fiabilité. C’est le choix par défaut pour limiter les retours et les erreurs de gamme.",
      estimatedPartsMin: ranges.standard.min,
      estimatedPartsMax: ranges.standard.max,
      estimatedLaborAfter: totals.standard.laborAfter,
      pros: ["Équilibre prix/fiabilité", "Recommandé par défaut", "Limite les mauvaises surprises au montage"],
      cons: ["Plus cher que ÉCO", "Pas toujours nécessaire sur un véhicule très ancien avec budget serré"],
      referencesToVerify: ["Marque/modèle exact", "Année", "Énergie", "Type mine", "Options de freinage/direction"],
      warning: `${genericWarning} Score STANDARD : ${scoreText("standard")}.`
    },
    premium: {
      title: "PREMIUM",
      position: position("premium"),
      score: scores.premium,
      why: reasons.premium.length
        ? `Conseillé pour sécuriser la qualité car ${reasons.premium.join(", ")}.`
        : "Option qualité pour privilégier durée de vie, confort, usage intensif ou marques supérieures.",
      estimatedPartsMin: ranges.premium.min,
      estimatedPartsMax: ranges.premium.max,
      estimatedLaborAfter: totals.premium.laborAfter,
      pros: ["Meilleure qualité perçue", "Plus rassurant sur freinage complet et train avant", "Adapté véhicules récents/premium"],
      cons: ["Budget plus élevé", "Pas toujours utile sur prestation simple"],
      referencesToVerify: ["VIN si disponible", "Type mine", "Motorisation", "Diamètre/épaisseur disque", "Équipementier de freinage"],
      warning: `${genericWarning} Score PREMIUM : ${scoreText("premium")}.`
    }
  };

  return {
    success: true,
    source: "regles_locales_edm_v8_motointegrator",
    recommendation: {
      recommendedBasket,
      confidence,
      vehicleSummary: `${vehicleName || "Véhicule non précisé"}${energy ? " · " + energy : ""}${mileage ? " · " + mileage.toLocaleString("fr-FR") + " km" : ""}`.trim(),
      safetyNotice: "Le panier aide le client à choisir une gamme de pièces. EDM AUTO garde la validation humaine finale avant achat et avant montage.",
      basketScores: scores,
      totals,
      baskets: basketsOut,
      supplierBaskets: buildSupplierBaskets(input, recommendedBasket),
      serviceNotes: buildServiceNotes(services),
      nextQuestions: [
        "Le client veut-il surtout le prix, la durée de vie ou le confort ?",
        "Le véhicule roule-t-il beaucoup, chargé, sur autoroute ou en ville ?",
        "Le contrôle J-7 est-il accepté pour sécuriser les références ?",
        "Le VIN ou le type mine est-il disponible pour éviter une erreur de pièces ?"
      ]
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (req.method !== "POST") return sendJson(res, 405, { success: false, error: "Méthode non autorisée." });

  try {
    const input = await readJsonBody(req);
    const services = Array.isArray(input.services) ? input.services : [];
    if (!services.length) return sendJson(res, 400, { success: false, error: "Aucune prestation sélectionnée." });

    return sendJson(res, 200, createRecommendation(input));
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      error: "Erreur génération paniers.",
      details: error?.message || String(error)
    });
  }
};
