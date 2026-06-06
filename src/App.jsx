import { useMemo, useState } from 'react'

const EDM_EMAIL = 'edm28.contact@gmail.com'

const pieceLevels = {
  eco: { label: 'Éco', note: 'Prix le plus accessible', multiplier: 0.88 },
  standard: { label: 'Standard', note: 'Bon rapport qualité / prix', multiplier: 1 },
  premium: { label: 'Premium', note: 'Marque reconnue / qualité supérieure', multiplier: 1.18 }
}

const services = [
  {
    id: 'controle_freinage',
    category: 'Freinage',
    name: 'Contrôle visuel freinage',
    labour: 29,
    partsMin: 0,
    partsMax: 0,
    description: 'Contrôle visuel des plaquettes, disques et état général du freinage.'
  },
  {
    id: 'plaquettes_av',
    category: 'Freinage',
    name: 'Montage plaquettes avant',
    labour: 69,
    partsMin: 35,
    partsMax: 55,
    description: 'Pièces fournies par le client. EDM AUTO peut aider à choisir les bonnes références.'
  },
  {
    id: 'plaquettes_ar',
    category: 'Freinage',
    name: 'Montage plaquettes arrière',
    labour: 69,
    partsMin: 35,
    partsMax: 55,
    description: 'Pièces fournies par le client. Selon système de freinage du véhicule.'
  },
  {
    id: 'disques_plaquettes_av',
    category: 'Freinage',
    name: 'Montage disques + plaquettes avant',
    labour: 109,
    partsMin: 115,
    partsMax: 155,
    description: 'Pièces fournies par le client. Vérification des références avant intervention.'
  },
  {
    id: 'disques_plaquettes_ar',
    category: 'Freinage',
    name: 'Montage disques + plaquettes arrière',
    labour: 109,
    partsMin: 115,
    partsMax: 155,
    description: 'Pièces fournies par le client. Selon véhicule et frein de stationnement.'
  },
  {
    id: 'vidange',
    category: 'Entretien courant',
    name: 'Vidange moteur',
    labour: 69,
    partsMin: 8,
    partsMax: 15,
    oil: true,
    oilLitres: 5,
    oilPricePerLitre: 12,
    description: 'Filtre à huile fourni ou réglé par le client. Huile estimée selon véhicule.'
  },
  {
    id: 'filtre_air',
    category: 'Entretien courant',
    name: 'Montage filtre à air',
    labour: 29,
    partsMin: 10,
    partsMax: 22,
    description: 'Filtre fourni par le client.'
  },
  {
    id: 'filtre_habitacle',
    category: 'Entretien courant',
    name: 'Montage filtre habitacle',
    labour: 29,
    partsMin: 10,
    partsMax: 25,
    description: 'Filtre fourni par le client. Accès variable selon véhicule.'
  },
  {
    id: 'montage_piece',
    category: 'Montage pièces',
    name: 'Montage pièce client simple',
    labour: 39,
    partsMin: 0,
    partsMax: 0,
    description: 'Sur vérification de compatibilité et faisabilité.'
  }
]

function euro(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0)
}

function adjustRange(service, levelKey) {
  const multiplier = pieceLevels[levelKey]?.multiplier || 1
  return {
    min: Math.round((service.partsMin || 0) * multiplier),
    max: Math.round((service.partsMax || 0) * multiplier)
  }
}

function App() {
  const [step, setStep] = useState('home')
  const [client, setClient] = useState({
    name: '',
    phone: '',
    email: '',
    plate: '',
    mileage: '',
    vehicle: ''
  })
  const [selected, setSelected] = useState([])
  const [level, setLevel] = useState('standard')
  const [message, setMessage] = useState('')

  const totals = useMemo(() => {
    return selected.reduce(
      (acc, id) => {
        const service = services.find((item) => item.id === id)
        if (!service) return acc
        const parts = adjustRange(service, level)
        const oil = service.oil ? (service.oilLitres || 0) * (service.oilPricePerLitre || 0) : 0
        acc.labour += service.labour || 0
        acc.partsMin += parts.min
        acc.partsMax += parts.max
        acc.oil += oil
        return acc
      },
      { labour: 0, partsMin: 0, partsMax: 0, oil: 0 }
    )
  }, [selected, level])

  const totalMin = totals.labour + totals.partsMin + totals.oil
  const totalMax = totals.labour + totals.partsMax + totals.oil

  const selectedServices = selected.map((id) => services.find((item) => item.id === id)).filter(Boolean)

  function toggleService(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function updateClient(field, value) {
    setClient((current) => ({ ...current, [field]: value }))
  }

  function buildMailto() {
    const subject = `Nouvelle demande site EDM AUTO - ${client.plate || 'Immatriculation à vérifier'}`
    const body = [
      'Nouvelle demande depuis le site EDM AUTO',
      '',
      `Nom client : ${client.name || 'Non renseigné'}`,
      `Téléphone : ${client.phone || 'Non renseigné'}`,
      `Email : ${client.email || 'Non renseigné'}`,
      `Immatriculation : ${client.plate || 'Non renseignée'}`,
      `Kilométrage : ${client.mileage || 'Non renseigné'}`,
      `Véhicule : ${client.vehicle || 'À vérifier'}`,
      '',
      `Catégorie pièces choisie : ${pieceLevels[level].label}`,
      '',
      'Services choisis :',
      ...selectedServices.map((service) => {
        const parts = adjustRange(service, level)
        const oil = service.oil ? ` | Huile estimée : ${euro((service.oilLitres || 0) * (service.oilPricePerLitre || 0))}` : ''
        const partsText = parts.max > 0 ? ` | Pièces estimées : ${euro(parts.min)} à ${euro(parts.max)}` : ' | Pièces : fournies client / à vérifier'
        return `- ${service.name} | Main-d’œuvre : ${euro(service.labour)}${partsText}${oil}`
      }),
      '',
      `Main-d’œuvre EDM AUTO : ${euro(totals.labour)}`,
      `Pièces estimées : ${euro(totals.partsMin)} à ${euro(totals.partsMax)}`,
      `Huile estimée : ${euro(totals.oil)}`,
      `Total estimé : ${euro(totalMin)} à ${euro(totalMax)}`,
      '',
      `Message client : ${message || 'Aucun message'}`,
      '',
      'Statut : Nouvelle demande site - à vérifier avant validation.'
    ].join('\n')

    return `mailto:${EDM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const canContinueClient = client.name.trim() && client.phone.trim() && client.plate.trim()
  const canSend = canContinueClient && selected.length > 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setStep('home')}>
          <span className="brand-mark">EDM</span>
          <div>
            <strong>EDM AUTO</strong>
            <small>Spécialiste freinage & entretien courant</small>
          </div>
        </div>
        <button className="ghost" onClick={() => setStep('client')}>Préparer mon RDV</button>
      </header>

      {step === 'home' && (
        <main className="hero page">
          <section className="hero-card">
            <p className="eyebrow">Freinage • Vidange • Montage pièces</p>
            <h1>Préparez votre RDV automobile en quelques minutes.</h1>
            <p className="lead">
              Vous achetez vos pièces, EDM AUTO vous aide à choisir les bonnes références compatibles avec votre véhicule,
              puis réalise le montage. Obtenez une estimation claire avant validation.
            </p>
            <div className="hero-actions">
              <button className="primary large" onClick={() => setStep('client')}>Préparer mon RDV</button>
              <button className="secondary large" onClick={() => setStep('services')}>Voir les services</button>
            </div>
            <div className="trust-grid">
              <span>✓ Main-d’œuvre affichée</span>
              <span>✓ Pièces Éco / Standard / Premium</span>
              <span>✓ Validation avant devis final</span>
            </div>
          </section>
        </main>
      )}

      {step === 'client' && (
        <main className="page narrow">
          <Progress current={1} />
          <section className="panel">
            <h2>Vos informations</h2>
            <p className="muted">Ces informations servent à préparer votre estimation et vérifier les références pièces.</p>
            <div className="form-grid">
              <Input label="Nom complet" value={client.name} onChange={(v) => updateClient('name', v)} placeholder="Ex : Enguerrand Danglade" />
              <Input label="Téléphone" value={client.phone} onChange={(v) => updateClient('phone', v)} placeholder="Ex : 06 12 34 56 78" />
              <Input label="Email" value={client.email} onChange={(v) => updateClient('email', v)} placeholder="exemple@mail.com" />
              <Input label="Immatriculation" value={client.plate} onChange={(v) => updateClient('plate', v.toUpperCase())} placeholder="AB-123-CD" />
              <Input label="Kilométrage" value={client.mileage} onChange={(v) => updateClient('mileage', v)} placeholder="Ex : 112500 km" />
              <Input label="Véhicule si connu" value={client.vehicle} onChange={(v) => updateClient('vehicle', v)} placeholder="Ex : Peugeot 308 1.6 BlueHDi" />
            </div>
            <div className="actions-row">
              <button className="secondary" onClick={() => setStep('home')}>Retour</button>
              <button className="primary" disabled={!canContinueClient} onClick={() => setStep('services')}>Continuer</button>
            </div>
          </section>
        </main>
      )}

      {step === 'services' && (
        <main className="page">
          <Progress current={2} />
          <div className="layout">
            <section className="panel">
              <h2>Choisissez vos services</h2>
              <p className="muted">La main-d’œuvre EDM AUTO est fixe. Les pièces restent à la charge du client et sont estimées selon la catégorie choisie.</p>

              <div className="level-selector">
                {Object.entries(pieceLevels).map(([key, item]) => (
                  <button key={key} className={level === key ? 'level active' : 'level'} onClick={() => setLevel(key)}>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </button>
                ))}
              </div>

              {['Freinage', 'Entretien courant', 'Montage pièces'].map((category) => (
                <div key={category} className="service-section">
                  <h3>{category}</h3>
                  <div className="service-list">
                    {services.filter((service) => service.category === category).map((service) => {
                      const parts = adjustRange(service, level)
                      const isChecked = selected.includes(service.id)
                      return (
                        <article key={service.id} className={isChecked ? 'service-card selected' : 'service-card'} onClick={() => toggleService(service.id)}>
                          <div className="service-main">
                            <input type="checkbox" checked={isChecked} readOnly />
                            <div>
                              <strong>{service.name}</strong>
                              <p>{service.description}</p>
                            </div>
                          </div>
                          <div className="price-lines">
                            <span>Main-d’œuvre : <b>{euro(service.labour)}</b></span>
                            {parts.max > 0 && <span>Pièces : <b>{euro(parts.min)} à {euro(parts.max)}</b></span>}
                            {service.oil && <span>Huile estimée : <b>{euro(service.oilLitres * service.oilPricePerLitre)}</b></span>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>

            <EstimateBox totals={totals} totalMin={totalMin} totalMax={totalMax} selectedCount={selected.length} onNext={() => setStep('summary')} disabled={selected.length === 0} />
          </div>
        </main>
      )}

      {step === 'summary' && (
        <main className="page narrow">
          <Progress current={3} />
          <section className="panel">
            <h2>Récapitulatif de votre demande</h2>
            <div className="summary-grid">
              <SummaryItem label="Client" value={client.name || 'Non renseigné'} />
              <SummaryItem label="Téléphone" value={client.phone || 'Non renseigné'} />
              <SummaryItem label="Immatriculation" value={client.plate || 'Non renseignée'} />
              <SummaryItem label="Véhicule" value={client.vehicle || 'À vérifier'} />
              <SummaryItem label="Catégorie pièces" value={pieceLevels[level].label} />
              <SummaryItem label="Services" value={`${selected.length} sélectionné(s)`} />
            </div>

            <div className="selected-list">
              {selectedServices.map((service) => {
                const parts = adjustRange(service, level)
                return (
                  <div key={service.id} className="selected-line">
                    <span>{service.name}</span>
                    <strong>{euro(service.labour + parts.min + (service.oil ? service.oilLitres * service.oilPricePerLitre : 0))} à {euro(service.labour + parts.max + (service.oil ? service.oilLitres * service.oilPricePerLitre : 0))}</strong>
                  </div>
                )
              })}
            </div>

            <div className="total-card">
              <span>Total estimé</span>
              <strong>{euro(totalMin)} à {euro(totalMax)}</strong>
              <small>Main-d’œuvre {euro(totals.labour)} • Pièces {euro(totals.partsMin)} à {euro(totals.partsMax)} • Huile {euro(totals.oil)}</small>
            </div>

            <label className="field full">
              <span>Message complémentaire</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ajoutez une précision si besoin : bruit, voyant, urgence, disponibilité..." />
            </label>

            <p className="legal">
              Estimation indicative. Les références pièces, la compatibilité véhicule et le tarif final sont vérifiés par EDM AUTO avant confirmation du rendez-vous.
            </p>

            <div className="actions-row">
              <button className="secondary" onClick={() => setStep('services')}>Modifier</button>
              <a className={canSend ? 'primary link-button' : 'primary link-button disabled'} href={canSend ? buildMailto() : undefined}>Envoyer ma demande</a>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function Progress({ current }) {
  const steps = ['Infos', 'Services', 'Récapitulatif']
  return (
    <div className="progress">
      {steps.map((label, index) => (
        <div key={label} className={index + 1 <= current ? 'progress-step active' : 'progress-step'}>
          <span>{index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  )
}

function EstimateBox({ totals, totalMin, totalMax, selectedCount, onNext, disabled }) {
  return (
    <aside className="estimate-box">
      <p className="eyebrow">Votre estimation</p>
      <h3>{selectedCount} service(s) choisi(s)</h3>
      <div className="estimate-line"><span>Main-d’œuvre</span><strong>{euro(totals.labour)}</strong></div>
      <div className="estimate-line"><span>Pièces estimées</span><strong>{euro(totals.partsMin)} à {euro(totals.partsMax)}</strong></div>
      <div className="estimate-line"><span>Huile estimée</span><strong>{euro(totals.oil)}</strong></div>
      <div className="estimate-total"><span>Total</span><strong>{euro(totalMin)} à {euro(totalMax)}</strong></div>
      <button className="primary full-button" disabled={disabled} onClick={onNext}>Voir le récapitulatif</button>
      <p className="micro">Les pièces sont achetées par le client. EDM AUTO valide les références avant intervention.</p>
    </aside>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
