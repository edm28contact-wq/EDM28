function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (req.body && typeof req.body === "string") return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
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
    return "https://www.motointegrator.fr/";
  }

  if (
    p.includes("triangle") ||
    p.includes("bras de suspension") ||
    p.includes("suspension")
  ) {
    return "https://www.motointegrator.fr/";
  }

  if (
    p.includes("rotule") ||
    p.includes("direction") ||
    p.includes("biellette")
  ) {
    return "https://www.motointegrator.fr/";
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
      "triangle de suspension avant droit"
    ];
  }

  if (s.includes("rotule") || s.includes("direction")) {
    return ["rotule de direction gauche", "rotule de direction droite"];
  }

  if (s.includes("biellette") || s.includes("stabilisatrice")) {
    return [
      "biellette de barre stabilisatrice gauche",
      "biellette de barre stabilisatrice droite"
    ];
  }

  return [serviceName];
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function buildFallbackBasket(body) {
  const services = body.services || [];
  const vehicle = body.vehicle || {};

  const partNames = unique(
    services.flatMap((service) => {
      if (typeof service === "string") return serviceToParts(service);
      return serviceToParts(service.name || service.id || "");
    })
  );

  const partLinks = partNames.map((name) => ({
    name,
    url: getMerchantUrl(name),
    searchText: [
      name,
      vehicle.brand,
      vehicle.model,
      vehicle.year,
      vehicle.energy,
      vehicle.engine
    ]
      .filter(Boolean)
      .join(" ")
  }));

  const mileage = Number(vehicle.mileage || 0);
  const brand = String(vehicle.brand || "").toLowerCase();
  const hasBrakeFull = partNames.some((p) => p.includes("disques"));
  const hasTrainAvant = partNames.some(
    (p) => p.includes("triangle") || p.includes("rotule") || p.includes("biellette")
  );

  const premiumBrand = [
    "bmw",
    "mercedes",
    "audi",
    "porsche",
    "volvo",
    "lexus",
    "land rover"
  ].some((b) => brand.includes(b));

  const recommended =
    premiumBrand || mileage >= 180000 || hasBrakeFull || hasTrainAvant
      ? "premium"
      : "standard";

  return {
    success: true,
    ai: false,
    source: "fallback_local",
    recommendation: {
      basket: recommended,
      title:
        recommended === "premium"
          ? "Panier PREMIUM recommandé"
          : "Panier STANDARD recommandé",
      explanation:
        "Recommandation locale EDM AUTO. Active OPENAI_API_KEY pour l'analyse IA complète."
    },
    warnings: [
      "Compatibilité à valider avec VIN, type mine ou carte grise avant achat.",
      "Vérifier diamètre des disques, côté gauche/droit, système de freinage et témoin d'usure."
    ],
    baskets: {
      eco: {
        label: "ÉCO",
        description: "Budget serré, pièces compatibles à valider.",
        brands: ["Ridex", "Stark", "Bolk", "marque compatible"],
        parts: partLinks
      },
      standard: {
        label: "STANDARD",
        description: "Équilibre prix / fiabilité, conseillé EDM AUTO.",
        brands: ["Bosch", "TRW", "Valeo", "Febi", "Meyle"],
        parts: partLinks
      },
      premium: {
        label: "PREMIUM",
        description: "Qualité supérieure pour freinage complet ou véhicule sensible.",
        brands: ["ATE", "Brembo", "Lemförder", "SKF", "Textar"],
        parts: partLinks
      }
    }
  };
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  const first = data.output?.find?.((item) => item.type === "message");
  const text = first?.content?.find?.((c) => c.type === "output_text")?.text;

  return text || "";
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      api: "ai-basket",
      message: "Route IA panier active. Utilise POST pour générer les paniers."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée. Utilise POST."
    });
  }

  try {
    const body = await readBody(req);
    const fallback = buildFallbackBasket(body);

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return res.status(200).json(fallback);
    }

    const systemPrompt = `
Tu es l'assistant pièces d'EDM AUTO, garage orienté freinage et train avant.

Objectif:
- analyser le véhicule et les prestations demandées;
- préparer les paniers ÉCO, STANDARD, PREMIUM;
- proposer les familles de pièces à chercher;
- donner des liens marchands Motointegrator déjà fournis;
- ne jamais inventer une référence exacte si le VIN/type mine manque;
- toujours recommander une validation EDM AUTO avant achat.

Tu dois répondre uniquement en JSON valide.
`;

    const userPayload = {
      vehicle: body.vehicle || {},
      services: body.services || [],
      fallbackParts: fallback.baskets.standard.parts,
      allowedBaskets: ["eco", "standard", "premium"],
      merchant: "Motointegrator",
      fixedMerchantLinks: fallback.baskets.standard.parts
    };

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content:
              "Crée les paniers pièces EDM AUTO au format JSON strict pour cette demande: " +
              JSON.stringify(userPayload)
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        },
        max_output_tokens: 2200
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(200).json({
        ...fallback,
        openaiError: data.error?.message || "Erreur OpenAI inconnue"
      });
    }

    const outputText = extractOutputText(data);

    let aiJson;
    try {
      aiJson = JSON.parse(outputText);
    } catch {
      return res.status(200).json({
        ...fallback,
        openaiError: "L'IA n'a pas renvoyé un JSON lisible."
      });
    }

    const merged = {
      ...fallback,
      ...aiJson,
      success: true,
      ai: true,
      source: "openai",
      baskets: {
        eco: {
          ...fallback.baskets.eco,
          ...(aiJson.baskets?.eco || {}),
          parts: fallback.baskets.eco.parts
        },
        standard: {
          ...fallback.baskets.standard,
          ...(aiJson.baskets?.standard || {}),
          parts: fallback.baskets.standard.parts
        },
        premium: {
          ...fallback.baskets.premium,
          ...(aiJson.baskets?.premium || {}),
          parts: fallback.baskets.premium.parts
        }
      }
    };

    return res.status(200).json(merged);
  } catch (error) {
    return res.status(200).json({
      success: false,
      ai: false,
      error: "Erreur dans api/ai-basket.js",
      details: error.message || String(error)
    });
  }
}
