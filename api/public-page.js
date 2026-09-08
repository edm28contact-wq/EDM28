import { resolveSupabasePublicConfig } from './supabase-config.js';

const PUBLIC_EMAIL = 'contact@edm28.fr';

const NAV_ITEMS = [
  ['/freinage', 'Freinage'],
  ['/liaison-au-sol', 'Liaison au sol'],
  ['/prestations', 'Prestations'],
  ['/tarifs', 'Tarifs'],
  ['/fonctionnement', 'Fonctionnement'],
  ['/transparence', 'Transparence'],
  ['/a-propos', 'À propos'],
  ['/contact', 'Contact']
];

const PAGES = {
  freinage: {
    path: '/freinage',
    title: 'Freinage automobile | EDM28',
    description: 'Contrôle et interventions de freinage EDM28 : plaquettes, disques et liquide de frein, avec devis avant travaux et suivi client transparent.',
    h1: 'Freinage automobile : contrôle, entretien et remplacement',
    lede: 'Le freinage est la spécialité principale d’EDM28. L’intervention est définie après contrôle, puis présentée au client dans un devis avant travaux.',
    serviceType: 'Entretien et réparation du système de freinage automobile',
    breadcrumbs: [['/', 'Accueil'], ['/freinage', 'Freinage']],
    sections: [
      ['Ce qui est contrôlé', 'EDM28 contrôle les éléments concernés par la demande : état des plaquettes, état visuel des disques, cohérence du freinage et, lorsque la prestation le nécessite, circuit et liquide de frein. Le diagnostic réel du véhicule reste prioritaire sur un symptôme décrit à distance.'],
      ['Quels symptômes doivent conduire à un contrôle ?', 'Bruit au freinage, vibrations, sensation de freinage irrégulière, voyant ou remarque au contrôle technique peuvent justifier un contrôle. Ces signes ne permettent pas à eux seuls d’identifier la pièce à remplacer.'],
      ['Comment EDM28 intervient', 'La demande est étudiée, la prestation est cadrée, puis un devis est soumis au client. Les travaux prévus ne sont engagés qu’après validation. Toute nécessité supplémentaire doit être expliquée et validée avant d’être ajoutée.']
    ],
    links: [['/freinage/plaquettes-de-frein', 'Plaquettes de frein'], ['/freinage/disques-de-frein', 'Disques de frein'], ['/freinage/liquide-de-frein', 'Liquide de frein'], ['/tarifs', 'Voir les tarifs'], ['/fonctionnement', 'Comprendre le parcours EDM28']],
    faq: [
      ['Comment savoir si mes plaquettes de frein sont usées ?', 'Des bruits, un voyant ou un changement de sensation peuvent motiver un contrôle, mais l’usure doit être confirmée sur le véhicule.'],
      ['Quand changer ses disques de frein ?', 'Le remplacement dépend de leur état réel, de l’usure constatée et du contexte du véhicule. EDM28 contrôle avant de proposer la prestation.'],
      ['Pourquoi une voiture vibre au freinage ?', 'Plusieurs causes sont possibles. Un contrôle du freinage et du train roulant permet d’orienter le diagnostic sans conclure uniquement à partir du symptôme.'],
      ['Pourquoi une voiture tire d’un côté au freinage ?', 'Un déséquilibre de freinage ou un autre défaut du train roulant peut être en cause. Le véhicule doit être contrôlé pour identifier l’origine.']
    ]
  },
  'freinage/plaquettes-de-frein': {
    path: '/freinage/plaquettes-de-frein',
    title: 'Plaquettes de frein : contrôle et remplacement | EDM28',
    description: 'EDM28 contrôle l’usure des plaquettes de frein et propose leur remplacement lorsque leur état le justifie, avec devis et validation avant intervention.',
    h1: 'Plaquettes de frein : contrôle et remplacement',
    lede: 'Le remplacement des plaquettes est proposé lorsque leur état le justifie après contrôle. EDM28 distingue la demande initiale de ce qui est réellement nécessaire sur le véhicule.',
    serviceType: 'Contrôle et remplacement de plaquettes de frein',
    breadcrumbs: [['/', 'Accueil'], ['/freinage', 'Freinage'], ['/freinage/plaquettes-de-frein', 'Plaquettes de frein']],
    sections: [
      ['Ce qui est contrôlé', 'L’état et l’usure des plaquettes du train concerné sont vérifiés, ainsi que l’état visible des éléments de freinage associés lorsque cela est accessible et pertinent pour la prestation.'],
      ['Quand faire contrôler les plaquettes ?', 'Un bruit, un voyant, une remarque au contrôle technique ou une évolution du comportement au freinage sont des motifs de contrôle. L’intervention n’est pas décidée sur le seul kilométrage.'],
      ['Ce qui est inclus ou non', 'Le devis précise la prestation retenue. Les pièces, opérations complémentaires ou débours qui ne font pas partie de la prestation initiale doivent être identifiés avant d’être ajoutés.']
    ],
    links: [['/freinage/disques-de-frein', 'Voir les disques de frein'], ['/freinage/liquide-de-frein', 'Voir le liquide de frein'], ['/tarifs', 'Tarifs freinage'], ['/', 'Prendre rendez-vous']],
    faq: [
      ['Comment savoir si mes plaquettes de frein sont usées ?', 'Les symptômes peuvent alerter, mais seul le contrôle du véhicule permet de confirmer l’usure et le train concerné.'],
      ['Faut-il changer disques et plaquettes ensemble ?', 'La décision dépend de l’état des deux éléments. EDM28 vérifie la situation et indique dans le devis la combinaison retenue avant intervention.']
    ]
  },
  'freinage/disques-de-frein': {
    path: '/freinage/disques-de-frein',
    title: 'Disques de frein : contrôle et remplacement | EDM28',
    description: 'Contrôle et remplacement des disques de frein chez EDM28 lorsque leur état le justifie, avec validation du devis avant travaux.',
    h1: 'Disques de frein : contrôle et remplacement',
    lede: 'L’état des disques est évalué avec le freinage concerné. Une vibration ou un bruit peut orienter le contrôle, mais ne suffit pas à conclure à un remplacement.',
    serviceType: 'Contrôle et remplacement de disques de frein',
    breadcrumbs: [['/', 'Accueil'], ['/freinage', 'Freinage'], ['/freinage/disques-de-frein', 'Disques de frein']],
    sections: [
      ['Ce qui est contrôlé', 'EDM28 examine l’état des disques concernés et la cohérence avec l’état des plaquettes et les symptômes décrits. La décision de remplacement est basée sur le contrôle du véhicule.'],
      ['Quand intervenir ?', 'Vibrations au freinage, bruit, corrosion visible ou usure constatée peuvent conduire à un contrôle. La cause doit être vérifiée avant de commander ou remplacer des éléments.'],
      ['Devis avant travaux', 'La prestation prévue est formalisée avant intervention. Si le contrôle révèle un besoin différent ou complémentaire, le client doit en être informé avant toute extension des travaux.']
    ],
    links: [['/freinage/plaquettes-de-frein', 'Voir les plaquettes de frein'], ['/freinage/liquide-de-frein', 'Voir le liquide de frein'], ['/tarifs', 'Tarifs freinage'], ['/', 'Prendre rendez-vous']],
    faq: [
      ['Quand changer ses disques de frein ?', 'Lorsqu’un contrôle montre que leur état nécessite un remplacement. EDM28 ne fixe pas un seuil universel indépendant du véhicule et de la pièce.'],
      ['Pourquoi une voiture vibre au freinage ?', 'Le freinage peut être en cause, mais d’autres éléments du train roulant peuvent aussi intervenir. Un contrôle est nécessaire pour trancher.']
    ]
  },
  'freinage/liquide-de-frein': {
    path: '/freinage/liquide-de-frein',
    title: 'Liquide de frein et purge | EDM28',
    description: 'Purge et remplacement du liquide de frein chez EDM28, avec contrôle du besoin, devis avant intervention et suivi transparent.',
    h1: 'Liquide de frein : contrôle et purge',
    lede: 'Le liquide de frein fait partie du circuit hydraulique. EDM28 propose une purge à la machine lorsque le renouvellement du fluide est prévu ou justifié.',
    serviceType: 'Purge et remplacement du liquide de frein',
    breadcrumbs: [['/', 'Accueil'], ['/freinage', 'Freinage'], ['/freinage/liquide-de-frein', 'Liquide de frein']],
    sections: [
      ['Quand envisager une intervention ?', 'Le besoin peut être lié au plan d’entretien du véhicule, à l’historique disponible, à une intervention sur le circuit ou à un contrôle qui justifie le renouvellement.'],
      ['Comment se déroule la prestation ?', 'La prestation publiée par EDM28 prévoit le remplacement du liquide avec purge à la machine. Le devis confirme ce qui est prévu pour le véhicule avant l’intervention.'],
      ['Ce que la purge ne remplace pas', 'Une purge ne remplace pas le diagnostic d’un défaut mécanique ou hydraulique. Si un autre problème est constaté, il doit être expliqué séparément au client.']
    ],
    links: [['/freinage/plaquettes-de-frein', 'Plaquettes de frein'], ['/freinage/disques-de-frein', 'Disques de frein'], ['/tarifs', 'Voir les tarifs'], ['/', 'Prendre rendez-vous']],
    faq: [
      ['Quand remplacer le liquide de frein ?', 'Il faut se référer aux préconisations du véhicule, à l’historique et au contrôle réalisé. EDM28 évite d’appliquer un intervalle unique à tous les véhicules.'],
      ['Une purge corrige-t-elle tous les problèmes de pédale ?', 'Non. Une sensation anormale peut avoir plusieurs causes ; la purge n’est pertinente que si elle répond au besoin identifié.']
    ]
  },
  'liaison-au-sol': {
    path: '/liaison-au-sol',
    title: 'Liaison au sol et train roulant | EDM28',
    description: 'EDM28 intervient sur des éléments de liaison au sol et de train roulant : triangles, direction et biellettes, avec devis et validation avant travaux.',
    h1: 'Liaison au sol et train roulant',
    lede: 'EDM28 prend en charge plusieurs prestations ciblées du train roulant, en complément de sa spécialisation principale en freinage.',
    serviceType: 'Entretien et réparation de liaison au sol et train roulant',
    breadcrumbs: [['/', 'Accueil'], ['/liaison-au-sol', 'Liaison au sol']],
    sections: [
      ['Ce qui est recherché', 'Jeu, claquement, imprécision de direction ou usure visible peuvent orienter le contrôle. La pièce concernée doit être identifiée sur le véhicule avant de retenir la prestation.'],
      ['Interventions ciblées', 'Le catalogue public EDM28 comprend notamment les triangles de suspension, les biellettes ou rotules de direction et les biellettes de barre stabilisatrice.'],
      ['Validation avant travaux', 'Le besoin constaté est traduit en prestation et en devis. Les travaux supplémentaires ne sont pas ajoutés sans validation du client.']
    ],
    links: [['/liaison-au-sol/triangles', 'Triangles de suspension'], ['/liaison-au-sol/direction', 'Direction et biellettes'], ['/prestations', 'Toutes les prestations'], ['/fonctionnement', 'Fonctionnement EDM28']],
    faq: [
      ['Un claquement indique-t-il forcément un triangle usé ?', 'Non. Plusieurs éléments du train roulant peuvent produire un bruit. Il faut contrôler le véhicule pour identifier la cause.'],
      ['Une imprécision de direction suffit-elle à remplacer une rotule ?', 'Non. Le symptôme motive un contrôle ; le remplacement dépend du jeu ou du défaut effectivement constaté.']
    ]
  },
  'liaison-au-sol/triangles': {
    path: '/liaison-au-sol/triangles',
    title: 'Triangles de suspension : contrôle et remplacement | EDM28',
    description: 'Contrôle et remplacement de triangles de suspension chez EDM28 en cas de jeu, silentbloc ou rotule concernés, après validation du devis.',
    h1: 'Triangles de suspension : contrôle et remplacement',
    lede: 'EDM28 propose le remplacement de la paire de triangles lorsque le contrôle met en évidence un défaut compatible avec cette intervention.',
    serviceType: 'Remplacement de triangles de suspension',
    breadcrumbs: [['/', 'Accueil'], ['/liaison-au-sol', 'Liaison au sol'], ['/liaison-au-sol/triangles', 'Triangles']],
    sections: [
      ['Symptômes possibles', 'Un claquement, du jeu ou une dégradation visible d’un silentbloc ou d’une rotule peuvent conduire à examiner les triangles. Le diagnostic doit confirmer l’élément en cause.'],
      ['Ce qui est proposé', 'La prestation publiée EDM28 vise la paire de triangles de suspension. Le devis détaille la prestation applicable au véhicule avant toute intervention.'],
      ['Après le contrôle', 'Si le défaut constaté concerne un autre élément du train roulant, EDM28 doit adapter la proposition au diagnostic plutôt que remplacer une pièce par défaut.']
    ],
    links: [['/liaison-au-sol/direction', 'Direction et biellettes'], ['/liaison-au-sol', 'Retour liaison au sol'], ['/prestations', 'Prestations'], ['/', 'Prendre rendez-vous']],
    faq: [['Pourquoi un train avant peut-il claquer ?', 'Plusieurs articulations et liaisons peuvent être concernées. Le bruit doit être localisé avant de définir la réparation.']]
  },
  'liaison-au-sol/direction': {
    path: '/liaison-au-sol/direction',
    title: 'Direction : biellettes et rotules | EDM28',
    description: 'Contrôle et remplacement de biellettes ou rotules de direction chez EDM28 lorsque du jeu ou un défaut est constaté, avec devis avant travaux.',
    h1: 'Direction : biellettes, rotules et contrôle du jeu',
    lede: 'Un jeu ou une imprécision de direction doit être localisé avant de retenir une prestation. EDM28 intervient sur des remplacements ciblés du train avant.',
    serviceType: 'Remplacement de biellettes ou rotules de direction',
    breadcrumbs: [['/', 'Accueil'], ['/liaison-au-sol', 'Liaison au sol'], ['/liaison-au-sol/direction', 'Direction']],
    sections: [
      ['Ce qui est contrôlé', 'Le contrôle cherche à confirmer l’élément présentant du jeu ou un défaut compatible avec les symptômes. La direction ne doit pas être réparée sur la seule base d’une impression de conduite.'],
      ['Prestations publiées', 'Le catalogue EDM28 inclut le remplacement de la paire de biellettes ou rotules de direction ainsi que la paire de biellettes de barre stabilisatrice.'],
      ['Devis et périmètre', 'Le devis distingue la prestation prévue des éventuels travaux additionnels. Une extension de l’intervention doit être validée avant exécution.']
    ],
    links: [['/liaison-au-sol/triangles', 'Triangles de suspension'], ['/liaison-au-sol', 'Retour liaison au sol'], ['/tarifs', 'Voir les tarifs'], ['/', 'Prendre rendez-vous']],
    faq: [['Une voiture qui tire d’un côté vient-elle forcément de la direction ?', 'Non. Le freinage, les pneumatiques, la géométrie ou d’autres éléments peuvent intervenir. Le contrôle doit identifier la cause réelle.']]
  },
  prestations: {
    path: '/prestations',
    title: 'Prestations freinage et liaison au sol | EDM28',
    description: 'Découvrez les prestations EDM28 en freinage et liaison au sol, avec devis avant intervention, validation client et historique des documents.',
    h1: 'Prestations EDM28',
    lede: 'Le catalogue EDM28 se concentre sur le freinage et des interventions ciblées de liaison au sol. Les prestations réservables et leurs tarifs sont pilotés par le catalogue public du garage.',
    serviceType: 'Prestations automobiles EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/prestations', 'Prestations']],
    sections: [
      ['Freinage', 'Plaquettes avant ou arrière, plaquettes avant et arrière, disques et plaquettes, freinage complet et purge du liquide de frein font partie des prestations publiques actuellement configurées.'],
      ['Liaison au sol', 'Triangles de suspension, biellettes ou rotules de direction et biellettes de barre stabilisatrice font partie des prestations publiées.'],
      ['Un périmètre clair', 'Chaque demande est rapprochée d’une prestation réelle. Si le véhicule nécessite autre chose, la proposition doit être révisée avant travaux.']
    ],
    links: [['/freinage', 'Freinage'], ['/liaison-au-sol', 'Liaison au sol'], ['/tarifs', 'Tarifs'], ['/fonctionnement', 'Fonctionnement']],
    faq: [['EDM28 fait-il toutes les réparations automobiles ?', 'Non. EDM28 se positionne principalement sur le freinage et des prestations ciblées de liaison au sol. La demande doit rester compatible avec le périmètre réel du garage.']]
  },
  tarifs: {
    path: '/tarifs',
    title: 'Tarifs des prestations | EDM28',
    description: 'Consultez les tarifs publics EDM28 issus du catalogue site_services. Le devis précise le périmètre final avant toute intervention.',
    h1: 'Tarifs des prestations EDM28',
    lede: 'Les montants affichés ci-dessous proviennent directement du catalogue public EDM28. Ils ne sont pas recopiés en dur dans cette page.',
    serviceType: 'Catalogue tarifaire des prestations automobiles EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/tarifs', 'Tarifs']],
    sections: [
      ['Comment lire les tarifs ?', 'Le prix affiché correspond à la valeur publique configurée pour la prestation. Les pièces, débours ou éléments complémentaires sont précisés au devis lorsqu’ils sont nécessaires.'],
      ['Le devis reste la référence', 'Le véhicule et la demande réelle déterminent le périmètre final. EDM28 fait valider le devis avant intervention et n’ajoute pas de travaux supplémentaires sans validation.']
    ],
    links: [['/prestations', 'Voir les prestations'], ['/freinage', 'Freinage'], ['/liaison-au-sol', 'Liaison au sol'], ['/', 'Prendre rendez-vous']],
    faq: [['Les prix de cette page sont-ils saisis manuellement ?', 'Non. La page charge les prestations publiées depuis la table publique site_services afin d’éviter une copie divergente des tarifs.']]
  },
  fonctionnement: {
    path: '/fonctionnement',
    title: 'Comment fonctionne une intervention | EDM28',
    description: 'Découvrez le parcours EDM28 : demande, devis, validation, préparation, intervention, facture, encaissement et historique client.',
    h1: 'Comment fonctionne une intervention chez EDM28 ?',
    lede: 'Le parcours est conçu pour garder une trace claire de la demande, de la validation du client, des documents et de la clôture de l’intervention.',
    serviceType: 'Parcours client et intervention automobile EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/fonctionnement', 'Fonctionnement']],
    sections: [
      ['1. Demande → devis → acceptation', 'Le client formule sa demande. EDM28 prépare la proposition adaptée, puis le devis est présenté avant travaux. L’acceptation du client conditionne la suite.'],
      ['2. Débours lorsque nécessaire → préparation atelier', 'Lorsqu’un débours fait partie du dossier, il est géré dans le flux prévu avant la préparation atelier. Les éléments nécessaires à l’intervention sont ensuite préparés.'],
      ['3. Intervention → clôture → facture', 'L’intervention est réalisée dans le périmètre validé. Le dossier est ensuite clôturé et la facture correspondante est produite.'],
      ['4. Encaissement → historique client', 'L’encaissement est enregistré puis les éléments du dossier et les documents utiles restent accessibles dans l’historique client selon le fonctionnement de l’application.']
    ],
    links: [['/transparence', 'Transparence EDM28'], ['/prestations', 'Prestations'], ['/tarifs', 'Tarifs'], ['/', 'Prendre rendez-vous']],
    faq: [['Comment fonctionne une intervention chez EDM28 ?', 'Demande, devis, acceptation, débours si nécessaire, préparation atelier, intervention, clôture, facture, encaissement puis historique client.']]
  },
  transparence: {
    path: '/transparence',
    title: 'Garage transparent : devis et suivi client | EDM28',
    description: 'EDM28 met en avant un parcours transparent : devis avant travaux, validation client, suivi de l’intervention et conservation des documents utiles.',
    h1: 'La transparence au centre du parcours EDM28',
    lede: 'La transparence signifie que le client connaît le périmètre prévu avant les travaux et que les changements nécessaires sont expliqués avant d’être exécutés.',
    serviceType: 'Suivi transparent des interventions automobiles EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/transparence', 'Transparence']],
    sections: [
      ['Devis avant travaux', 'La prestation prévue est formalisée avant intervention. Le devis sert de référence au périmètre accepté par le client.'],
      ['Pas de travaux supplémentaires sans validation', 'Si un besoin nouveau apparaît, EDM28 doit le présenter au client avant de modifier le périmètre des travaux.'],
      ['Suivi et documents', 'Le parcours applicatif conserve les étapes utiles du dossier et les documents associés afin que le client puisse retrouver l’historique de ses interventions.']
    ],
    links: [['/fonctionnement', 'Voir le fonctionnement'], ['/tarifs', 'Tarifs'], ['/prestations', 'Prestations'], ['/', 'Prendre rendez-vous']],
    faq: [['Comment EDM28 évite-t-il les travaux non prévus ?', 'Le périmètre est défini dans le devis. Un besoin complémentaire doit être présenté et validé avant d’être ajouté à l’intervention.']]
  },
  'a-propos': {
    path: '/a-propos',
    title: 'À propos d’EDM28 | Freinage et liaison au sol',
    description: 'EDM28 est un garage automobile spécialisé en freinage et liaison au sol, avec devis avant intervention et parcours client transparent.',
    h1: 'EDM28 — Garage automobile spécialisé freinage et liaison au sol',
    lede: 'EDM28 est une micro-entreprise orientée vers la mécanique de liaison au sol, avec une spécialisation principale en freinage et un parcours client construit autour de la transparence.',
    serviceType: 'Garage automobile spécialisé freinage et liaison au sol',
    breadcrumbs: [['/', 'Accueil'], ['/a-propos', 'À propos']],
    sections: [
      ['Un périmètre volontairement lisible', 'Le freinage constitue le cœur du positionnement. Les interventions de liaison au sol complètent ce périmètre avec des prestations ciblées du train roulant.'],
      ['Une relation client documentée', 'Le parcours associe demande, devis, validation, intervention, facture et historique afin de réduire les zones floues entre ce qui est demandé, accepté et réalisé.'],
      ['Pas de localisation inventée', 'Les informations locales ne sont publiées que lorsqu’elles sont réellement renseignées dans la configuration EDM28.']
    ],
    links: [['/freinage', 'Freinage'], ['/liaison-au-sol', 'Liaison au sol'], ['/transparence', 'Transparence'], ['/contact', 'Contact']],
    faq: [['Quelle est la spécialité principale d’EDM28 ?', 'Le freinage. EDM28 intervient aussi sur des prestations ciblées de liaison au sol et de train roulant.']]
  },
  contact: {
    path: '/contact',
    title: 'Contact | EDM28',
    description: 'Contactez EDM28 pour une demande liée au freinage ou à la liaison au sol. Email public : contact@edm28.fr.',
    h1: 'Contacter EDM28',
    lede: 'Pour une demande de prestation, utilisez le parcours de rendez-vous du site. Pour un contact général, l’adresse publique EDM28 est contact@edm28.fr.',
    breadcrumbs: [['/', 'Accueil'], ['/contact', 'Contact']],
    sections: [
      ['Demande de rendez-vous', 'Le parcours en ligne permet de préparer la demande et de la relier aux prestations disponibles avant l’étude du dossier.'],
      ['Email public', 'Vous pouvez écrire à contact@edm28.fr. Aucune adresse postale ni aucun numéro de téléphone n’est publié ici tant que ces informations ne sont pas renseignées dans la configuration publique.']
    ],
    links: [['/', 'Prendre rendez-vous'], ['/prestations', 'Prestations'], ['/fonctionnement', 'Fonctionnement'], ['/transparence', 'Transparence']],
    faq: [['Comment contacter EDM28 ?', 'L’email public est contact@edm28.fr. Le site permet également de préparer une demande de rendez-vous.']]
  }
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getOrigin(req) {
  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'http' ? 'http' : 'https';
  const host = String(req.headers?.host || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return `${protocol}://localhost`;
  return `${protocol}://${host}`;
}

function getSlug(req) {
  if (typeof req.query?.slug === 'string') return req.query.slug.replace(/^\/+|\/+$/g, '');
  try {
    return new URL(req.url || '', 'http://localhost').searchParams.get('slug')?.replace(/^\/+|\/+$/g, '') || '';
  } catch (_) {
    return '';
  }
}

async function loadPublishedServices() {
  try {
    const supabase = resolveSupabasePublicConfig();
    if (!supabase.url || !supabase.key) return [];
    const params = new URLSearchParams({
      select: 'name,category,slug,client_description,pricing_type,displayed_price,labor_price,online_booking_enabled,display_order',
      active: 'eq.true',
      published_at: 'not.is.null',
      order: 'display_order.asc'
    });
    const response = await fetch(`${supabase.url}/rest/v1/site_services?${params}`, {
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`
      }
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('SEO services load error', error);
    return [];
  }
}

function renderTariffs(services) {
  if (!services.length) {
    return '<div class="notice">Le catalogue tarifaire est temporairement indisponible. Le devis reste la référence avant intervention.</div>';
  }
  const cards = services.map((service) => {
    const quote = service.pricing_type === 'quote';
    const amount = Number(service.displayed_price);
    const price = quote ? 'Sur devis' : Number.isFinite(amount) ? `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €` : 'À confirmer';
    return `<article class="price-card"><div><span>${esc(service.category || 'Prestation')}</span><h3>${esc(service.name)}</h3></div><strong>${esc(price)}</strong><p>${esc(service.client_description || '')}</p></article>`;
  }).join('');
  return `<section aria-labelledby="catalogue-tarifs"><h2 id="catalogue-tarifs">Catalogue public actuel</h2><div class="price-grid">${cards}</div><p class="small">Tarifs chargés depuis le catalogue public EDM28. Le devis confirme le périmètre final de l’intervention.</p></section>`;
}

function structuredData(page, origin) {
  const canonical = `${origin}${page.path}`;
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'EDM28',
      url: `${origin}/`,
      email: PUBLIC_EMAIL,
      description: 'Garage automobile spécialisé freinage et liaison au sol, avec parcours client transparent et devis avant intervention.'
    },
    {
      '@type': 'AutoRepair',
      '@id': `${origin}/#autorepair`,
      name: 'EDM28',
      url: `${origin}/`,
      email: PUBLIC_EMAIL,
      description: 'Garage automobile spécialisé freinage et liaison au sol.'
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumbs.map(([path, name], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: `${origin}${path}`
      }))
    }
  ];
  if (page.serviceType) {
    graph.push({
      '@type': 'Service',
      name: page.h1,
      serviceType: page.serviceType,
      description: page.description,
      url: canonical,
      provider: { '@id': `${origin}/#autorepair` }
    });
  }
  if (page.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }))
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
}

function renderPage(page, origin, services = []) {
  const canonical = `${origin}${page.path}`;
  const breadcrumbs = page.breadcrumbs.map(([path, name], index) => {
    const current = index === page.breadcrumbs.length - 1;
    return current ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${esc(path)}">${esc(name)}</a>`;
  }).join('<span aria-hidden="true">›</span>');
  const sections = page.sections.map(([title, text]) => `<section><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`).join('');
  const links = page.links.map(([path, label]) => `<a class="link-card" href="${esc(path)}">${esc(label)}<span aria-hidden="true">→</span></a>`).join('');
  const faq = page.faq?.length ? `<section aria-labelledby="faq-title"><h2 id="faq-title">Questions fréquentes</h2><div class="faq">${page.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p><strong>Réponse courte :</strong> ${esc(a)}</p></details>`).join('')}</div></section>` : '';
  const tariffs = page.path === '/tarifs' ? renderTariffs(services) : '';
  const jsonLd = structuredData(page, origin);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="EDM28">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(origin)}/logo-edm.svg">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f5f2ee;line-height:1.6}*{box-sizing:border-box}body{margin:0}a{color:inherit}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.site-header{background:#111827;color:#fff}.header-row{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-weight:900;letter-spacing:.08em;text-decoration:none}.nav{display:flex;flex-wrap:wrap;gap:16px;font-size:.92rem}.nav a{text-decoration:none;color:#e5e7eb}.hero{padding:72px 0 54px;background:linear-gradient(135deg,#fff,#ede7e0)}.crumbs{display:flex;gap:8px;flex-wrap:wrap;font-size:.9rem;color:#5d6470;margin-bottom:22px}.crumbs a{color:#374151}h1{font-size:clamp(2.2rem,6vw,4.6rem);line-height:1.02;letter-spacing:-.05em;max-width:900px;margin:0}.lead{max-width:760px;font-size:1.15rem;color:#4b5563;margin:22px 0}.cta{display:inline-flex;background:#111827;color:#fff;text-decoration:none;padding:13px 18px;border-radius:999px;font-weight:800}.content{padding:54px 0 80px}.content section{background:#fff;border:1px solid #ded8d1;border-radius:24px;padding:28px;margin:0 0 20px}h2{font-size:1.65rem;letter-spacing:-.03em;margin:0 0 10px}h3{margin:0}.content p{margin:0;color:#535b66}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:30px 0}.link-card{display:flex;justify-content:space-between;gap:12px;background:#111827;color:#fff;text-decoration:none;border-radius:18px;padding:18px;font-weight:800}.faq{display:grid;gap:10px}.faq details{border-top:1px solid #e5e7eb;padding:14px 0}.faq summary{font-weight:800;cursor:pointer}.price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.price-card{border:1px solid #e5e7eb;border-radius:18px;padding:18px}.price-card span{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280}.price-card strong{display:block;font-size:1.35rem;margin:10px 0}.price-card p{font-size:.93rem}.notice{padding:18px;border-radius:16px;background:#f3f4f6}.small{font-size:.9rem;color:#6b7280;margin-top:16px}.site-footer{border-top:1px solid #d8d2ca;padding:28px 0 42px;color:#5d6470}.site-footer p{margin:0}.email{font-weight:800}@media(max-width:760px){.header-row{align-items:flex-start;flex-direction:column;padding:18px 0}.nav{gap:10px}.hero{padding-top:46px}.content section{padding:22px}}
</style>
</head>
<body>
<header class="site-header"><div class="wrap header-row"><a class="brand" href="/">EDM28</a><nav class="nav" aria-label="Navigation principale">${NAV_ITEMS.map(([path, label]) => `<a href="${path}">${label}</a>`).join('')}</nav></div></header>
<main>
<div class="hero"><div class="wrap"><nav class="crumbs" aria-label="Fil d’Ariane">${breadcrumbs}</nav><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lede)}</p><a class="cta" href="/">Prendre rendez-vous</a></div></div>
<div class="wrap content">${sections}${tariffs}<div class="links" aria-label="Pages liées">${links}</div>${faq}</div>
</main>
<footer class="site-footer"><div class="wrap"><p><strong>EDM28</strong> — Garage automobile spécialisé freinage et liaison au sol.</p><p>Contact public : <a class="email" href="mailto:${PUBLIC_EMAIL}">${PUBLIC_EMAIL}</a></p></div></footer>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const page = PAGES[getSlug(req)];
  if (!page) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(404).send('<!doctype html><html lang="fr"><head><meta name="robots" content="noindex,nofollow"><title>Page introuvable | EDM28</title></head><body><main><h1>Page introuvable</h1><p><a href="/">Retour à l’accueil</a></p></main></body></html>');
  }
  const services = page.path === '/tarifs' ? await loadPublishedServices() : [];
  const html = renderPage(page, getOrigin(req), services);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', page.path === '/tarifs' ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(html);
}
