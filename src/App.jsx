import React, { useMemo, useState } from "react";

const EDM_EMAIL = "edm28.contact@gmail.com";

const brakeServices = [
  {
    id: "controle_freinage",
    name: "Contrôle visuel freinage",
    category: "Freinage",
    labor: 29,
    explanation:
      "Contrôle visuel des plaquettes, disques et éléments visibles du système de freinage.",
    needs:
      "Aucune pièce obligatoire. Ce contrôle permet de confirmer les éléments à prévoir avant intervention."
  },
  {
    id: "plaquettes_avant",
    name: "Montage plaquettes avant",
    category: "Freinage",
    labor: 69,
    explanation:
      "À choisir si seules les plaquettes avant doivent être remplacées et que les disques sont encore en bon état.",
    needs:
      "Le client doit prévoir un jeu de plaquettes avant compatible avec le véhicule."
  },
  {
    id: "plaquettes_arriere",
    name: "Montage plaquettes arrière",
    category: "Freinage",
    labor: 69,
    explanation:
      "À choisir si seules les plaquettes arrière doivent être remplacées et que les disques arrière sont encore en bon état.",
    needs:
      "Le client doit prévoir un jeu de plaquettes arrière compatible avec le véhicule."
  },
  {
    id: "disques_plaquettes_avant",
    name: "Montage disques + plaquettes avant",
    category: "Freinage",
    labor: 109,
    explanation:
      "À choisir si les disques avant sont usés, voilés, creusés ou à remplacer en même temps que les plaquettes.",
    needs:
      "Le client doit prévoir deux disques avant et un jeu de plaquettes avant compatibles."
  },
  {
    id: "disques_plaquettes_arriere",
    name: "Montage disques + plaquettes arrière",
    category: "Freinage",
    labor: 109,
    explanation:
      "À choisir si les disques arrière sont usés, voilés, creusés ou à remplacer en même temps que les plaquettes.",
    needs:
      "Le client doit prévoir deux disques arrière et un jeu de plaquettes arrière compatibles."
  },
  {
    id: "freinage_complet",
    name: "Montage disques + plaquettes avant et arrière",
    category: "Freinage",
    labor: 199,
    explanation:
      "À choisir pour un remplacement complet du freinage avant et arrière.",
    needs:
      "Le client doit prévoir les disques avant, disques arrière, plaquettes avant et plaquettes arrière compatibles."
  }
];

const partRanges = {
  eco: {
    label: "Éco",
    note: "Prix accessible, adapté aux petits budgets.",
    multiplier: 0.9
  },
  standard: {
    label: "Standard",
    note: "Bon équilibre prix / qualité.",
    multiplier: 1
  },
  premium: {
    label: "Premium",
    note: "Marques reconnues ou qualité supérieure.",
    multiplier: 1.18
  }
};

const baseParts = {
  controle_freinage: [0, 0],
  plaquettes_avant: [35, 55],
  plaquettes_arriere: [35, 55],
  disques_plaquettes_avant: [120, 155],
  disques_plaquettes_arriere: [115, 150],
  freinage_complet: [240, 330]
};

const stockOil = [
  {
    norm: "5W30 C2",
    pricePerLiter: 12,
    compatibleWords: ["5w30", "bluehdi", "hdi", "diesel", "peugeot", "citroen", "citroën"]
  },
  {
    norm: "5W40",
    pricePerLiter: 11,
    compatibleWords: ["5w40", "essence", "renault", "dacia", "opel"]
  }
];

function euro(value) {
  return `${Math.round(value)} €`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function estimateOilCapacity(vehicle) {
  const text = normalize(
    `${vehicle.brand} ${vehicle.model} ${vehicle.engine} ${vehicle.energy}`
  );

  if (text.includes("bluehdi") || text.includes("hdi")) return 5;
  if (text.includes("1.6")) return 5;
  if (text.includes("2.0")) return 6;
  if (text.includes("essence")) return 4;
  return 5;
}

function findGarageOil(vehicle) {
  const text = normalize(
    `${vehicle.brand} ${vehicle.model} ${vehicle.engine} ${vehicle.energy}`
  );

  return stockOil.find((oil) =>
    oil.compatibleWords.some((word) => text.includes(normalize(word)))
  );
}

function App() {
  const [step, setStep] = useState("home");
  const [client, setClient] = useState({
    name: "",
    phone: "",
    email: "",
    plate: "",
    mileage: ""
  });

  const [vehicle, setVehicle] = useState({
    brand: "",
    model: "",
    engine: "",
    year: "",
    energy: ""
  });

  const [selectedServices, setSelectedServices] = useState([]);
  const [grade, setGrade] = useState("standard");
  const [addOilService, setAddOilService] = useState(false);
  const [oilMode, setOilMode] = useState("garage");
  const [apiMessage, setApiMessage] = useState("");
  const [aiEstimate, setAiEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [loadingPlate, setLoadingPlate] = useState(false);

  const garageOil = useMemo(() => findGarageOil(vehicle), [vehicle]);
  const oilCapacity = useMemo(() => estimateOilCapacity(vehicle), [vehicle]);
  const hasBrakeRepair = selectedServices.some((id) => id !== "controle_freinage");

  const selectedObjects = brakeServices.filter((service) =>
    selectedServices.includes(service.id)
  );

  const totals = useMemo(() => {
    const labor = selectedObjects.reduce((sum, service) => sum + service.labor, 0);
    const multiplier = partRanges[grade].multiplier;

    const parts = selectedServices.reduce(
      (sum, id) => {
        const range = baseParts[id] || [0, 0];
        return [
          sum[0] + range[0] * multiplier,
          sum[1] + range[1] * multiplier
        ];
      },
      [0, 0]
    );

    const oil =
      addOilService && oilMode === "garage" && garageOil
        ? oilCapacity * garageOil.pricePerLiter
        : 0;

    const oilLabor = addOilService ? 69 : 0;

    return {
      labor: labor + oilLabor,
      partsMin: parts[0],
      partsMax: parts[1],
      oil,
      totalMin: labor + oilLabor + parts[0] + oil,
      totalMax: labor + oilLabor + parts[1] + oil
    };
  }, [selectedObjects, selectedServices, grade, addOilService, oilMode, garageOil, oilCapacity]);

  function updateClient(key, value) {
    setClient((current) => ({ ...current, [key]: value }));
  }

  function updateVehicle(key, value) {
    setVehicle((current) => ({ ...current, [key]: value }));
  }

  function toggleService(id) {
    setSelectedServices((current) =>
      current.includes(id)
        ? current.filter((serviceId) => serviceId !== id)
        : [...current, id]
    );
  }

  async function scanPlate() {
    if (!client.plate.trim()) {
      setApiMessage("Entre une immatriculation avant de scanner.");
      return;
    }

    setLoadingPlate(true);
    setApiMessage("");

    try {
      const response = await fetch(`/api/vehicle?plate=${encodeURIComponent(client.plate)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setApiMessage(data.error || "Scan plaque indisponible. Remplis le véhicule manuellement.");
        return;
      }

      setVehicle({
        brand: data.vehicle.brand || "",
        model: data.vehicle.model || "",
        engine: data.vehicle.engine || "",
        year: data.vehicle.year || "",
        energy: data.vehicle.energy || ""
      });

      setApiMessage("Véhicule détecté. Vérifie les informations avant de continuer.");
    } catch (error) {
      setApiMessage("Impossible de scanner la plaque. Remplis le véhicule manuellement.");
    } finally {
      setLoadingPlate(false);
    }
  }

  async function generateAiEstimate() {
    setLoadingEstimate(true);
    setAiEstimate(null);

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client,
          vehicle,
          services: selectedObjects,
          grade,
          oil: {
            enabled: addOilService,
            mode: oilMode,
            capacity: oilCapacity,
            garageOil
          },
          totals
        })
      });

      const data = await response.json();
      setAiEstimate(data);
    } catch (error) {
      setAiEstimate({
        source: "local",
        explanation:
          "Estimation locale utilisée. L’estimation IA sera disponible après configuration de la clé API."
      });
    } finally {
      setLoadingEstimate(false);
    }
  }

  function buildMailLink() {
    const servicesText = selectedObjects
      .map((service) => `- ${service.name} : ${service.labor} € main-d’œuvre\n  ${service.needs}`)
      .join("\n");

    const oilText = addOilService
      ? oilMode === "garage" && garageOil
        ? `Vidange annexe : oui\nHuile garage : ${garageOil.norm}, ${oilCapacity} L, ${euro(totals.oil)}`
        : "Vidange annexe : oui\nHuile + filtre : à acheter par le client"
      : "Vidange annexe : non";

    const body = `
Nouvelle demande site EDM AUTO

CLIENT
Nom : ${client.name}
Téléphone : ${client.phone}
Email : ${client.email}

VÉHICULE
Immatriculation : ${client.plate}
Kilométrage : ${client.mileage}
Marque : ${vehicle.brand}
Modèle : ${vehicle.model}
Motorisation : ${vehicle.engine}
Année : ${vehicle.year}
Énergie : ${vehicle.energy}

SERVICES
${servicesText}

Catégorie pièces : ${partRanges[grade].label}

${oilText}

ESTIMATION
Main-d’œuvre EDM AUTO : ${euro(totals.labor)}
Pièces estimées : ${euro(totals.partsMin)} à ${euro(totals.partsMax)}
Huile garage : ${euro(totals.oil)}
Total estimé : ${euro(totals.totalMin)} à ${euro(totals.totalMax)}

Note : estimation indicative à valider par EDM AUTO avant confirmation.
`.trim();

    return `mailto:${EDM_EMAIL}?subject=${encodeURIComponent(
      `Nouvelle demande site EDM AUTO - ${client.plate || "client"}`
    )}&body=${encodeURIComponent(body)}`;
  }

  function renderHome() {
    return (
      <section className="hero">
        <p className="badge">Spécialiste freinage & entretien courant</p>
        <h1>Préparez votre RDV EDM AUTO</h1>
        <p className="lead">
          Vous achetez vos pièces, EDM AUTO vous aide à choisir les bonnes références
          et réalise le montage. Obtenez une estimation avant validation.
        </p>

        <div className="actions">
          <button className="primary" onClick={() => setStep("client")}>
            Préparer mon RDV
          </button>
          <button className="secondary" onClick={() => setStep("servicesView")}>
            Voir les services
          </button>
        </div>

        <div className="cards">
          <div>
            <strong>Freinage</strong>
            <span>Plaquettes, disques, contrôle et conseil pièces.</span>
          </div>
          <div>
            <strong>Vidange en annexe</strong>
            <span>Proposée uniquement avec une intervention freinage.</span>
          </div>
          <div>
            <strong>Validation humaine</strong>
            <span>La demande est envoyée à EDM AUTO avant confirmation.</span>
          </div>
        </div>
      </section>
    );
  }

  function renderServicesView() {
    return (
      <section className="panel">
        <h2>Services EDM AUTO</h2>
        <p className="muted">
          Ici, seuls les prix de main-d’œuvre sont affichés. Les prix des pièces sont estimés
          uniquement pendant la préparation du RDV.
        </p>

        <div className="service-list">
          {brakeServices.map((service) => (
            <div className="service-row" key={service.id}>
              <div>
                <span className="chip">{service.category}</span>
                <h3>{service.name}</h3>
                <p>{service.explanation}</p>
                <p className="explain mini">
                  <strong>À prévoir :</strong> {service.needs}
                </p>
              </div>
              <strong>{service.labor} €</strong>
            </div>
          ))}

          <div className="service-row">
            <div>
              <span className="chip">Annexe</span>
              <h3>Vidange moteur</h3>
              <p>
                Service proposé uniquement en complément d’une réparation de freinage.
              </p>
              <p className="explain mini">
                Filtre à huile fourni ou réglé par le client. Huile garage proposée seulement si compatible.
              </p>
            </div>
            <strong>69 €</strong>
          </div>
        </div>

        <button className="secondary" onClick={() => setStep("home")}>
          Retour
        </button>
      </section>
    );
  }

  function renderClient() {
    return (
      <section className="panel narrow">
        <h2>Vos informations</h2>
        <p className="muted">
          Ces informations servent à préparer la demande avant validation EDM AUTO.
        </p>

        <div className="grid">
          <label>
            Nom complet
            <input value={client.name} onChange={(e) => updateClient("name", e.target.value)} />
          </label>
          <label>
            Téléphone
            <input value={client.phone} onChange={(e) => updateClient("phone", e.target.value)} />
          </label>
          <label>
            Email
            <input value={client.email} onChange={(e) => updateClient("email", e.target.value)} />
          </label>
          <label>
            Immatriculation
            <input value={client.plate} onChange={(e) => updateClient("plate", e.target.value.toUpperCase())} />
          </label>
          <label>
            Kilométrage
            <input value={client.mileage} onChange={(e) => updateClient("mileage", e.target.value)} />
          </label>
          <div className="lookup-box">
            <button className="secondary" onClick={scanPlate} disabled={loadingPlate}>
              {loadingPlate ? "Scan en cours..." : "Scanner la plaque"}
            </button>
            {apiMessage && <p className="success">{apiMessage}</p>}
          </div>
        </div>

        <h3>Véhicule</h3>
        <div className="grid">
          <label>
            Marque
            <input value={vehicle.brand} onChange={(e) => updateVehicle("brand", e.target.value)} />
          </label>
          <label>
            Modèle
            <input value={vehicle.model} onChange={(e) => updateVehicle("model", e.target.value)} />
          </label>
          <label>
            Motorisation
            <input value={vehicle.engine} onChange={(e) => updateVehicle("engine", e.target.value)} />
          </label>
          <label>
            Année
            <input value={vehicle.year} onChange={(e) => updateVehicle("year", e.target.value)} />
          </label>
          <label>
            Énergie
            <input value={vehicle.energy} onChange={(e) => updateVehicle("energy", e.target.value)} />
          </label>
        </div>

        <div className="actions">
          <button className="secondary" onClick={() => setStep("home")}>
            Retour
          </button>
          <button className="primary" onClick={() => setStep("chooseServices")}>
            Continuer
          </button>
        </div>
      </section>
    );
  }

  function renderChooseServices() {
    return (
      <section className="panel">
        <h2>Choix des services</h2>
        <p className="muted">
          Sélectionnez une intervention freinage. La vidange est proposée seulement en annexe.
        </p>

        <div className="service-list">
          {brakeServices.map((service) => (
            <button
              key={service.id}
              className={`select-card ${selectedServices.includes(service.id) ? "active" : ""}`}
              onClick={() => toggleService(service.id)}
            >
              <span className="chip">{service.category}</span>
              <h3>{service.name}</h3>
              <p>{service.explanation}</p>
              <p className="explain mini">
                <strong>À prévoir :</strong> {service.needs}
              </p>
              <strong>Main-d’œuvre : {service.labor} €</strong>
            </button>
          ))}
        </div>

        <div className="grade-box">
          <h3>Catégorie de pièces souhaitée</h3>
          <div className="segmented">
            {Object.entries(partRanges).map(([key, item]) => (
              <button
                key={key}
                className={grade === key ? "active" : ""}
                onClick={() => setGrade(key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="muted">{partRanges[grade].note}</p>
        </div>

        {hasBrakeRepair && (
          <div className="annexe">
            <h3>Service annexe</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={addOilService}
                onChange={(e) => setAddOilService(e.target.checked)}
              />
              Ajouter une vidange en annexe de la réparation freinage
            </label>

            {addOilService && (
              <div className="oil-box">
                {garageOil ? (
                  <>
                    <p>
                      Huile garage compatible détectée : <strong>{garageOil.norm}</strong>
                    </p>
                    <p>
                      Capacité estimée : {oilCapacity} L — Forfait huile :{" "}
                      <strong>{euro(oilCapacity * garageOil.pricePerLiter)}</strong>
                    </p>
                    <div className="segmented">
                      <button
                        className={oilMode === "garage" ? "active" : ""}
                        onClick={() => setOilMode("garage")}
                      >
                        Huile garage
                      </button>
                      <button
                        className={oilMode === "client" ? "active" : ""}
                        onClick={() => setOilMode("client")}
                      >
                        Huile + filtre client
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Huile garage non proposée pour ce véhicule. Le client devra prévoir
                      l’huile et le filtre adaptés.
                    </p>
                    <button className="active">Huile + filtre client</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!hasBrakeRepair && (
          <div className="notice">
            La vidange sera proposée uniquement après sélection d’une réparation de freinage.
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={() => setStep("client")}>
            Retour
          </button>
          <button className="primary" onClick={() => setStep("summary")}>
            Voir l’estimation
          </button>
        </div>
      </section>
    );
  }

  function renderSummary() {
    return (
      <section className="panel">
        <h2>Estimation</h2>
        <p className="muted">
          Estimation indicative. Les références pièces et le tarif final sont validés par EDM AUTO.
        </p>

        <div className="summary">
          <div>
            <span>Main-d’œuvre EDM AUTO</span>
            <strong>{euro(totals.labor)}</strong>
          </div>
          <div>
            <span>Pièces estimées catégorie {partRanges[grade].label}</span>
            <strong>
              {euro(totals.partsMin)} à {euro(totals.partsMax)}
            </strong>
          </div>
          <div>
            <span>Huile garage</span>
            <strong>{euro(totals.oil)}</strong>
          </div>
          <div className="total">
            <span>Total estimé</span>
            <strong>
              {euro(totals.totalMin)} à {euro(totals.totalMax)}
            </strong>
          </div>
        </div>

        <button className="secondary full" onClick={generateAiEstimate} disabled={loadingEstimate}>
          {loadingEstimate ? "Estimation IA en cours..." : "Générer l’estimation IA"}
        </button>

        {aiEstimate && (
          <div className="notice">
            <strong>Analyse estimation :</strong>
            <p>{aiEstimate.explanation || "Estimation IA ou locale générée."}</p>
            {aiEstimate.source && <small>Source : {aiEstimate.source}</small>}
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={() => setStep("chooseServices")}>
            Retour
          </button>
          <a className="primary link" href={buildMailLink()}>
            Envoyer ma demande à EDM AUTO
          </a>
        </div>
      </section>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">EDM AUTO</div>
        <button className="ghost" onClick={() => setStep("home")}>
          Accueil
        </button>
      </header>

      {step === "home" && renderHome()}
      {step === "servicesView" && renderServicesView()}
      {step === "client" && renderClient()}
      {step === "chooseServices" && renderChooseServices()}
      {step === "summary" && renderSummary()}
    </main>
  );
}

export default App;
