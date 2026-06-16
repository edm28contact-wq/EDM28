import { useMemo, useState } from "react";

const SERVICES = [
  {
    id: "plaquettes_av",
    name: "Plaquettes de frein avant",
    category: "Freinage",
    labor: 69,
    parts: { eco: [30, 50], standard: [40, 70], premium: [65, 95] },
    neededParts: ["plaquettes de frein avant"],
  },
  {
    id: "plaquettes_ar",
    name: "Plaquettes de frein arrière",
    category: "Freinage",
    labor: 69,
    parts: { eco: [30, 50], standard: [40, 70], premium: [65, 95] },
    neededParts: ["plaquettes de frein arrière"],
  },
  {
    id: "disques_plaquettes_av",
    name: "Disques + plaquettes avant",
    category: "Freinage",
    labor: 99,
    parts: { eco: [95, 135], standard: [120, 170], premium: [170, 240] },
    neededParts: ["disques de frein avant", "plaquettes de frein avant"],
  },
  {
    id: "disques_plaquettes_ar",
    name: "Disques + plaquettes arrière",
    category: "Freinage",
    labor: 99,
    parts: { eco: [90, 130], standard: [115, 160], premium: [160, 230] },
    neededParts: ["disques de frein arrière", "plaquettes de frein arrière"],
  },
  {
    id: "purge_frein",
    name: "Purge liquide de frein",
    category: "Freinage",
    labor: 55,
    parts: { eco: [10, 20], standard: [15, 25], premium: [20, 35] },
    neededParts: ["liquide de frein DOT 4"],
  },
  {
    id: "triangles",
    name: "Triangles de suspension la paire",
    category: "Train avant",
    labor: 120,
    parts: { eco: [80, 130], standard: [120, 190], premium: [180, 280] },
    neededParts: [
      "triangle de suspension avant gauche",
      "triangle de suspension avant droit",
    ],
  },
  {
    id: "rotules_direction",
    name: "Biellettes / rotules de direction la paire",
    category: "Train avant",
    labor: 70,
    parts: { eco: [35, 70], standard: [55, 95], premium: [85, 140] },
    neededParts: ["rotule de direction gauche", "rotule de direction droite"],
  },
  {
    id: "biellettes_stab",
    name: "Biellettes de barre stabilisatrice la paire",
    category: "Train avant",
    labor: 50,
    parts: { eco: [25, 45], standard: [35, 60], premium: [55, 90] },
    neededParts: [
      "biellette de barre stabilisatrice gauche",
      "biellette de barre stabilisatrice droite",
    ],
  },
];

const BASKETS = {
  eco: {
    label: "ÉCO",
    subtitle: "Prix contenu",
    brands: ["Ridex", "Stark", "Bolk", "marque compatible"],
    advice:
      "Panier budget. Le client ouvre les liens marchands et sélectionne les pièces avec son véhicule.",
  },
  standard: {
    label: "STANDARD",
    subtitle: "Recommandé EDM AUTO",
    brands: ["Bosch", "TRW", "Valeo", "Febi", "Meyle"],
    advice:
      "Panier conseillé : bon équilibre prix / fiabilité pour la majorité des véhicules.",
  },
  premium: {
    label: "PREMIUM",
    subtitle: "Qualité supérieure",
    brands: ["ATE", "Brembo", "Lemförder", "SKF", "Textar"],
    advice:
      "Panier qualité supérieure pour freinage complet, véhicule lourd ou kilométrage élevé.",
  },
};

function euro(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function App() {
  const [client, setClient] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  const [vehicle, setVehicle] = useState({
    plate: "",
    brand: "",
    model: "",
    year: "",
    energy: "",
    engine: "",
    mileage: "",
  });

  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedBasket, setSelectedBasket] = useState("standard");
  const [j7Accepted, setJ7Accepted] = useState(true);
  const [refuseControl, setRefuseControl] = useState(false);
  const [basketsCreated, setBasketsCreated] = useState(false);
  const [aiBasketResult, setAiBasketResult] = useState(null);
  const [message, setMessage] = useState("");

  const selectedServiceObjects = useMemo(() => {
    return SERVICES.filter((service) => selectedServices.includes(service.id));
  }, [selectedServices]);

  const currentTotal = useMemo(() => {
    return calculateForBasket(selectedBasket);
  }, [selectedBasket, selectedServiceObjects, j7Accepted, refuseControl]);

  const basketTotals = useMemo(() => {
    return {
      eco: calculateForBasket("eco"),
      standard: calculateForBasket("standard"),
      premium: calculateForBasket("premium"),
    };
  }, [selectedServiceObjects, j7Accepted, refuseControl]);

  function updateClient(field, value) {
    setClient((prev) => ({ ...prev, [field]: value }));
  }

  function updateVehicle(field, value) {
    setVehicle((prev) => ({ ...prev, [field]: value }));
  }

  function toggleService(serviceId) {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }

      return [...prev, serviceId];
    });

    setBasketsCreated(false);
    setAiBasketResult(null);
  }

  function calculateForBasket(basketKey) {
    const safeBasketKey = BASKETS[basketKey] ? basketKey : "standard";

    const laborBase = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.labor;
    }, 0);

    const partsMin = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[safeBasketKey][0];
    }, 0);

    const partsMax = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[safeBasketKey][1];
    }, 0);

    const eligible = selectedServiceObjects.filter(
      (service) => service.id !== "purge_frein"
    );

    let comboSaving = 0;

    if (eligible.length >= 2) {
      const cheapest = [...eligible].sort((a, b) => a.labor - b.labor)[0];
      comboSaving = Math.round(cheapest.labor * 0.3 * 100) / 100;
    }

    const afterCombo = laborBase - comboSaving;
    const j7Saving = j7Accepted ? Math.round(afterCombo * 0.1 * 100) / 100 : 0;
    const immobilisation = refuseControl ? 40 : 0;
    const laborAfter = Math.max(0, afterCombo - j7Saving + immobilisation);

    return {
      laborBase,
      comboSaving,
      j7Saving,
      immobilisation,
      laborAfter,
      partsMin,
      partsMax,
      totalMin: laborAfter + partsMin,
      totalMax: laborAfter + partsMax,
    };
  }

  function recommendBasket() {
    const mileage = Number(vehicle.mileage || 0);
    const year = Number(vehicle.year || 0);
    const currentYear = new Date().getFullYear();
    const age = year ? currentYear - year : 0;
    const brand = vehicle.brand.toLowerCase();

    const hasBigBrakeJob = selectedServiceObjects.some((service) =>
      service.id.includes("disques")
    );

    const hasTrainAvant = selectedServiceObjects.some(
      (service) => service.category === "Train avant"
    );

    const premiumBrand = [
      "bmw",
      "mercedes",
      "audi",
      "volvo",
      "lexus",
      "porsche",
      "jaguar",
      "land rover",
    ].some((name) => brand.includes(name));

    if (premiumBrand || mileage >= 180000 || hasBigBrakeJob || hasTrainAvant) {
      return "premium";
    }

    if (age >= 12 && mileage >= 130000) {
      return "standard";
    }

    return "standard";
  }

  function normalizeBasketKey(value) {
    const key = String(value || "").toLowerCase();

    if (BASKETS[key]) {
      return key;
    }

    return recommendBasket();
  }

  function getNeededParts() {
    const parts = [];

    selectedServiceObjects.forEach((service) => {
      service.neededParts.forEach((part) => {
        if (!parts.includes(part)) {
          parts.push(part);
        }
      });
    });

    return parts;
  }

  function getMerchantUrl(part) {
    const p = String(part || "").toLowerCase();

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

  function buildSearchText(part, basketKey) {
    const safeBasketKey = BASKETS[basketKey] ? basketKey : "standard";
    const brands = BASKETS[safeBasketKey].brands.slice(0, 3).join(" ");

    return [
      part,
      vehicle.brand,
      vehicle.model,
      vehicle.year,
      vehicle.energy,
      vehicle.engine,
      brands,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getPartsForBasket(basketKey) {
    const aiParts = aiBasketResult?.baskets?.[basketKey]?.parts;

    if (Array.isArray(aiParts) && aiParts.length > 0) {
      return aiParts.map((part) => {
        const partName = part.name || part.part || "Pièce à chercher";

        return {
          name: partName,
          url: part.url || getMerchantUrl(partName),
          searchText: part.searchText || buildSearchText(partName, basketKey),
        };
      });
    }

    return getNeededParts().map((part) => ({
      name: part,
      url: getMerchantUrl(part),
      searchText: buildSearchText(part, basketKey),
    }));
  }

  function getBasketDirectUrl(basketKey) {
    const parts = getPartsForBasket(basketKey);

    if (!parts.length) {
      return "https://www.motointegrator.fr/";
    }

    if (parts.length === 1) {
      return parts[0].url;
    }

    return "https://www.motointegrator.fr/";
  }

  function openBasketLinks(basketKey) {
    const parts = getPartsForBasket(basketKey);
    const urls = Array.from(new Set(parts.map((part) => part.url)));

    if (!urls.length) {
      window.open("https://www.motointegrator.fr/", "_blank", "noreferrer");
      return;
    }

    urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, "_blank", "noreferrer");
      }, index * 250);
    });

    setMessage(
      `Ouverture des liens du panier ${BASKETS[basketKey].label}. Si ton navigateur bloque les fenêtres, utilise les boutons bleus un par un.`
    );
  }

  function buildLocalAiResult(recommended) {
    const warnings = [
      "Sélectionne le véhicule exact sur Motointegrator pour afficher les pièces compatibles.",
      "Contrôle les options proposées par le site marchand : côté gauche/droit, diamètre des disques, témoin d'usure, système de freinage.",
    ];

    return {
      success: true,
      ai: false,
      source: "local",
      recommendation: {
        basket: recommended,
        title: `Panier ${BASKETS[recommended].label} recommandé`,
        explanation:
          "Recommandation locale EDM AUTO. L'IA serveur n'a pas répondu ou n'est pas encore configurée.",
      },
      warnings,
      baskets: {
        eco: {
          label: "ÉCO",
          description: BASKETS.eco.advice,
          brands: BASKETS.eco.brands,
          parts: getNeededParts().map((part) => ({
            name: part,
            url: getMerchantUrl(part),
            searchText: buildSearchText(part, "eco"),
          })),
        },
        standard: {
          label: "STANDARD",
          description: BASKETS.standard.advice,
          brands: BASKETS.standard.brands,
          parts: getNeededParts().map((part) => ({
            name: part,
            url: getMerchantUrl(part),
            searchText: buildSearchText(part, "standard"),
          })),
        },
        premium: {
          label: "PREMIUM",
          description: BASKETS.premium.advice,
          brands: BASKETS.premium.brands,
          parts: getNeededParts().map((part) => ({
            name: part,
            url: getMerchantUrl(part),
            searchText: buildSearchText(part, "premium"),
          })),
        },
      },
    };
  }

  async function createBaskets() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation avant de créer les paniers.");
      return;
    }

    setMessage("Création des paniers IA en cours...");
    setAiBasketResult(null);

    try {
      const response = await fetch("/api/ai-basket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client,
          vehicle,
          services: selectedServiceObjects,
          selectedBasket,
          j7Accepted,
          refuseControl,
        }),
      });

      const text = await response.text();

      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Réponse IA non JSON : " + text.slice(0, 120));
      }

      if (!result.success) {
        throw new Error(
          result.error || "Erreur pendant la création des paniers IA."
        );
      }

      const recommended = normalizeBasketKey(result.recommendation?.basket);

      setSelectedBasket(recommended);
      setBasketsCreated(true);
      setAiBasketResult(result);

      setMessage(
        result.ai
          ? `Paniers créés par l'IA. Recommandation : ${BASKETS[recommended].label}.`
          : `Paniers créés en secours local. Recommandation : ${BASKETS[recommended].label}.`
      );
    } catch (error) {
      const recommended = recommendBasket();
      const localResult = buildLocalAiResult(recommended);

      setSelectedBasket(recommended);
      setBasketsCreated(true);
      setAiBasketResult(localResult);

      setMessage(
        "L'API IA n'a pas répondu, mais les paniers locaux sont créés. Erreur : " +
          error.message
      );
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Recherche copiée. Colle-la dans Motointegrator.");
    } catch {
      setMessage("Copie impossible automatiquement. Sélectionne le texte à la main.");
    }
  }

  async function prepareRequest() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation.");
      return;
    }

    if (!client.firstName || !client.lastName || !client.phone || !client.email) {
      setMessage("Complète les informations client avant d'envoyer la demande.");
      return;
    }

    if (!vehicle.plate || !vehicle.brand || !vehicle.model) {
      setMessage("Complète au minimum la plaque, la marque et le modèle du véhicule.");
      return;
    }

    const request = {
      client,
      vehicle,
      services: selectedServiceObjects.map((service) => service.name),
      basket: selectedBasket,
      totalMainOeuvre: currentTotal.laborAfter,
      totalPiecesMin: currentTotal.partsMin,
      totalPiecesMax: currentTotal.partsMax,
      totalMin: currentTotal.totalMin,
      totalMax: currentTotal.totalMax,
      j7Accepted,
      refuseControl,
      aiBasketResult,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("edm_auto_last_request", JSON.stringify(request));

    setMessage("Envoi de la demande à EDM AUTO...");

    try {
      const response = await fetch("/api/submit-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const text = await response.text();

      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Réponse serveur non JSON : " + text.slice(0, 120));
      }

      if (!response.ok || !result.success) {
        setMessage(
          result.error ||
            "La demande n'a pas été envoyée. Vérifie la configuration Vercel."
        );
        return;
      }

      setMessage("Demande envoyée à EDM AUTO. Elle sera vérifiée avant confirmation.");
    } catch (error) {
      setMessage(
        "Demande sauvegardée localement, mais pas envoyée au serveur : " +
          error.message
      );
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>EDM AUTO · Mécano du Dimanche</p>
        <h1 style={styles.title}>Préparer mon RDV</h1>
        <p style={styles.lead}>
          Le client renseigne son véhicule, choisit les prestations, puis le site
          crée les paniers pièces ÉCO / STANDARD / PREMIUM avec total main-d’œuvre
          + pièces et liens marchands.
        </p>
      </section>

      <section style={styles.card}>
        <h2>1. Client</h2>

        <div style={styles.grid}>
          <label style={styles.label}>
            Prénom
            <input
              style={styles.input}
              value={client.firstName}
              onChange={(e) => updateClient("firstName", e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Nom
            <input
              style={styles.input}
              value={client.lastName}
              onChange={(e) => updateClient("lastName", e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Téléphone
            <input
              style={styles.input}
              value={client.phone}
              onChange={(e) => updateClient("phone", e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={client.email}
              onChange={(e) => updateClient("email", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2>2. Véhicule</h2>
        <p style={styles.muted}>
          API plaque en pause pour l’instant. Le client remplit les infos à la main.
        </p>

        <div style={styles.grid}>
          <label style={styles.label}>
            Plaque
            <input
              style={styles.input}
              value={vehicle.plate}
              onChange={(e) =>
                updateVehicle("plate", e.target.value.toUpperCase())
              }
              placeholder="AA-123-BB"
            />
          </label>

          <label style={styles.label}>
            Marque
            <input
              style={styles.input}
              value={vehicle.brand}
              onChange={(e) => updateVehicle("brand", e.target.value)}
              placeholder="Peugeot"
            />
          </label>

          <label style={styles.label}>
            Modèle
            <input
              style={styles.input}
              value={vehicle.model}
              onChange={(e) => updateVehicle("model", e.target.value)}
              placeholder="308"
            />
          </label>

          <label style={styles.label}>
            Année
            <input
              style={styles.input}
              value={vehicle.year}
              onChange={(e) => updateVehicle("year", e.target.value)}
              placeholder="2018"
            />
          </label>

          <label style={styles.label}>
            Énergie
            <input
              style={styles.input}
              value={vehicle.energy}
              onChange={(e) => updateVehicle("energy", e.target.value)}
              placeholder="Diesel"
            />
          </label>

          <label style={styles.label}>
            Motorisation
            <input
              style={styles.input}
              value={vehicle.engine}
              onChange={(e) => updateVehicle("engine", e.target.value)}
              placeholder="1.6 BlueHDi"
            />
          </label>

          <label style={styles.label}>
            Kilométrage
            <input
              style={styles.input}
              value={vehicle.mileage}
              onChange={(e) => updateVehicle("mileage", e.target.value)}
              placeholder="145000"
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2>3. Prestations</h2>

        <div style={styles.services}>
          {SERVICES.map((service) => {
            const checked = selectedServices.includes(service.id);

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                style={{
                  ...styles.serviceButton,
                  borderColor: checked ? "#111827" : "#e5e7eb",
                  background: checked ? "#f3f4f6" : "#ffffff",
                }}
              >
                <span>
                  <strong>{service.name}</strong>
                  <br />
                  <small>
                    {service.category} · Main-d’œuvre {euro(service.labor)}
                  </small>
                </span>

                <span>{checked ? "✓" : "+"}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.checks}>
          <label>
            <input
              type="checkbox"
              checked={j7Accepted}
              onChange={(e) => setJ7Accepted(e.target.checked)}
            />{" "}
            Contrôle J-7 accepté : remise 10 % sur main-d’œuvre
          </label>

          <label>
            <input
              type="checkbox"
              checked={refuseControl}
              onChange={(e) => setRefuseControl(e.target.checked)}
            />{" "}
            Refus contrôle J-7 : forfait immobilisation 40 €
          </label>
        </div>

        <button type="button" style={styles.primaryButton} onClick={createBaskets}>
          Créer les paniers pièces IA
        </button>
      </section>

      <section style={styles.card}>
        <h2>4. Résumé total</h2>

        <div style={styles.summary}>
          <div style={styles.summaryLine}>
            <span>Main-d’œuvre avant remise</span>
            <strong>{euro(currentTotal.laborBase)}</strong>
          </div>

          <div style={styles.summaryLine}>
            <span>Avantage combo</span>
            <strong>-{euro(currentTotal.comboSaving)}</strong>
          </div>

          <div style={styles.summaryLine}>
            <span>Remise contrôle J-7</span>
            <strong>-{euro(currentTotal.j7Saving)}</strong>
          </div>

          {currentTotal.immobilisation > 0 && (
            <div style={styles.summaryLine}>
              <span>Forfait immobilisation</span>
              <strong>+{euro(currentTotal.immobilisation)}</strong>
            </div>
          )}

          <div style={styles.summaryLine}>
            <span>Pièces estimées panier {BASKETS[selectedBasket].label}</span>
            <strong>
              {euro(currentTotal.partsMin)} à {euro(currentTotal.partsMax)}
            </strong>
          </div>

          <div style={styles.totalLine}>
            <span>Total main-d’œuvre + pièces</span>
            <strong>
              {euro(currentTotal.totalMin)} à {euro(currentTotal.totalMax)}
            </strong>
          </div>
        </div>
      </section>

      {basketsCreated && (
        <section style={styles.card}>
          <h2>5. Paniers pièces</h2>

          {aiBasketResult?.recommendation?.explanation && (
            <div style={styles.aiBox}>
              <strong>Analyse IA :</strong>
              <br />
              {aiBasketResult.recommendation.explanation}
            </div>
          )}

          {Array.isArray(aiBasketResult?.warnings) &&
            aiBasketResult.warnings.length > 0 && (
              <div style={styles.warning}>
                <strong>À faire sur le site marchand :</strong>
                <ul>
                  {aiBasketResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

          <div style={styles.basketGrid}>
            {Object.keys(BASKETS).map((basketKey) => {
              const basket = BASKETS[basketKey];
              const total = basketTotals[basketKey];
              const recommended =
                basketKey ===
                normalizeBasketKey(
                  aiBasketResult?.recommendation?.basket || recommendBasket()
                );
              const aiDescription =
                aiBasketResult?.baskets?.[basketKey]?.description || basket.advice;
              const aiBrands =
                aiBasketResult?.baskets?.[basketKey]?.brands || basket.brands;
              const parts = getPartsForBasket(basketKey);

              return (
                <div
                  key={basketKey}
                  style={{
                    ...styles.basketCard,
                    borderColor:
                      selectedBasket === basketKey ? "#111827" : "#e5e7eb",
                  }}
                >
                  <h3>
                    {basket.label} {recommended ? "⭐" : ""}
                  </h3>

                  <p style={styles.muted}>{basket.subtitle}</p>

                  <p>
                    <strong>Total estimé :</strong>
                    <br />
                    {euro(total.totalMin)} à {euro(total.totalMax)}
                  </p>

                  <p>
                    <strong>Marques conseillées :</strong>
                    <br />
                    {Array.isArray(aiBrands) ? aiBrands.join(", ") : aiBrands}
                  </p>

                  <p style={styles.warning}>{aiDescription}</p>

                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setSelectedBasket(basketKey)}
                  >
                    Choisir ce panier
                  </button>

                  <a
                    href={getBasketDirectUrl(basketKey)}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.basketDirectButton}
                  >
                    Ouvrir le panier {basket.label} sur Motointegrator
                  </a>

                  <button
                    type="button"
                    style={styles.openAllButton}
                    onClick={() => openBasketLinks(basketKey)}
                  >
                    Ouvrir tous les liens du panier {basket.label}
                  </button>

                  <hr style={styles.hr} />

                  <strong>Liens marchands directs :</strong>

                  <div style={styles.merchantLinks}>
                    {parts.map((part) => (
                      <a
                        key={`merchant-${basketKey}-${part.name}`}
                        href={part.url}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.merchantButton}
                      >
                        Voir {part.name} sur Motointegrator
                      </a>
                    ))}
                  </div>

                  <hr style={styles.hr} />

                  <strong>Recherches à copier :</strong>

                  {parts.map((part) => (
                    <div
                      key={`search-${basketKey}-${part.name}`}
                      style={styles.searchBox}
                    >
                      <p style={styles.searchText}>{part.searchText}</p>

                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() => copyText(part.searchText)}
                      >
                        Copier la recherche
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={styles.card}>
        <h2>6. Demande RDV</h2>

        <button type="button" style={styles.primaryButton} onClick={prepareRequest}>
          Envoyer la demande client
        </button>

        {message && <div style={styles.message}>{message}</div>}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background: "#f3f5f8",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#111827",
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "32px",
    marginBottom: "18px",
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.08)",
  },
  badge: {
    display: "inline-block",
    background: "#edf4ff",
    color: "#1559c7",
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: 900,
  },
  title: {
    fontSize: "48px",
    margin: "12px 0",
    letterSpacing: "-0.04em",
  },
  lead: {
    color: "#667085",
    fontSize: "18px",
    lineHeight: 1.55,
    maxWidth: "850px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.06)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  label: {
    display: "grid",
    gap: "7px",
    fontWeight: 800,
  },
  input: {
    padding: "13px",
    borderRadius: "12px",
    border: "1px solid #d0d5dd",
    fontSize: "16px",
  },
  muted: {
    color: "#667085",
    lineHeight: 1.5,
  },
  services: {
    display: "grid",
    gap: "10px",
  },
  serviceButton: {
    width: "100%",
    border: "2px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "16px",
  },
  checks: {
    display: "grid",
    gap: "10px",
    marginTop: "18px",
    marginBottom: "18px",
  },
  primaryButton: {
    background: "#111827",
    color: "#ffffff",
    border: 0,
    borderRadius: "14px",
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: "16px",
  },
  secondaryButton: {
    background: "#eef2f7",
    color: "#111827",
    border: 0,
    borderRadius: "12px",
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  smallButton: {
    background: "#111827",
    color: "#ffffff",
    border: 0,
    borderRadius: "10px",
    padding: "9px 11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  summary: {
    display: "grid",
    gap: "8px",
  },
  summaryLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "13px",
    borderRadius: "12px",
    background: "#f8fafc",
  },
  totalLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px",
    borderRadius: "14px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "18px",
  },
  basketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
    marginTop: "16px",
  },
  basketCard: {
    border: "2px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    background: "#fbfcfe",
  },
  warning: {
    background: "#fff8e7",
    border: "1px solid #fedf89",
    borderRadius: "12px",
    padding: "10px",
    color: "#7a4b00",
    lineHeight: 1.45,
    marginTop: "10px",
  },
  aiBox: {
    background: "#edf4ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "12px",
    color: "#1559c7",
    lineHeight: 1.45,
    marginBottom: "12px",
  },
  hr: {
    border: 0,
    borderTop: "1px solid #e5e7eb",
    margin: "16px 0",
  },
  basketDirectButton: {
    display: "block",
    background: "#07803f",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "14px",
    padding: "13px 14px",
    fontWeight: 900,
    textAlign: "center",
    marginTop: "12px",
    marginBottom: "10px",
  },
  openAllButton: {
    width: "100%",
    background: "#1559c7",
    color: "#ffffff",
    border: 0,
    borderRadius: "14px",
    padding: "13px 14px",
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: "12px",
  },
  merchantLinks: {
    display: "grid",
    gap: "10px",
    marginTop: "12px",
  },
  merchantButton: {
    display: "block",
    background: "#1559c7",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "12px",
    padding: "11px 13px",
    fontWeight: 900,
    textAlign: "center",
  },
  searchBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "10px",
    marginTop: "10px",
  },
  searchText: {
    color: "#111827",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  message: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "14px",
    background: "#e9f9ef",
    border: "1px solid #abefc6",
    color: "#05603a",
    fontWeight: 800,
  },
};

export default App;
