import { resolveSupabasePublicConfig } from './supabase-config.js';

const PUBLIC_EMAIL = 'contact@edm28.fr';

const NAV_ITEMS = [
  ['/', 'Accueil'],
  ['/mes-interventions', 'Mes interventions'],
  ['/fonctionnement', 'Fonctionnement'],
  ['/transparence', 'Conseils & FAQ'],
  ['/a-propos', 'À propos'],
  ['/contact', 'Contact']
];

const PAGES = {
  accueil: {
    path: '/',
    title: 'Freinage et liaison au sol | EDM28',
    description: 'Découvrez EDM28 en freinage et liaison au sol, avec demande d’intervention, devis avant travaux, suivi client et tarifs publics.',
    h1: 'EDM28',
    lede: 'Freinage et interventions ciblées de liaison au sol. Retrouvez ici les travaux proposés, les tarifs et l’accès direct à votre demande d’intervention.',
    serviceType: 'Interventions automobiles EDM28',
    breadcrumbs: [['/', 'Accueil']],
    sections: [
      ['Freinage', 'Plaquettes, disques et purge du liquide de frein font partie des interventions proposées. Lors des démontages concernés, EDM28 nettoie les points de corrosion accessibles et remonte avec une graisse adaptée sur les portées prévues, jamais sur les surfaces de friction, afin de limiter le retour de corrosion.'],
      ['Liaison au sol', 'Triangles de suspension, biellettes ou rotules de direction et biellettes de barre stabilisatrice font partie des interventions publiées.'],
      ['Un périmètre clair', 'Chaque demande est rapprochée d’un besoin réel. Si le véhicule nécessite autre chose, la proposition doit être révisée avant travaux.']
    ],
    links: [['/freinage', 'Freinage'], ['/liaison-au-sol', 'Liaison au sol'], ['/tarifs', 'Tarifs et catalogue'], ['/transparence', 'Conseils & FAQ'], ['/demande', 'Faire une demande']],
    faq: [['EDM28 fait-il toutes les réparations automobiles ?', 'Non. EDM28 se positionne principalement sur le freinage et des interventions ciblées de liaison au sol. La demande doit rester compatible avec le périmètre réel du garage.']]
  },
  demande: {
    path: '/demande',
    title: 'Faire une demande d’intervention | EDM28',
    description: 'Préparez votre demande d’intervention EDM28 : véhicule, prestation, symptômes et coordonnées, puis transmettez le dossier après connexion.',
    h1: 'Faire une demande d’intervention',
    lede: 'Commencez par votre véhicule et votre besoin. Le compte n’est demandé qu’au moment de transmettre la demande et de suivre le dossier.',
    serviceType: 'Demande d’intervention automobile EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/demande', 'Faire une demande']],
    sections: [],
    links: [['/', 'Voir les prestations'], ['/transparence', 'Conseils & FAQ'], ['/mes-interventions', 'Mes interventions']],
    faq: []
  },
  'mes-interventions': {
    path: '/mes-interventions',
    title: 'Mes interventions | EDM28',
    description: 'Espace client EDM28 : véhicules, demandes, devis, pièces, rendez-vous, ordres de réparation, contrôles, factures et documents.',
    h1: 'Mes interventions',
    lede: 'Tous vos véhicules et tous leurs dossiers au même endroit, dans la même interface EDM28.',
    breadcrumbs: [['/', 'Accueil'], ['/mes-interventions', 'Mes interventions']],
    sections: [],
    links: [['/demande', 'Faire une nouvelle demande'], ['/', 'Prestations'], ['/transparence', 'Conseils & FAQ']],
    faq: []
  },
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
    links: [['/freinage/disques-de-frein', 'Voir les disques de frein'], ['/freinage/liquide-de-frein', 'Voir le liquide de frein'], ['/tarifs', 'Tarifs freinage'], ['/demande', 'Faire une demande']],
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
    links: [['/freinage/plaquettes-de-frein', 'Voir les plaquettes de frein'], ['/freinage/liquide-de-frein', 'Voir le liquide de frein'], ['/tarifs', 'Tarifs freinage'], ['/demande', 'Faire une demande']],
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
    links: [['/freinage/plaquettes-de-frein', 'Plaquettes de frein'], ['/freinage/disques-de-frein', 'Disques de frein'], ['/tarifs', 'Voir les tarifs'], ['/demande', 'Faire une demande']],
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
    links: [['/liaison-au-sol/triangles', 'Triangles de suspension'], ['/liaison-au-sol/direction', 'Direction et biellettes'], ['/', 'Toutes les prestations'], ['/fonctionnement', 'Fonctionnement EDM28']],
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
    links: [['/liaison-au-sol/direction', 'Direction et biellettes'], ['/liaison-au-sol', 'Retour liaison au sol'], ['/', 'Prestations'], ['/demande', 'Faire une demande']],
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
    links: [['/liaison-au-sol/triangles', 'Triangles de suspension'], ['/liaison-au-sol', 'Retour liaison au sol'], ['/tarifs', 'Voir les tarifs'], ['/demande', 'Faire une demande']],
    faq: [['Une voiture qui tire d’un côté vient-elle forcément de la direction ?', 'Non. Le freinage, les pneumatiques, la géométrie ou d’autres éléments peuvent intervenir. Le contrôle doit identifier la cause réelle.']]
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
      ['Ce qui est compris dans le travail', 'Le prix affiché correspond à la prestation publique configurée. Pour les démontages de freinage concernés, la préparation comprend le nettoyage des points de corrosion accessibles et un remontage avec graisse adaptée uniquement sur les portées prévues, jamais sur les surfaces de friction, afin de limiter la corrosion future. Les pièces, débours ou éléments complémentaires restent précisés au devis.'],
      ['Le devis reste la référence', 'Le véhicule et la demande réelle déterminent le périmètre final. EDM28 fait valider le devis avant intervention et n’ajoute pas de travaux supplémentaires sans validation.']
    ],
    links: [['/', 'Voir les prestations'], ['/freinage', 'Freinage'], ['/liaison-au-sol', 'Liaison au sol'], ['/demande', 'Faire une demande']],
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
    links: [['/transparence', 'Conseils & FAQ'], ['/', 'Prestations et tarifs'], ['/?page=history', 'Mes interventions'], ['/demande', 'Faire une demande']],
    faq: [['Comment fonctionne une intervention chez EDM28 ?', 'Demande, devis, acceptation, débours si nécessaire, préparation atelier, intervention, clôture, facture, encaissement puis historique client.']]
  },
  transparence: {
    path: '/transparence',
    title: 'Conseils auto et questions fréquentes | EDM28',
    description: 'Comprendre ses freins, le train roulant et le fonctionnement transparent d’EDM28 : conseils pratiques, réponses courtes et futurs shorts vidéo explicatifs.',
    h1: 'Conseils & FAQ EDM28',
    lede: 'Un espace simple pour comprendre pourquoi une intervention peut être nécessaire, quand faire contrôler le véhicule et comment EDM28 informe ses clients avant, pendant et après les travaux.',
    serviceType: 'Conseils pédagogiques et information client EDM28',
    breadcrumbs: [['/', 'Accueil'], ['/transparence', 'Conseils & FAQ']],
    sections: [
      ['Pourquoi faire contrôler ses freins ?', 'Les freins s’usent progressivement et certains signes — bruit, vibration, voyant, sensation différente à la pédale ou remarque au contrôle technique — doivent conduire à un contrôle. Le but n’est pas de remplacer des pièces automatiquement, mais de vérifier l’état réel du véhicule.'],
      ['Quand intervenir sur le freinage ?', 'Il n’existe pas un kilométrage unique valable pour tous les véhicules. L’usage, le type de trajet, l’état des disques et plaquettes, l’historique d’entretien et les préconisations du véhicule comptent. EDM28 contrôle avant de proposer une intervention.'],
      ['Pourquoi surveiller la liaison au sol ?', 'Triangles, rotules, biellettes et autres articulations guident et maintiennent le train roulant. Jeu, claquement, comportement imprécis ou usure anormale justifient un contrôle pour localiser la cause avant remplacement.'],
      ['La transparence EDM28 envers ses clients', 'Le client connaît le périmètre prévu avant travaux. Le devis sert de référence. Un besoin supplémentaire doit être expliqué et validé avant d’être ajouté. Les étapes, documents et factures restent rattachés au dossier de l’intervention.']
    ],
    shorts: [
      ['Pourquoi les plaquettes de frein s’usent ?', '30 à 60 secondes pour comprendre le rôle des plaquettes et les principaux signes à surveiller.'],
      ['Quand faut-il contrôler ses disques ?', 'Un format court sur les symptômes possibles et pourquoi un contrôle reste nécessaire avant remplacement.'],
      ['Pourquoi un train avant peut claquer ?', 'Une explication simple des triangles, rotules et biellettes sans transformer un symptôme en diagnostic automatique.'],
      ['Comment EDM28 valide des travaux supplémentaires ?', 'Le principe de transparence : contrôle, explication, validation client puis seulement intervention.']
    ],
    links: [['/freinage', 'Tout sur le freinage'], ['/liaison-au-sol', 'Comprendre la liaison au sol'], ['/', 'Voir les prestations'], ['/fonctionnement', 'Parcours EDM28']],
    faq: [
      ['Comment savoir si mes plaquettes sont usées ?', 'Un bruit, un voyant ou une évolution du freinage peuvent alerter, mais le contrôle du véhicule confirme l’usure réelle.'],
      ['Faut-il changer disques et plaquettes ensemble ?', 'Pas systématiquement. Leur état doit être vérifié ensemble avant de décider du remplacement.'],
      ['Quand remplacer le liquide de frein ?', 'Il faut tenir compte des préconisations du véhicule, de l’historique d’entretien et du contrôle réalisé.'],
      ['Un claquement du train avant indique-t-il forcément un triangle ?', 'Non. Plusieurs articulations peuvent produire des bruits proches ; le jeu doit être localisé avant de remplacer une pièce.'],
      ['Comment EDM28 évite-t-il les travaux non prévus ?', 'Le devis fixe le périmètre accepté. Toute nécessité complémentaire doit être expliquée et validée avant intervention.'],
      ['Où retrouver les documents de mon intervention ?', 'Dans Mes interventions, avec le véhicule concerné, le suivi du dossier et les documents disponibles.']
    ]
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
    links: [['/', 'Prestations'], ['/transparence', 'Conseils & FAQ'], ['/fonctionnement', 'Fonctionnement'], ['/contact', 'Contact']],
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
    links: [['/demande', 'Faire une demande'], ['/', 'Prestations'], ['/fonctionnement', 'Fonctionnement'], ['/transparence', 'Conseils & FAQ']],
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

function renderPage(page, origin, services = [], clientConfig = null) {
  const canonical = `${origin}${page.path}`;
  const breadcrumbs = page.breadcrumbs.map(([path, name], index) => {
    const current = index === page.breadcrumbs.length - 1;
    return current ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${esc(path)}">${esc(name)}</a>`;
  }).join('<span aria-hidden="true">›</span>');
  const sections = page.path === '/'
    ? `<div class="service-grid" aria-label="Prestations principales">
        <a class="service-card" href="/freinage">
          <div class="service-visual" aria-hidden="true">
            <svg viewBox="0 0 640 320" role="img">
              <defs>
                <radialGradient id="disc" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#637083"/><stop offset=".55" stop-color="#313b49"/><stop offset="1" stop-color="#151c27"/></radialGradient>
                <linearGradient id="metal" x1="0" x2="1"><stop offset="0" stop-color="#aeb8c5"/><stop offset="1" stop-color="#465261"/></linearGradient>
              </defs>
              <rect width="640" height="320" fill="#0a1019"/>
              <circle cx="410" cy="162" r="112" fill="url(#disc)" stroke="#667385" stroke-width="5"/>
              <circle cx="410" cy="162" r="66" fill="#111925" stroke="#778496" stroke-width="4"/>
              <circle cx="410" cy="162" r="20" fill="#9ba6b4"/>
              <g fill="#111925">
                <circle cx="410" cy="80" r="7"/><circle cx="486" cy="112" r="7"/><circle cx="492" cy="199" r="7"/><circle cx="410" cy="244" r="7"/><circle cx="330" cy="199" r="7"/><circle cx="332" cy="112" r="7"/>
              </g>
              <path d="M262 85c38 7 75 27 98 57-18 24-22 60-10 89-31 30-73 47-119 42l-42-48 12-103z" fill="url(#metal)" opacity=".9"/>
              <rect x="0" y="252" width="640" height="68" fill="rgba(0,0,0,.24)"/>
            </svg>
          </div>
          <div class="service-body">
            <div class="service-top"><h2>Freinage</h2><span class="service-arrow" aria-hidden="true">›</span></div>
            <p>Plaquettes, disques et liquide de frein, avec nettoyage des points de corrosion accessibles et remontage protégé sur les portées prévues, hors surfaces de friction.</p>
          </div>
        </a>
        <a class="service-card" href="/liaison-au-sol">
          <div class="service-visual" aria-hidden="true">
            <svg viewBox="0 0 640 320" role="img">
              <defs>
                <linearGradient id="arm" x1="0" x2="1"><stop offset="0" stop-color="#536070"/><stop offset=".5" stop-color="#b2bac4"/><stop offset="1" stop-color="#343f4c"/></linearGradient>
              </defs>
              <rect width="640" height="320" fill="#091019"/>
              <g stroke="#8c98a8" stroke-width="14" fill="none">
                <path d="M410 25c-50 28-44 65 0 89s45 61 0 87-43 61 6 92"/>
                <path d="M452 25c-50 28-44 65 0 89s45 61 0 87-43 61 6 92" opacity=".7"/>
              </g>
              <path d="M95 236l215-118 75 48-192 122z" fill="url(#arm)"/>
              <circle cx="303" cy="128" r="31" fill="#222b37" stroke="#9ca6b2" stroke-width="10"/>
              <circle cx="188" cy="244" r="27" fill="#222b37" stroke="#8f9aa8" stroke-width="9"/>
              <path d="M396 57l66 181" stroke="#d9864b" stroke-width="10" opacity=".55"/>
            </svg>
          </div>
          <div class="service-body">
            <div class="service-top"><h2>Liaison au sol</h2><span class="service-arrow" aria-hidden="true">›</span></div>
            <p>Triangles, rotules, biellettes et éléments ciblés du train roulant après contrôle du véhicule.</p>
          </div>
        </a>
        <a class="service-card" href="/tarifs">
          <div class="service-visual service-visual-price" aria-hidden="true">
            <svg viewBox="0 0 640 320" role="img">
              <rect width="640" height="320" fill="#0a1019"/>
              <rect x="160" y="58" width="320" height="204" rx="26" fill="#172235" stroke="#596678" stroke-width="4"/>
              <path d="M216 110h208M216 154h148M216 198h184" stroke="#aab5c4" stroke-width="12" stroke-linecap="round"/>
              <circle cx="430" cy="196" r="52" fill="#d9864b" opacity=".9"/>
              <path d="M446 176c-10-9-34-8-34 7 0 23 45 8 45 31 0 17-27 19-42 8M435 162v74" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="service-body">
            <div class="service-top"><h2>Tarifs</h2><span class="service-arrow" aria-hidden="true">›</span></div>
            <p>Consultez le catalogue public EDM28. Le devis confirme ensuite le périmètre exact avant intervention.</p>
          </div>
        </a>
      </div>
      <section class="scope-card"><h2>${esc(page.sections[2][0])}</h2><p>${esc(page.sections[2][1])}</p></section>`
    : page.sections.map(([title, text]) => `<section><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`).join('');
  const links = page.links.map(([path, label]) => `<a class="link-card" href="${esc(path)}">${esc(label)}<span aria-hidden="true">→</span></a>`).join('');
  const faq = page.faq?.length ? `<section aria-labelledby="faq-title"><h2 id="faq-title">Questions fréquentes</h2><div class="faq">${page.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p><strong>Réponse courte :</strong> ${esc(a)}</p></details>`).join('')}</div></section>` : '';
  const shorts = page.shorts?.length ? `<section class="shorts-section" aria-labelledby="shorts-title"><div class="section-kicker">Bientôt en vidéo</div><h2 id="shorts-title">Les shorts EDM28</h2><p class="shorts-intro">De courtes vidéos TikTok viendront compléter ces réponses. Aucun lien officiel EDM28 n’est encore configuré, donc aucun faux lien n’est affiché.</p><div class="shorts-grid">${page.shorts.map(([title, description]) => `<article class="short-card"><div class="short-badge" aria-hidden="true">▶</div><div><h3>${esc(title)}</h3><p>${esc(description)}</p><span class="short-coming">Lien TikTok à ajouter</span></div></article>`).join('')}</div></section>` : '';
  const tariffs = page.path === '/tarifs' ? renderTariffs(services) : '';
  const clientSurface = page.path === '/'
    ? '<div id="edmHomeClientApp"></div>'
    : page.path === '/demande'
      ? '<div id="edmRequestApp"></div>'
      : page.path === '/mes-interventions'
        ? '<div id="edmInterventionsApp"></div>'
        : '';
  const bodyContent = (page.path === '/demande' || page.path === '/mes-interventions')
    ? `${clientSurface}<div class="links" aria-label="Pages liées">${links}</div>`
    : `${sections}${tariffs}${shorts}${clientSurface}<div class="links" aria-label="Pages liées">${links}</div>${faq}`;
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
<link rel="stylesheet" href="/public-site.css?v=5">
${['/','/demande','/mes-interventions'].includes(page.path) ? '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>' : ''}
</head>
<body>
<header class="site-header"><div class="wrap header-row"><a class="brand" href="/">EDM28</a><nav class="desktop-nav" aria-label="Navigation principale">${NAV_ITEMS.map(([path, label]) => `<a href="${path}"${page.path === path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav><button class="menu-toggle" type="button" data-menu-toggle aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobile-menu"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></header>
<div class="menu-backdrop" data-menu-backdrop></div>
<aside class="mobile-drawer" id="mobile-menu" data-mobile-drawer aria-hidden="true">
  <div class="drawer-head"><span class="drawer-brand">EDM28</span><button class="drawer-close" type="button" data-menu-close aria-label="Fermer le menu"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <nav class="drawer-nav" aria-label="Navigation mobile">
    ${NAV_ITEMS.map(([path, label]) => {
      const icons = {
        '/':'<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
        '/mes-interventions':'<svg viewBox="0 0 24 24"><path d="M4 6h16v14H4z"/><path d="M7 3h10v3H7zM8 10h8M8 14h8"/></svg>',
        '/freinage':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
        '/liaison-au-sol':'<svg viewBox="0 0 24 24"><path d="M9 3v5l-3 3v5l3 3v2M15 3v5l3 3v5l-3 3v2M9 12h6"/></svg>',
        '/prestations':'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
        '/tarifs':'<svg viewBox="0 0 24 24"><path d="M3 12l9-9h7l2 2v7l-9 9z"/><circle cx="17" cy="7" r="1"/></svg>',
        '/fonctionnement':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
        '/transparence':'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.1-7 10-4-1.9-7-5.5-7-10V6z"/><path d="M12 7v10"/></svg>',
        '/a-propos':'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M14 15c3.5 0 6 1.6 7 5"/></svg>',
        '/contact':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></svg>'
      };
      return `<a href="${path}"${page.path === path ? ' aria-current="page"' : ''}><span class="nav-icon">${icons[path] || ''}</span><span class="nav-label">${label}</span><span class="nav-arrow" aria-hidden="true">›</span></a>`;
    }).join('')}
  </nav>
  <div class="drawer-bottom">
    <a class="drawer-cta" href="/demande"><span>Faire une demande</span><span aria-hidden="true">→</span></a>
    <div class="drawer-contact">Une question ?<a href="mailto:${PUBLIC_EMAIL}">${PUBLIC_EMAIL}</a></div>
  </div>
</aside>
<main>
<div class="hero${page.path === '/' ? ' hero-home' : ''}"><div class="wrap"><nav class="crumbs" aria-label="Fil d’Ariane">${breadcrumbs}</nav>${page.path === '/' ? '<div class="hero-kicker"><span></span>Freinage <b>•</b> Liaison au sol</div>' : ''}<h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lede)}</p><a class="cta" href="/demande">Faire une demande</a>${page.path === '/' ? '<div class="hero-trust" aria-label="Engagements EDM28"><span>Devis avant travaux</span><span>Pas de marge sur les pièces</span><span>Suivi client transparent</span></div>' : ''}</div></div>
<div class="wrap content">${bodyContent}</div>
</main>
<footer class="site-footer"><div class="wrap"><p><strong>EDM28</strong> — Garage automobile spécialisé freinage et liaison au sol.</p><p>Contact public : <a class="email" href="mailto:${PUBLIC_EMAIL}">${PUBLIC_EMAIL}</a></p></div></footer>
${['/','/demande','/mes-interventions'].includes(page.path) ? `<script>window.EDM_PUBLIC_SUPABASE=${JSON.stringify({url:clientConfig?.url||'',key:clientConfig?.key||''}).replaceAll('<','\\u003c')}<\/script>${page.path === '/demande' ? '<script src="/pdf-lite.js?v=5"><\/script>' : ''}<script src="/public-client.js?v=3" defer><\/script>` : ''}
<script src="/public-site.js?v=2" defer></script></body>
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
  const clientConfig = ['/','/demande','/mes-interventions'].includes(page.path) ? resolveSupabasePublicConfig() : null;
  const html = renderPage(page, getOrigin(req), services, clientConfig);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', page.path === '/tarifs' ? 'public, max-age=0, s-maxage=120, stale-while-revalidate=300' : 'public, max-age=0, s-maxage=120, stale-while-revalidate=300');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(html);
}
