const GRADE_MULTIPLIER = {
  eco: 0.88,
  standard: 1,
  premium: 1.22
}

function round(value) {
  return Math.round(Number(value || 0))
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function clampRange(min, max) {
  const low = Math.max(0, round(min))
  const high = Math.max(low, round(max))
  return [low, high]
}

function fallbackEstimate(payload) {
  const vehicleText = normalize([
    payload?.vehicle?.makeModel,
    payload?.vehicle?.engine,
    payload?.vehicle?.energy,
    payload?.vehicle?.year
  ].join(' '))

  const grade = payload?.grade || 'standard'
  const multiplier = GRADE_MULTIPLIER[grade] || 1
  let partsMin = 0
  let partsMax = 0

  for (const service of payload?.selectedServices || []) {
    const base = service.localRange || [0, 0]
    let vehicleFactor = 1

    if (vehicleText.includes('bmw') || vehicleText.includes('audi') || vehicleText.includes('mercedes')) vehicleFactor = 1.25
    if (vehicleText.includes('suv') || vehicleText.includes('3008') || vehicleText.includes('tiguan') || vehicleText.includes('qashqai')) vehicleFactor = 1.18
    if (vehicleText.includes('clio') || vehicleText.includes('208') || vehicleText.includes('c3') || vehicleText.includes('twingo')) vehicleFactor = 0.9

    const [min, max] = clampRange(base[0] * multiplier * vehicleFactor, base[1] * multiplier * vehicleFactor)
    partsMin += min
    partsMax += max
  }

  const labor = (payload?.selectedServices || []).reduce((sum, service) => sum + Number(service.labor || 0), 0)
  const oilChange = payload?.oilChange || {}
  const oil = oilChange.selected && oilChange.mode === 'garage' && oilChange.garageOil
    ? round(Number(oilChange.oilCapacity || 0) * Number(oilChange.garageOil.pricePerLiter || 0))
    : 0

  return {
    source: 'fallback-regles-edm-auto',
    confidence: 'moyenne',
    totals: {
      labor: round(labor),
      partsMin: round(partsMin),
      partsMax: round(partsMax),
      oil,
      totalMin: round(labor + partsMin + oil),
      totalMax: round(labor + partsMax + oil)
    },
    reasoning: 'Estimation calculée avec les règles internes EDM AUTO. À remplacer ou confirmer avec une API IA et des prix de pièces réels.'
  }
}

function extractJson(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('Réponse IA vide')

  try {
    return JSON.parse(raw)
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Réponse IA non JSON')
    return JSON.parse(match[0])
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const payload = req.body || {}
  const fallback = fallbackEstimate(payload)

  if (!process.env.OPENAI_API_KEY) {
    res.status(200).json(fallback)
    return
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
    const prompt = `Tu es un assistant d'estimation pour EDM AUTO, garage spécialisé freinage.\n\nRègles métier :\n- Le client achète les pièces.\n- EDM AUTO facture la main-d’œuvre.\n- La vidange n'est qu'une annexe à une réparation freinage.\n- Donne une fourchette pièces réaliste et resserrée selon le véhicule, le service et la gamme éco / standard / premium.\n- Ne fais pas de devis définitif.\n- Garde la main-d’œuvre reçue telle quelle.\n- Réponds uniquement en JSON valide.\n\nFormat JSON obligatoire :\n{\n  "source": "openai",\n  "confidence": "faible|moyenne|haute",\n  "totals": {\n    "labor": number,\n    "partsMin": number,\n    "partsMax": number,\n    "oil": number,\n    "totalMin": number,\n    "totalMax": number\n  },\n  "reasoning": "courte explication client"\n}\n\nDonnées : ${JSON.stringify(payload)}`

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 900
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.status(200).json({ ...fallback, source: 'fallback-openai-erreur', reasoning: `IA indisponible, fallback utilisé. Détail : ${errorText.slice(0, 160)}` })
      return
    }

    const data = await response.json()
    const outputText = data.output_text || data.output?.flatMap(item => item.content || []).map(content => content.text || '').join('\n') || ''
    const parsed = extractJson(outputText)

    const labor = fallback.totals.labor
    const oil = fallback.totals.oil
    const partsMin = round(parsed?.totals?.partsMin)
    const partsMax = Math.max(partsMin, round(parsed?.totals?.partsMax))

    res.status(200).json({
      source: 'openai',
      confidence: parsed.confidence || 'moyenne',
      totals: {
        labor,
        partsMin,
        partsMax,
        oil,
        totalMin: labor + partsMin + oil,
        totalMax: labor + partsMax + oil
      },
      reasoning: parsed.reasoning || 'Estimation IA indicative à vérifier par EDM AUTO.'
    })
  } catch (error) {
    res.status(200).json({ ...fallback, source: 'fallback-erreur-api', reasoning: `Fallback utilisé : ${error.message}` })
  }
}
