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
    brands: ["Ridex", "Stark", "Bolk"],
    advice:
      "Panier budget. Le prix des pièces change, mais la main-d’œuvre reste identique.",
  },
  standard: {
    label: "STANDARD",
    subtitle: "Recommandé EDM AUTO",
    brands: ["Bosch", "TRW", "Valeo", "Febi", "Meyle"],
    advice: "Panier conseillé : bon équilibre prix / fiabilité.",
  },
  premium: {
    label: "PREMIUM",
    subtitle: "Qualité supérieure",
    brands: ["ATE", "Brembo", "Lemförder", "SKF", "Textar"],
    advice:
      "Panier qualité supérieure. Le prix des pièces augmente, pas la main-d’œuvre.",
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
  const [selectedBasket, setSelectedBasket] = useState("eco");
  const [j7Accepted, setJ7Accepted] = useState(true);
  const [refuseControl, setRefuseControl] = useState(false);
  const [notes, setNotes] = useState("");
  const [basketsCreated, setBasketsCreated] = useState(false);
  const [message, setMessage] = useState("");

  const selectedServiceObjects = useMemo(() => {
    return SERVICES.filter((service) => selectedServices.includes(service.id));
  }, [selectedServices]);

  const estimate = useMemo(() => {
    return calculateEstimate(selectedBasket);
  }, [selectedServiceObjects, selectedBasket, j7Accepted, refuseControl]);

  const allEstimates = useMemo(() => {
    return {
      eco: calculateEstimate("eco"),
      standard: calculateEstimate("standard"),
      premium: calculateEstimate("premium"),
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
    setMessage("");
  }

  function calculateEstimate(basketKey) {
    const safeBasket = BASKETS[basketKey] ? basketKey : "eco";

    const laborBase = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.labor;
    }, 0);

    const eligibleCombo = selectedServiceObjects.filter(
      (service) => service.id !== "purge_frein"
    );

    let comboSaving = 0;

    if (eligibleCombo.length >= 2) {
      const cheapest = [...eligibleCombo].sort((a, b) => a.labor - b.labor)[0];
      comboSaving = Math.round(cheapest.labor * 0.3 * 100) / 100;
    }

    const laborAfterCombo = Math.max(0, laborBase - comboSaving);

    const j7Saving = j7Accepted
      ? Math.round(laborAfterCombo * 0.1 * 100) / 100
      : 0;

    const immobilisation = refuseControl ? 40 : 0;

    const laborAfterDiscounts = Math.max(
      0,
      laborAfterCombo - j7Saving + immobilisation
    );

    const partsMin = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[safeBasket][0];
    }, 0);

    const partsMax = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[safeBasket][1];
    }, 0);

    return {
      laborBase,
      comboSaving,
      j7Saving,
      immobilisation,
      laborAfterDiscounts,
      partsMin,
      partsMax,
      totalGlobalMin: laborAfterDiscounts + partsMin,
      totalGlobalMax: laborAfterDiscounts + partsMax,
      economy: comboSaving + j7Saving,
    };
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
    const brands = BASKETS[basketKey].brands.join(" ");

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

  function createBaskets() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation.");
      return;
    }

    setBasketsCreated(true);
    setMessage(
      "Paniers créés. La main-d’œuvre reste fixe, seul le prix des pièces change selon ÉCO / STANDARD / PREMIUM."
    );
  }

  function openAllLinks(basketKey) {
    const urls = Array.from(new Set(getNeededParts().map(getMerchantUrl)));

    if (!urls.length) {
      setMessage("Aucune pièce à ouvrir.");
      return;
    }

    urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, "_blank", "noreferrer");
      }, index * 250);
    });

    setMessage(`Ouverture des liens pièces du panier ${BASKETS[basketKey].label}.`);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Recherche copiée.");
    } catch {
      setMessage("Copie impossible automatiquement.");
    }
  }

  async function sendRequest() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation.");
      return;
    }

    if (!client.firstName || !client.lastName || !client.phone || !client.email) {
      setMessage("Complète les informations client.");
      return;
    }

    if (!vehicle.plate || !vehicle.brand || !vehicle.model) {
      setMessage("Complète au minimum la plaque, la marque et le modèle.");
      return;
    }

    const request = {
      client,
      vehicle,
      notes,
      services: selectedServiceObjects.map((service) => service.name),
      basket: selectedBasket,
      basketLabel: BASKETS[selectedBasket].label,
      totalMainOeuvre: estimate.laborAfterDiscounts,
      totalPiecesMin: estimate.partsMin,
      totalPiecesMax: estimate.partsMax,
      totalGlobalMin: estimate.totalGlobalMin,
      totalGlobalMax: estimate.totalGlobalMax,
      j7Accepted,
      refuseControl,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("edm_auto_last_request", JSON.stringify(request));
    setMessage("Envoi de la demande...");

    try {
      const response = await fetch("/api/submit-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const text = await response.text();

      let result = null;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Réponse serveur non JSON.");
      }

      if (!response.ok || !result.success) {
        setMessage(
          result.error ||
            "Demande sauvegardée localement, mais pas envoyée au serveur."
        );
        return;
      }

      setMessage("Demande envoyée à EDM AUTO.");
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
          Choisis les prestations, sélectionne ÉCO / STANDARD / PREMIUM, puis le
          site calcule le total global pièces + main-d’œuvre.
        </p>
      </section>

      <div style={styles.layout}>
        <div style={styles.left}>
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
                      borderColor: checked ? "#111827" : "#d9dee8",
                      background: checked ? "#eef2f7" : "#ffffff",
                    }}
                  >
                    <span>
                      <strong>{service.name}</strong>
                      <br />
                      <small>
                        {service.category} · Main-d’œuvre {euro(service.labor)}
                      </small>
                    </span>

                    <span style={styles.serviceCheck}>{checked ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.card}>
            <h2>4. Panier pièces</h2>

            <div style={styles.basketSelect}>
              {Object.keys(BASKETS).map((basketKey) => {
                const basket = BASKETS[basketKey];
                const basketEstimate = allEstimates[basketKey];
                const active = selectedBasket === basketKey;

                return (
                  <button
                    key={basketKey}
                    type="button"
                    onClick={() => setSelectedBasket(basketKey)}
                    style={{
                      ...styles.basketButton,
                      background: active ? "#111827" : "#ffffff",
                      color: active ? "#ffffff" : "#111827",
                      borderColor: active ? "#111827" : "#d9dee8",
                    }}
                  >
                    <strong>{basket.label}</strong>
                    <small>{basket.subtitle}</small>
                    <span>
                      Pièces : {euro(basketEstimate.partsMin)} à{" "}
                      {euro(basketEstimate.partsMax)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={styles.infoBox}>
              <strong>{BASKETS[selectedBasket].label}</strong>
              <p>{BASKETS[selectedBasket].advice}</p>
              <p>
                Marques conseillées : {BASKETS[selectedBasket].brands.join(", ")}
              </p>
            </div>

            <button type="button" style={styles.primaryButton} onClick={createBaskets}>
              Créer / afficher les liens pièces
            </button>
          </section>

          <section style={styles.card}>
            <h2>5. Options de préparation</h2>

            <div style={styles.optionsGrid}>
              <label style={styles.optionBox}>
                <input
                  type="checkbox"
                  checked={j7Accepted}
                  onChange={(e) => setJ7Accepted(e.target.checked)}
                />
                <span>
                  <strong>Contrôle J-7 accepté</strong>
                  <br />
                  Préparation avant dimanche, remise contrôle appliquée si
                  éligible.
                </span>
              </label>

              <label style={styles.optionBox}>
                <input
                  type="checkbox"
                  checked={refuseControl}
                  onChange={(e) => setRefuseControl(e.target.checked)}
                />
                <span>
                  <strong>Refus contrôle J-7</strong>
                  <br />
                  Forfait immobilisation 40 € si mauvaises pièces.
                </span>
              </label>
            </div>

            <label style={styles.label}>
              Notes client / symptômes
              <textarea
                style={styles.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Exemple : bruit au freinage, vibration, claquement train avant..."
              />
            </label>
          </section>

          {basketsCreated && (
            <section style={styles.card}>
              <h2>6. Liens pièces du panier {BASKETS[selectedBasket].label}</h2>

              <div style={styles.infoBoxGreen}>
                <strong>Panier EDM AUTO</strong>
                <p>
                  Ouvre les liens, sélectionne le véhicule exact sur
                  Motointegrator, puis ajoute les pièces compatibles au panier
                  marchand.
                </p>
              </div>

              <button
                type="button"
                style={styles.blueButton}
                onClick={() => openAllLinks(selectedBasket)}
              >
                Ouvrir tous les liens pièces
              </button>

              <div style={styles.linksGrid}>
                {getNeededParts().map((part) => (
                  <div key={part} style={styles.partCard}>
                    <strong>{part}</strong>

                    <a
                      href={getMerchantUrl(part)}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.linkButton}
                    >
                      Voir sur Motointegrator
                    </a>

                    <div style={styles.searchBox}>
                      <small>Recherche à copier :</small>
                      <p>{buildSearchText(part, selectedBasket)}</p>
                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() =>
                          copyText(buildSearchText(part, selectedBasket))
                        }
                      >
                        Copier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={styles.card}>
            <h2>7. Envoyer la demande</h2>

            <div style={styles.finalTotalBox}>
              <div style={styles.finalTotalLine}>
                <span>Main-d’œuvre après remises</span>
                <strong>{euro(estimate.laborAfterDiscounts)}</strong>
              </div>

              <div style={styles.finalTotalLine}>
                <span>Pièces panier {BASKETS[selectedBasket].label}</span>
                <strong>
                  {euro(estimate.partsMin)} à {euro(estimate.partsMax)}
                </strong>
              </div>

              <div style={styles.finalTotalMain}>
                <span>TOTAL GLOBAL pièces + main-d’œuvre</span>
                <strong>
                  {euro(estimate.totalGlobalMin)} à {euro(estimate.totalGlobalMax)}
                </strong>
              </div>
            </div>

            <button type="button" style={styles.primaryButton} onClick={sendRequest}>
              Envoyer la demande client
            </button>

            {message && <div style={styles.message}>{message}</div>}
          </section>
        </div>

        <aside style={styles.right}>
          <section style={styles.estimateCard}>
            <h2>Estimation</h2>

            <div style={styles.estimateLine}>
              <span>Main-d’œuvre avant remise</span>
              <strong>{euro(estimate.laborBase)}</strong>
            </div>

            <div style={styles.estimateLine}>
              <span>Avantage combo</span>
              <strong>-{euro(estimate.comboSaving)}</strong>
            </div>

            <div style={styles.estimateLine}>
              <span>Contrôle J-7 / immobilisation</span>
              <strong>
                {estimate.immobilisation > 0
                  ? `+${euro(estimate.immobilisation)}`
                  : `-${euro(estimate.j7Saving)}`}
              </strong>
            </div>

            <div style={styles.estimateLine}>
              <span>Total main-d’œuvre après remises</span>
              <strong>{euro(estimate.laborAfterDiscounts)}</strong>
            </div>

            <div style={styles.estimateLine}>
              <span>Pièces estimées {BASKETS[selectedBasket].label}</span>
              <strong>
                {euro(estimate.partsMin)} à {euro(estimate.partsMax)}
              </strong>
            </div>

            <div style={styles.savingLine}>
              <span>Économie estimée</span>
              <strong>{euro(estimate.economy)}</strong>
            </div>

            <div style={styles.blackTotal}>
              <span>TOTAL pièces + main-d’œuvre</span>
              <strong>
                {euro(estimate.totalGlobalMin)} à {euro(estimate.totalGlobalMax)}
              </strong>
            </div>

            <div style={styles.yellowBox}>
              Les pièces restent à commander par le client. Le total noir
              correspond bien à pièces + main-d’œuvre.
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#111827",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "24px",
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #d9dee8",
    borderRadius: "24px",
    padding: "28px",
    marginBottom: "18px",
    boxShadow: "0 16px 45px rgba(15, 23, 42, 0.06)",
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
    fontSize: "44px",
    margin: "12px 0",
    letterSpacing: "-0.04em",
  },
  lead: {
    color: "#556070",
    fontSize: "17px",
    lineHeight: 1.55,
    maxWidth: "850px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 390px",
    gap: "16px",
    alignItems: "start",
  },
  left: {
    display: "grid",
    gap: "16px",
  },
  right: {
    position: "sticky",
    top: "18px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d9dee8",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 16px 45px rgba(15, 23, 42, 0.05)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
  },
  label: {
    display: "grid",
    gap: "7px",
    fontWeight: 900,
  },
  input: {
    padding: "13px",
    borderRadius: "13px",
    border: "1px solid #cfd6e2",
    fontSize: "16px",
    outline: "none",
  },
  textarea: {
    minHeight: "92px",
    padding: "13px",
    borderRadius: "13px",
    border: "1px solid #cfd6e2",
    fontSize: "15px",
    resize: "vertical",
    outline: "none",
  },
  services: {
    display: "grid",
    gap: "10px",
  },
  serviceButton: {
    width: "100%",
    border: "2px solid #d9dee8",
    borderRadius: "16px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "15px",
  },
  serviceCheck: {
    fontSize: "22px",
    fontWeight: 900,
  },
  basketSelect: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "14px",
  },
  basketButton: {
    display: "grid",
    gap: "6px",
    border: "2px solid #d9dee8",
    borderRadius: "16px",
    padding: "14px",
    cursor: "pointer",
    textAlign: "left",
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #d9dee8",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "14px",
    color: "#334155",
    lineHeight: 1.45,
  },
  infoBoxGreen: {
    background: "#e9f9ef",
    border: "1px solid #abefc6",
    borderRadius: "16px",
    padding: "14px",
    color: "#05603a",
    lineHeight: 1.45,
    marginBottom: "14px",
  },
  optionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  optionBox: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    border: "1px solid #d9dee8",
    borderRadius: "16px",
    padding: "14px",
    background: "#ffffff",
    lineHeight: 1.5,
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
  blueButton: {
    width: "100%",
    background: "#1559c7",
    color: "#ffffff",
    border: 0,
    borderRadius: "14px",
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: "16px",
    marginBottom: "14px",
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
  linksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "12px",
  },
  partCard: {
    border: "1px solid #d9dee8",
    borderRadius: "16px",
    padding: "14px",
    background: "#fbfcfe",
    display: "grid",
    gap: "10px",
  },
  linkButton: {
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
    border: "1px solid #d9dee8",
    borderRadius: "12px",
    padding: "10px",
    lineHeight: 1.4,
  },
  estimateCard: {
    background: "#ffffff",
    border: "1px solid #d9dee8",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 16px 45px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gap: "10px",
  },
  estimateLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    background: "#ffffff",
    border: "1px solid #d9dee8",
    borderRadius: "14px",
    padding: "13px",
  },
  savingLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    background: "#e9f9ef",
    border: "1px solid #abefc6",
    color: "#067647",
    borderRadius: "14px",
    padding: "13px",
  },
  blackTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "16px",
    fontWeight: 900,
  },
  yellowBox: {
    background: "#fff8e7",
    border: "1px solid #fedf89",
    color: "#7a4b00",
    borderRadius: "14px",
    padding: "13px",
    lineHeight: 1.45,
  },
  finalTotalBox: {
    background: "#f8fafc",
    border: "1px solid #d9dee8",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "16px",
    display: "grid",
    gap: "10px",
  },
  finalTotalLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#ffffff",
    border: "1px solid #d9dee8",
  },
  finalTotalMain: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px",
    borderRadius: "14px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "19px",
    fontWeight: 900,
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
