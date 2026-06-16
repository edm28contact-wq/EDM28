const BASKETS = {
  eco: {
    label: "ÉCO",
    description: "Panier budget. Ouvre les liens pièces et sélectionne ton véhicule sur le site marchand.",
    brands: ["Ridex", "Stark", "Bolk", "marque compatible"],
  },
  standard: {
    label: "STANDARD",
    description: "Panier conseillé : bon équilibre prix / fiabilité pour la majorité des véhicules.",
    brands: ["Bosch", "TRW", "Valeo", "Febi", "Meyle"],
  },
  premium: {
    label: "PREMIUM",
    description: "Panier qualité supérieure pour freinage complet, véhicule lourd ou kilométrage élevé.",
    brands: ["ATE", "Brembo", "Lemförder", "SKF", "Textar"],
  },
};

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function getMerchantUrl(partName) {
  const p = String(partName || "").toLowerCase();

  if (p.includes("plaquette")) {
    return "https://www.motointegrator.fr/produits/plaquettes-de-frein-1140102/";
  }

  if (p.includes("disque")) {
    return "https://www.motointegrator.fr/produits/disques-de-frein-1140103/";
  }

  if (p.includes("liquide de frein") || p.includes("dot")) {
    return "https://www.motointegrator.fr/produits/liquides-de-frein-304/";
  }

  if (p.includes("triangle") || p.includes("bras de suspension")) {
    return "https://www.motointegrator.fr/produits/bras-de-suspension-11502/";
  }

  if (p.includes("biellette") || p.includes("stabilisatrice")) {
    return "https://www.motointegrator.fr/produits/biellettes-antiroulis-11514/";
  }

  if (p.includes("rotule") || p.includes("direction")) {
    return "https://www.motointegrator.fr/produits/direction-117/";
  }

  return "https://www.motointegrator.fr/";
}

function serviceToParts(serviceName) {
  const s = String(serviceName || "").toLowerCase();

  if (s.includes("disques") && s.includes("avant")) {
    return ["disques de frein avant", "plaquettes de frein avant"];
  }

  if (s.includes("disques") && s.includes("arrière")) {
    return ["disques de frein arrière", "plaquettes de frein arrière"];
  }

  if (s.includes("plaquettes") && s.includes("avant")) {
    return ["plaquettes de frein avant"];
  }

  if (s.includes("plaquettes") && s.includes("arrière")) {
    return ["plaquettes de frein arrière"];
  }

  if (s.includes("purge") || s.includes("liquide")) {
    return ["liquide de frein DOT 4"];
  }

  if (s.includes("triangle")) {
    return [
      "triangle de suspension avant gauche",
      "triangle de suspension avant droit",
    ];
  }

  if (s.includes("rotule") || s.includes("direction")) {
    return ["rotule de direction gauche", "rotule de direction droite"];
  }

  if (s.includes("biellette") || s.includes("stabilisatrice")) {
    return [
      "biellette de barre stabilisatrice gauche",
      "biellette de barre stabilisatrice droite",
    ];
  }

  return [serviceName || "pièce automobile"];
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function buildSearchText(partName, vehicle, brands) {
  return [
    partName,
    vehicle.brand,
    vehicle.model,
    vehicle.year,
    vehicle.energy,
    vehicle.engine,
    brands.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildFallback(body) {
  const services = Array.isArray(body.services) ? body.services : [];
  const vehicle = body.vehicle || {};

  const partNames = unique(
    services.flatMap((service) => {
      if (typeof service === "string") return serviceToParts(service);
      return serviceToParts(service.name || service.id || "");
    })
  );

  const finalParts = partNames.length ? partNames : ["pièce automobile"];

  const baskets = {};

  for (const basketKey of Object.keys(BASKETS)) {
    const basket = BASKETS[basketKey];

    baskets[basketKey] = {
      label: basket.label,
      description: basket.description,
      brands: basket.brands,
      parts: finalParts.map((name) => ({
        name,
        url: getMerchantUrl(name),
        searchText: buildSearchText(name, vehicle, basket.brands),
      })),
    };
  }

  const mileage = Number(vehicle.mileage || 0);
  const brand = String(vehicle.brand || "").toLowerCase();

  const hasBigJob = finalParts.some((part) => {
    const p = part.toLowerCase();
    return (
      p.includes("disque") ||
      p.includes("triangle") ||
      p.includes("rotule") ||
      p.includes("biellette")
    );
  });

  const premiumBrand = [
    "bmw",
    "mercedes",
    "audi",
    "porsche",
    "volvo",
    "lexus",
    "land rover",
  ].some((name) => brand.includes(name));

  const recommended =
    premiumBrand || mileage >= 180000 || hasBigJob ? "premium" : "standard";

  return {
    success: true,
    ai: false,
    source: "local_no_500",
    recommendation: {
      basket: recommended,
      title: `Panier ${BASKETS[recommended].label} recommandé`,
      explanation:
        "Paniers créés en mode sécurisé local. L'IA peut être ajoutée ensuite, mais le client peut déjà accéder aux liens pièces.",
    },
    warnings: [
      "Sélectionne le véhicule exact sur Motointegrator pour afficher les pièces compatibles.",
      "Contrôle les options proposées par le site marchand : côté gauche/droit, diamètre des disques, témoin d'usure, système de freinage.",
    ],
    baskets,
  };
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      api: "ai-basket",
      message: "Route IA panier active.",
    });
  }

  try {
    const body = getBody(req);
    const fallback = buildFallback(body);

    return res.status(200).json(fallback);
  } catch (error) {
    return res.status(200).json({
      success: true,
      ai: false,
      source: "emergency_fallback",
      recommendation: {
        basket: "standard",
        title: "Panier STANDARD recommandé",
        explanation:
          "Mode secours activé. Les paniers sont générés malgré une erreur serveur.",
      },
      warnings: [
        "Sélectionne le véhicule exact sur Motointegrator pour afficher les pièces compatibles.",
      ],
      baskets: {
        eco: {
          label: "ÉCO",
          description: BASKETS.eco.description,
          brands: BASKETS.eco.brands,
          parts: [],
        },
        standard: {
          label: "STANDARD",
          description: BASKETS.standard.description,
          brands: BASKETS.standard.brands,
          parts: [],
        },
        premium: {
          label: "PREMIUM",
          description: BASKETS.premium.description,
          brands: BASKETS.premium.brands,
          parts: [],
        },
      },
      debug: String(error.message || error),
    });
  }
}
