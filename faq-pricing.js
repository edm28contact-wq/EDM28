// Tarifs de prestation issus du catalogue EDM28 ; estimations de pièces réservées à la FAQ.
export const FAQ_PRICE_SERVICES = Object.freeze([
  { id: 'FR_PLAQ_AV', family: 'pads', side: 'front', label: 'plaquettes de frein avant', shorthand: 'plaq av', labor: 69, parts: { city: [20, 40], medium: [30, 60], large: [55, 85] } },
  { id: 'FR_PLAQ_AR', family: 'pads', side: 'rear', label: 'plaquettes de frein arrière', shorthand: 'plaq ar', labor: 69, parts: { city: [20, 40], medium: [30, 60], large: [55, 85] } },
  { id: 'FR_PLAQ_AV_AR', family: 'pads', side: 'both', label: 'plaquettes de frein avant et arrière', shorthand: 'plaq av ar', labor: 130, parts: { city: [40, 80], medium: [60, 120], large: [110, 170] } },
  { id: 'FR_DISC_PLAQ_AV', family: 'disc_pads', side: 'front', label: 'disques et plaquettes de frein avant', shorthand: 'disq plaq av', labor: 99, parts: { city: [95, 135], medium: [120, 170], large: [170, 240] } },
  { id: 'FR_DISC_PLAQ_AR', family: 'disc_pads', side: 'rear', label: 'disques et plaquettes de frein arrière', shorthand: 'disq plaq ar', labor: 99, parts: { city: [90, 130], medium: [115, 160], large: [160, 230] } },
  { id: 'FR_DISC_PLAQ_AV_AR', family: 'disc_pads', side: 'both', label: 'disques et plaquettes de frein avant et arrière', shorthand: 'disq plaq av ar', labor: 189, parts: { city: [190, 260], medium: [240, 330], large: [340, 470] } },
  { id: 'FR_PURGE', family: 'fluid', side: 'none', label: 'purge et remplacement du liquide de frein à la machine', shorthand: 'purge frein', labor: 55, parts: { city: [10, 20], medium: [15, 25], large: [20, 35] } },
  { id: 'SUS_TRIANGLES', family: 'triangles', side: 'front_pair', label: 'triangles de suspension (paire)', shorthand: 'triangles train av', labor: 120, parts: { city: [80, 130], medium: [120, 190], large: [180, 280] } },
  { id: 'DIR_BIELLETTES_ROTULES', family: 'steering', side: 'front_pair', label: 'biellettes ou rotules de direction (paire)', shorthand: 'rotules direction', labor: 70, parts: { city: [35, 70], medium: [55, 95], large: [85, 140] } },
  { id: 'STAB_BIELLETTES', family: 'stabilizer', side: 'front_pair', label: 'biellettes de barre stabilisatrice (paire)', shorthand: 'biellettes barre stab', labor: 50, parts: { city: [25, 45], medium: [35, 60], large: [55, 90] } }
]);

const VEHICLE_NAMES = Object.freeze({
  city: 'citadine',
  medium: 'compacte / berline',
  large: 'SUV / grand véhicule'
});

function fmt(range) {
  return String(range[0]) + ' à ' + String(range[1]) + ' €';
}

export const FAQ_PRICING_KNOWLEDGE = FAQ_PRICE_SERVICES.map((service) => ({
  id: 'pricing_' + service.id.toLowerCase(),
  category: 'Devis & tarifs',
  question: 'Quel est le tarif EDM28 pour ' + service.label + ' ?',
  aliases: [
    'Prix ' + service.shorthand + ' ?',
    'Tarif ' + service.shorthand + ' ?',
    'Combien coûte ' + service.label + ' ?',
    'Quel budget pour ' + service.label + ' ?',
    'Devis ' + service.shorthand + ' ?',
    'Combien pour ' + service.shorthand + ' ?'
  ],
  keywords: ['tarif', 'prix', 'devis', 'combien', 'forfait', service.shorthand, service.label],
  answer: 'Forfait de prestation EDM28 publié pour ' + service.label + ' : ' +
    service.labor + ' €, hors pièces. Estimations de pièces utilisées uniquement par l’assistant, non publiées comme tarifs officiels : citadine ' +
    fmt(service.parts.city) + ', compacte/berline ' + fmt(service.parts.medium) +
    ', SUV/grand véhicule ' + fmt(service.parts.large) +
    '. Demander le type de véhicule avant de chiffrer le budget complet. Les références et prix effectifs sont confirmés avec le devis et le panier fournisseur.'
}));

export function normalizePricingText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COST_INTENT = /\b(prix|tarifs?|cout|coute|couter|combien|budget|devis|montant|facture|facturez|facturation|payer|paie|payez|cher|forfait|euros?|euro|cb|chiffrage|chiffrer)\b/;
const FRONT = /\b(av|avt|avant|devant|front)\b/;
const REAR = /\b(ar|arr|arriere|derriere)\b/;
const PADS = /\b(plaquettes?|plaquetes?|plaqs?|plaks?|plaquett?es?|pqt)\b/;
const DISCS = /\b(disques?|disq|disk|disks?|discs?)\b/;

function vehicleType(q) {
  if (/\b(sportive?s?|sport|performance|gti|gtd|rs)\b/.test(q)) return 'special';
  if (/\b(utilitaires?|fourgon|camionnette|camping car|van)\b/.test(q)) return 'special';
  if (/\b(citadines?|micro citadine|petite voiture|petit vehicule)\b/.test(q)) return 'city';
  if (/\b(compactes?|berlines?|break|familiale?s?|voiture moyenne)\b/.test(q)) return 'medium';
  if (/\b(suv|4x4|crossovers?|monospaces?|grand vehicule|gros vehicule|grande voiture)\b/.test(q)) return 'large';
  return null;
}

function brakeSide(q) {
  if ((FRONT.test(q) && REAR.test(q)) || /\b(les deux|les 2|avant arriere|av ar|4 roues|quatre roues|2 essieux|deux essieux|avant plus arriere)\b/.test(q)) return 'both';
  if (FRONT.test(q)) return 'front';
  if (REAR.test(q)) return 'rear';
  return null;
}

function serviceIntent(q) {
  const hasPads = PADS.test(q);
  const hasDiscs = DISCS.test(q);
  if (hasDiscs && !hasPads) return 'discs_only';
  if (hasDiscs) return 'disc_pads';
  if (hasPads) return 'pads';

  if (/\b(purge|purger|liquide de frein|liquide freins|dot 4|dot4)\b/.test(q)) return 'fluid';
  if (/\b(triangles?|bras de suspension|bras suspension)\b/.test(q)) return 'triangles';
  if (/\b(biellettes?|bielletes?|rotules?)\b/.test(q)) {
    if (/\b(stab|stabilisateur|stabilisatrice|barre stab|anti roulis)\b/.test(q)) return 'stabilizer';
    if (/\b(direction|cremaillere)\b/.test(q)) return 'steering';
    return 'ambiguous_link';
  }
  if (/\b(freins?|freinage)\b/.test(q)) return 'ambiguous_brakes';
  return null;
}

// Le navigateur ne fournit un contexte qu'après une question de précision.
export function isShortPricingFollowUp(value) {
  const q = normalizePricingText(value);
  if (!q || q.length > 110) return false;
  const permitted = new Set(['c','est','une','un','mon','ma','mes','vehicule','voiture','type','je','ai','j','pour','le','la','les','de','des','du','et','ou','en','avec','sur',
    'citadine','citadines','compacte','compact','berline','suv','4x4','grand','grande','gros','vehicule','petite','sportive','sportif','sport','utilitaire',
    'av','avt','avant','devant','ar','arr','arriere','derriere','deux','2','essieux','4','roues',
    'plaquette','plaquettes','plaq','plaqs','disque','disques','disq','direction','rotule','rotules','biellette','biellettes','barre','stab','stabilisatrice','stabilisateur',
    'moyenne','familiale','break','monospace','crossover','performance','fourgon','van']);
  if (!q.split(' ').every((part) => permitted.has(part))) return false;
  return Boolean(vehicleType(q) || brakeSide(q) || serviceIntent(q) && !/ambiguous_brakes/.test(serviceIntent(q)));
}

function response(answer, service, followUp = null) {
  return {
    answer,
    factIds: service ? ['pricing_' + service.id.toLowerCase()] : ['pricing_model'],
    knowledgeId: service ? 'pricing_' + service.id.toLowerCase() : 'pricing_model',
    followUp
  };
}

export function answerPricingQuestion(question, previousQuestion = '') {
  const normalizedQuestion = normalizePricingText(question);
  const q = previousQuestion && isShortPricingFollowUp(question)
    ? normalizePricingText(previousQuestion + ' ' + question)
    : normalizedQuestion;
  if (!COST_INTENT.test(q)) return null;
  // Demandes de tutoriel : ne pas confondre coût d’une prestation et procédure mécanique.
  if (/\b(moi meme|soi meme|tuto|tutoriel|pas a pas|etape par etape)\b/.test(q)) return null;

  const serviceFamily = serviceIntent(q);
  if (!serviceFamily) return null;
  if (serviceFamily === 'discs_only') {
    return response('Le catalogue EDM28 publie des forfaits disques + plaquettes, mais pas un tarif distinct garanti pour les disques seuls. Souhaitez-vous le tarif du remplacement disques et plaquettes ? Sinon, demandez un devis sur https://edm28.fr/demande.', null);
  }
  if (serviceFamily === 'ambiguous_brakes') {
    return response('Pour établir un tarif de freinage, parlez-vous des plaquettes seules ou des disques et plaquettes ? Précisez aussi avant, arrière ou les deux.', null, 'service_brakes');
  }
  if (serviceFamily === 'ambiguous_link') {
    return response('Parlez-vous des biellettes/rotules de direction ou des biellettes de barre stabilisatrice ?', null, 'service_links');
  }

  let side = serviceFamily === 'pads' || serviceFamily === 'disc_pads' ? brakeSide(q) : 'none';
  if ((serviceFamily === 'pads' || serviceFamily === 'disc_pads') && !side) {
    return response('Pour ' + (serviceFamily === 'pads' ? 'les plaquettes' : 'les disques et plaquettes') +
      ', est-ce à l’avant (AV), à l’arrière (AR), ou sur les deux essieux (AV + AR) ?', null, 'side');
  }

  if (['triangles', 'steering', 'stabilizer'].includes(serviceFamily)) {
    if (REAR.test(q) && !FRONT.test(q)) {
      return response('EDM28 ne publie pas de forfait pour cette prestation à l’arrière. Faites vérifier votre demande sur https://edm28.fr/demande.', null);
    }
    side = 'front_pair';
  }

  const service = FAQ_PRICE_SERVICES.find((item) => item.family === serviceFamily && item.side === side);
  if (!service) return null;

  const vehicle = vehicleType(q);
  const lead = 'Pour ' + service.label + ', le forfait de prestation EDM28 publié est de ' +
    service.labor + ' €, hors pièces.';
  if (!vehicle) {
    return response(lead +
      ' Pour estimer le prix des pièces et le budget total, quel type de véhicule avez-vous : citadine, compacte/berline, SUV/grand véhicule, ou modèle sportif/utilitaire ? Vous pouvez aussi préciser marque et modèle.',
      service, 'vehicle');
  }
  if (vehicle === 'special') {
    return response(lead +
      ' Pour un véhicule sportif, utilitaire ou à montage particulier, le prix des pièces et la prestation adaptée doivent être confirmés sur devis après étude du véhicule. Faites votre demande sur https://edm28.fr/demande.',
      service);
  }

  const parts = service.parts[vehicle];
  const total = [service.labor + parts[0], service.labor + parts[1]];
  return response(lead + ' Pour une ' + VEHICLE_NAMES[vehicle] +
    ', les pièces/produits nécessaires sont estimés à ' + fmt(parts) +
    ', soit un budget total indicatif de ' + fmt(total) +
    ' avec la prestation. Ces prix de pièces sont des estimations internes de l’assistant, non publiées comme tarifs officiels et non garanties : le gabarit seul ne permet pas de vérifier les références compatibles. Le client achète et paie directement les pièces auprès du fournisseur. EDM28 fournit les références préconisées et le panier avec le devis après étude de la demande sur https://edm28.fr/demande.',
    service);
}
