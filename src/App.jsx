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
    advice: "Pour budget serré. Validation EDM AUTO obligatoire avant commande.",
  },
  standard: {
    label: "STANDARD",
    subtitle: "Recommandé EDM AUTO",
    brands: ["Bosch", "TRW", "Valeo", "Febi", "Meyle"],
    advice: "Meilleur équilibre prix / fiabilité pour la majorité des véhicules.",
  },
  premium: {
    label: "PREMIUM",
    subtitle: "Qualité supérieure",
    brands: ["ATE", "Brembo", "Lemförder", "SKF", "Textar"],
    advice:
      "Conseillé pour freinage complet, gros kilométrage, véhicule lourd ou premium.",
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
  const [message, setMessage] = useState("");

  const selectedServiceObjects = useMemo(() => {
    return SERVICES.filter((service) => selectedServices.includes(service.id));
  }, [selectedServices]);

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
  }

  function calculateForBasket(basketKey) {
    const laborBase = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.labor;
    }, 0);

    const partsMin = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[basketKey][0];
    }, 0);

    const partsMax = selectedServiceObjects.reduce((sum, service) => {
      return sum + service.parts[basketKey][1];
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

  function createBaskets() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation avant de créer les paniers.");
      return;
    }

    const recommended = recommendBasket();

    setSelectedBasket(recommended);
    setBasketsCreated(true);
    setMessage(
      `Paniers créés. Recommandation EDM AUTO : ${BASKETS[recommended].label}.`
    );
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

  function buildSearchText(part, basketKey) {
    const brands = BASKETS[basketKey].brands.slice(0, 3).join(" ");

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

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Recherche copiée. Colle-la dans Motointegrator.");
    } catch {
      setMessage("Copie impossible automatiquement. Sélectionne le texte à la main.");
    }
  }

  function prepareRequest() {
    if (selectedServiceObjects.length === 0) {
      setMessage("Sélectionne au moins une prestation.");
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
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("edm_auto_last_request", JSON.stringify(request));

    setMessage(
      "Demande préparée localement. Prochaine étape : branchement Google Sheets."
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>EDM AUTO · Mécano du Dimanche</p>
        <h1 style={styles.title}>Préparer mon RDV</h1>
        <p style={styles.lead}>
          Le client renseigne son véhicule, choisit les prestations, puis le site
          crée les paniers pièces ÉCO / STANDARD / PREMIUM avec total
          main-d’œuvre + pièces.
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
          Créer les paniers pièces
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

          <div style={styles.basketGrid}>
            {Object.keys(BASKETS).map((basketKey) => {
              const basket = BASKETS[basketKey];
              const total = basketTotals[basketKey];
              const recommended = basketKey === recommendBasket();

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
                    {basket.brands.join(", ")}
                  </p>

                  <p style={styles.warning}>{basket.advice}</p>

                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setSelectedBasket(basketKey)}
                  >
                    Choisir ce panier
                  </button>

                  <hr style={styles.hr} />

                  <strong>Recherches pièces :</strong>

                  {getNeededParts().map((part) => {
                    const searchText = buildSearchText(part, basketKey);

                    return (
                      <div key={`${basketKey}-${part}`} style={styles.searchBox}>
                        <p style={styles.searchText}>{searchText}</p>

                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => copyText(searchText)}
                        >
                          Copier la recherche
                        </button>
                      </div>
                    );
                  })}

                  <a
                    href="https://www.motointegrator.fr/"
                    target="_blank"
                    rel="noreferrer"
                    style={styles.link}
                  >
                    Ouvrir Motointegrator
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={styles.card}>
        <h2>6. Demande RDV</h2>

        <button type="button" style={styles.primaryButton} onClick={prepareRequest}>
          Préparer la demande client
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
  },
  hr: {
    border: 0,
    borderTop: "1px solid #e5e7eb",
    margin: "16px 0",
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
  link: {
    display: "inline-block",
    marginTop: "12px",
    color: "#1559c7",
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
