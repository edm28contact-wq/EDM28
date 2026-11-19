/* EDM28 — données pédagogiques du showroom.
 * Schéma générique : ni diagnostic, ni représentation exacte d'un modèle de véhicule.
 * Fichier autonome utilisé par le moteur 3D et les tests Node.
 */
(function (root) {
  'use strict';
  const parts = [
    {
      id: 'plaquettes',
      label: 'Plaquettes de frein',
      category: 'Freinage',
      description: 'Elles pressent le disque pour ralentir la rotation de la roue.',
      signs: ['Bruit de frottement ou de grincement', 'Témoin d’usure, si le véhicule en possède un', 'Épaisseur de garniture insuffisante au contrôle'],
      check: 'Faire vérifier l’épaisseur et l’état des plaquettes, surtout si un bruit ou un témoin apparaît.',
      replace: 'Remplacer selon les seuils du constructeur et l’usure constatée, par train complet. Pas de kilométrage universel.',
      choices: [
        { label: 'Avant', slug: 'plaquettes-frein-avant' },
        { label: 'Arrière', slug: 'plaquettes-frein-arriere' },
        { label: 'Avant + arrière', slug: 'plaquettes-avant-arriere' }
      ],
      front: true, rear: true,
      color: '#efba79'
    },
    {
      id: 'disques',
      label: 'Disques de frein',
      category: 'Freinage',
      description: 'Le disque tourne avec la roue. Les plaquettes viennent serrer ses deux faces pour freiner.',
      signs: ['Vibrations ou pulsations au freinage', 'Rayures profondes, fissures ou corrosion importante', 'Épaisseur minimale atteinte'],
      check: 'Faire mesurer l’épaisseur et vérifier les faces des disques, notamment lors du changement des plaquettes.',
      replace: 'Lorsque l’épaisseur minimale, l’état ou les tolérances du constructeur l’exigent. Le service EDM28 proposé associe disques et plaquettes.',
      choices: [
        { label: 'Avant', slug: 'disques-plaquettes-avant' },
        { label: 'Arrière', slug: 'disques-plaquettes-arriere' },
        { label: 'Avant + arrière', slug: 'freinage-complet' }
      ],
      front: true, rear: true,
      color: '#b7dcf2'
    },
    {
      id: 'liquide',
      label: 'Liquide de frein',
      category: 'Freinage',
      description: 'Il transmet la pression de la pédale aux organes de freinage dans le circuit hydraulique.',
      signs: ['Pédale molle ou course anormale', 'Ancienneté inconnue du liquide', 'Anomalie signalée lors de la vérification du circuit'],
      check: 'Contrôler le circuit en cas de comportement anormal et consulter l’échéancier d’entretien du véhicule.',
      replace: 'Effectuer la purge selon la préconisation du constructeur et le résultat du contrôle. Une pédale anormalement molle nécessite un contrôle rapide.',
      choices: [{ label: 'Purge du liquide de frein', slug: 'purge-liquide-frein' }],
      front: true, rear: true,
      color: '#d9c8ff'
    },
    {
      id: 'triangles',
      label: 'Triangles de suspension',
      category: 'Liaison au sol',
      description: 'Ils guident la roue par rapport au châssis et participent à la précision du train roulant.',
      signs: ['Claquements sur irrégularités', 'Jeu aux articulations ou silentblocs détériorés', 'Tenue de route ou usure des pneus anormale'],
      check: 'Faire examiner les articulations, rotules et silentblocs en cas de bruit, de jeu ou de remarque au contrôle technique.',
      replace: 'Après identification d’un jeu, d’une déformation ou d’une détérioration. Un bruit seul ne suffit pas à conclure.',
      choices: [{ label: 'Triangles — la paire', slug: 'triangles-suspension' }],
      front: true, rear: false,
      color: '#90d1ca'
    },
    {
      id: 'rotules',
      label: 'Rotules et biellettes de direction',
      category: 'Liaison au sol',
      description: 'Elles transmettent le mouvement de la direction aux roues directrices.',
      signs: ['Jeu dans la direction', 'Claquement lors des braquages ou sur route abîmée', 'Trajectoire instable ou usure anormale des pneus'],
      check: 'Contrôle du jeu mécanique et des articulations : plusieurs causes peuvent provoquer les mêmes symptômes.',
      replace: 'Lorsqu’un jeu ou un défaut mécanique est confirmé. Un défaut de direction peut compromettre la sécurité.',
      choices: [{ label: 'Direction — la paire', slug: 'biellettes-rotules-direction' }],
      front: true, rear: false,
      color: '#ffd7a2'
    },
    {
      id: 'stabilisation',
      label: 'Biellettes de barre stabilisatrice',
      category: 'Liaison au sol',
      description: 'Elles relient la suspension à la barre stabilisatrice et participent à la maîtrise du roulis.',
      signs: ['Claquement sur les petits chocs ou ralentisseurs', 'Jeu constaté aux rotules de biellette', 'Soufflet d’articulation abîmé'],
      check: 'Faire contrôler la biellette et les autres articulations du train avant avant de remplacer une pièce.',
      replace: 'En présence de jeu ou de détérioration confirmé(e), conformément aux préconisations du véhicule.',
      choices: [{ label: 'Biellettes stabilisatrices — la paire', slug: 'biellettes-barre-stabilisatrice' }],
      front: true, rear: false,
      color: '#f4b9c6'
    }
  ];
  const wheels = Object.freeze([
    { id: 'av-gauche', label: 'Avant gauche', front: true, side: -1 },
    { id: 'av-droite', label: 'Avant droite', front: true, side: 1 },
    { id: 'ar-gauche', label: 'Arrière gauche', front: false, side: -1 },
    { id: 'ar-droite', label: 'Arrière droite', front: false, side: 1 }
  ]);
  const byId = id => parts.find(part => part.id === id) || null;
  const wheelById = id => wheels.find(wheel => wheel.id === id) || null;
  const forWheel = id => {
    const wheel=wheelById(id);
    return wheel ? parts.filter(part=>wheel.front ? part.front : part.rear) : [];
  };
  const slugs = Object.freeze([...new Set(parts.flatMap(part=>part.choices.map(choice=>choice.slug)))]);
  const requestUrl = slug => slugs.includes(slug) ? '/demande?service='+encodeURIComponent(slug)+'#requestServices' : '/demande';
  const api = Object.freeze({parts,wheels,byId,wheelById,forWheel,requestUrl});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EDMShowroomData = api;
})(typeof window !== 'undefined' ? window : globalThis);
