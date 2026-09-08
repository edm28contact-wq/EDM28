const PUBLIC_EMAIL = 'contact@edm28.fr';

const CORE_PATHS = [
  '/',
  '/freinage',
  '/freinage/plaquettes-de-frein',
  '/freinage/disques-de-frein',
  '/freinage/liquide-de-frein',
  '/liaison-au-sol',
  '/liaison-au-sol/triangles',
  '/liaison-au-sol/direction',
  '/prestations',
  '/tarifs',
  '/fonctionnement',
  '/transparence',
  '/a-propos',
  '/contact'
];

const SYMPTOM_PAGES = {
  symptomes: {
    path: '/symptomes',
    title: 'Symptômes freinage et train avant : comprendre avant de réparer | EDM28',
    description: 'Bruit de frein, vibrations, pédale molle ou claquement du train avant : EDM28 explique les causes possibles et pourquoi un contrôle du véhicule reste nécessaire.',
    h1: 'Symptômes de freinage et de train avant : par où commencer ?',
    lede: 'Un symptôme permet d’orienter un contrôle, pas de choisir une pièce à remplacer. Cette rubrique relie les signes ressentis au volant aux contrôles et prestations réellement pertinents.',
    breadcrumbs: [['/', 'Accueil'], ['/symptomes', 'Symptômes']],
    sections: [
      ['Pourquoi partir du symptôme ?', 'Un automobiliste décrit souvent un bruit, une vibration, une pédale inhabituelle ou un claquement avant de connaître la cause mécanique. EDM28 part de ce constat pour orienter le contrôle sans transformer un symptôme en diagnostic automatique.'],
      ['Ce qu’un contrôle doit confirmer', 'Le contrôle doit chercher la zone réellement concernée, distinguer le freinage du train roulant lorsque plusieurs causes sont possibles et vérifier l’état des éléments avant toute proposition de remplacement.'],
      ['Quand éviter de continuer à rouler', 'Une dégradation nette du freinage, une pédale anormalement molle, une alerte au tableau de bord ou un comportement devenu difficile à maîtriser justifient de privilégier la sécurité et de faire contrôler le véhicule rapidement.']
    ],
    links: [
      ['/freinage/freins-qui-grincent', 'Freins qui grincent ou couinent'],
      ['/freinage/vibrations-au-freinage', 'Vibrations au freinage'],
      ['/freinage/pedale-de-frein-molle', 'Pédale de frein molle'],
      ['/liaison-au-sol/claquement-train-avant', 'Claquement du train avant'],
      ['/freinage', 'Voir les prestations de freinage'],
      ['/liaison-au-sol', 'Voir la liaison au sol']
    ],
    faq: [
      ['Peut-on identifier une panne uniquement avec un symptôme ?', 'Non. Un symptôme aide à orienter les vérifications mais plusieurs causes peuvent produire une sensation ou un bruit proches.'],
      ['EDM28 remplace-t-il une pièce sur la seule description du client ?', 'Non. Le besoin doit être cohérent avec le contrôle du véhicule et le devis présenté avant travaux.']
    ]
  },
  'freinage/freins-qui-grincent': {
    path: '/freinage/freins-qui-grincent',
    title: 'Freins qui grincent ou couinent : causes possibles et contrôle | EDM28',
    description: 'Vos freins grincent ou couinent ? Découvrez les causes possibles, les points à contrôler et pourquoi un bruit ne signifie pas automatiquement que les plaquettes sont à remplacer.',
    h1: 'Freins qui grincent ou couinent : que faut-il contrôler ?',
    lede: 'Un bruit au freinage peut venir de plusieurs situations. Son moment d’apparition, sa fréquence et l’état réel des éléments de freinage doivent être rapprochés avant de décider d’une intervention.',
    breadcrumbs: [['/', 'Accueil'], ['/symptomes', 'Symptômes'], ['/freinage/freins-qui-grincent', 'Freins qui grincent']],
    sections: [
      ['Quelles causes sont possibles ?', 'L’usure des plaquettes peut être en cause, mais un bruit peut aussi être lié à l’état de surface, à des dépôts, à la corrosion, à une interaction plaquette-disque ou à une autre anomalie du freinage. Le bruit seul ne permet pas de désigner une pièce.'],
      ['Quels éléments doivent être regardés ?', 'Le contrôle porte notamment sur l’état et l’usure des plaquettes, l’état visible des disques, la cohérence entre les deux côtés et tout indice compatible avec le bruit décrit.'],
      ['Quand faire contrôler rapidement ?', 'Si le bruit devient métallique, s’accompagne d’une perte d’efficacité, d’une vibration importante, d’un voyant ou d’un comportement inhabituel, il ne faut pas attendre un simple entretien programmé pour demander un contrôle.'],
      ['Comment EDM28 cadre l’intervention', 'EDM28 vérifie le besoin, propose la prestation correspondant au constat et formalise le périmètre dans un devis. Une pièce n’est pas ajoutée uniquement parce que le symptôme peut parfois lui être associé.']
    ],
    links: [['/freinage/plaquettes-de-frein', 'Plaquettes de frein'], ['/freinage/disques-de-frein', 'Disques de frein'], ['/freinage/vibrations-au-freinage', 'Vibrations au freinage'], ['/tarifs', 'Tarifs publiés'], ['/symptomes', 'Tous les symptômes']],
    faq: [
      ['Des freins qui grincent signifient-ils forcément que les plaquettes sont usées ?', 'Non. L’usure fait partie des causes possibles, mais le bruit doit être rapproché de l’état réel des plaquettes et des disques.'],
      ['Un léger couinement impose-t-il toujours un remplacement ?', 'Non. La décision dépend du contrôle, de l’usure et de l’état des éléments concernés.']
    ]
  },
  'freinage/vibrations-au-freinage': {
    path: '/freinage/vibrations-au-freinage',
    title: 'Voiture ou volant qui vibre au freinage : causes possibles | EDM28',
    description: 'Volant ou voiture qui vibre au freinage : découvrez les contrôles utiles sur le freinage et le train roulant avant de conclure au remplacement des disques.',
    h1: 'Voiture ou volant qui vibre au freinage : que peut-il se passer ?',
    lede: 'Une vibration ressentie pendant le freinage oriente naturellement vers le système de freinage, mais la sensation doit être caractérisée et le train roulant ne doit pas être écarté sans contrôle.',
    breadcrumbs: [['/', 'Accueil'], ['/symptomes', 'Symptômes'], ['/freinage/vibrations-au-freinage', 'Vibrations au freinage']],
    sections: [
      ['Pourquoi une voiture peut-elle vibrer au freinage ?', 'Une irrégularité liée au freinage peut provoquer une vibration, mais des jeux ou défauts du train roulant peuvent aussi modifier ce qui est ressenti au volant. Le symptôme n’autorise donc pas à conclure automatiquement à des disques à remplacer.'],
      ['Ce qu’il faut observer', 'Le moment où la vibration apparaît, sa présence ou non en dehors du freinage, l’intensité ressentie dans le volant ou la caisse et l’état des éléments mécaniques aident à orienter le contrôle.'],
      ['Contrôle du freinage', 'L’état visible des disques et des plaquettes, leur cohérence avec les symptômes et toute anomalie constatée doivent être examinés avant de retenir une prestation.'],
      ['Contrôle du train roulant', 'Lorsque le contexte le justifie, la présence de jeu ou d’un défaut sur des éléments de liaison au sol doit aussi être recherchée afin d’éviter de traiter uniquement la conséquence ressentie.']
    ],
    links: [['/freinage/disques-de-frein', 'Disques de frein'], ['/freinage/plaquettes-de-frein', 'Plaquettes de frein'], ['/liaison-au-sol', 'Train roulant et liaison au sol'], ['/liaison-au-sol/claquement-train-avant', 'Claquement du train avant'], ['/symptomes', 'Tous les symptômes']],
    faq: [
      ['Un volant qui tremble au freinage veut-il dire que les disques sont voilés ?', 'Pas nécessairement. Les disques font partie des éléments à contrôler, mais d’autres causes peuvent produire ou amplifier une vibration.'],
      ['Faut-il remplacer disques et plaquettes sans contrôle ?', 'Non. L’état réel des éléments et le contexte du véhicule doivent guider la proposition de réparation.']
    ]
  },
  'freinage/pedale-de-frein-molle': {
    path: '/freinage/pedale-de-frein-molle',
    title: 'Pédale de frein molle : causes possibles et contrôle | EDM28',
    description: 'Une pédale de frein molle ou spongieuse doit être prise au sérieux. EDM28 explique les causes possibles et pourquoi une purge n’est pas une réponse automatique.',
    h1: 'Pédale de frein molle ou spongieuse : que faut-il vérifier ?',
    lede: 'Une sensation anormale à la pédale concerne directement la sécurité du freinage. Il faut rechercher la cause réelle plutôt que supposer qu’un simple remplacement du liquide de frein résoudra systématiquement le problème.',
    breadcrumbs: [['/', 'Accueil'], ['/symptomes', 'Symptômes'], ['/freinage/pedale-de-frein-molle', 'Pédale de frein molle']],
    sections: [
      ['Pourquoi la pédale peut-elle sembler molle ?', 'Plusieurs situations peuvent modifier la sensation à la pédale, notamment un problème dans le circuit hydraulique ou un besoin d’entretien. Une description à distance ne suffit pas à déterminer laquelle est présente.'],
      ['Pourquoi une purge n’est pas automatique', 'Le remplacement du liquide et la purge sont pertinents lorsqu’ils correspondent au besoin identifié. Ils ne doivent pas masquer la recherche d’un autre défaut mécanique ou hydraulique.'],
      ['Quand privilégier la sécurité', 'Si la course de pédale augmente nettement, si le freinage devient moins efficace, si une fuite est suspectée ou si le comportement change brutalement, le véhicule doit être contrôlé sans considérer le symptôme comme un simple inconfort.'],
      ['Ce qu’EDM28 vérifie avant de proposer une prestation', 'Le besoin est rapproché de l’historique disponible, du comportement du véhicule et du contrôle du système concerné. La prestation de purge n’est proposée que si elle répond réellement au problème ou à l’entretien prévu.']
    ],
    links: [['/freinage/liquide-de-frein', 'Liquide de frein et purge'], ['/freinage', 'Freinage'], ['/fonctionnement', 'Comment se déroule une intervention'], ['/symptomes', 'Tous les symptômes']],
    faq: [
      ['Une pédale molle signifie-t-elle qu’il faut forcément purger les freins ?', 'Non. Une purge peut être pertinente dans certains cas, mais il faut d’abord vérifier qu’elle répond à la cause réelle.'],
      ['Peut-on continuer à rouler avec une pédale devenue nettement plus molle ?', 'Une modification nette du freinage doit être prise au sérieux et justifie un contrôle rapide plutôt qu’une attente prolongée.']
    ]
  },
  'liaison-au-sol/claquement-train-avant': {
    path: '/liaison-au-sol/claquement-train-avant',
    title: 'Claquement du train avant : causes possibles et contrôle | EDM28',
    description: 'Un claquement du train avant peut venir de plusieurs articulations ou liaisons. Découvrez ce qu’il faut contrôler avant de remplacer triangle, rotule ou biellette.',
    h1: 'Claquement du train avant : triangle, rotule, biellette ou autre cause ?',
    lede: 'Un claquement ne désigne pas à lui seul la pièce défectueuse. Sa localisation et la recherche de jeu sur le véhicule sont nécessaires avant de retenir une réparation.',
    breadcrumbs: [['/', 'Accueil'], ['/symptomes', 'Symptômes'], ['/liaison-au-sol/claquement-train-avant', 'Claquement train avant']],
    sections: [
      ['Pourquoi le train avant peut-il claquer ?', 'Plusieurs articulations et liaisons travaillent ensemble. Un jeu ou une dégradation sur un triangle, une rotule, une biellette ou un autre élément peut produire des bruits proches selon les sollicitations.'],
      ['À quel moment le bruit apparaît-il ?', 'Dos-d’âne, chaussée dégradée, braquage, freinage ou changement d’appui peuvent aider à orienter la recherche, mais ces indices restent à confirmer par le contrôle mécanique.'],
      ['Ce que le contrôle doit éviter', 'Remplacer une pièce uniquement parce qu’elle est souvent associée à un claquement crée un risque de réparation inutile. Le jeu ou le défaut doit être localisé autant que possible avant le devis.'],
      ['Prestations EDM28 liées au train roulant', 'EDM28 intervient notamment sur des triangles de suspension, des biellettes ou rotules de direction et des biellettes de barre stabilisatrice lorsque le contrôle confirme le besoin.']
    ],
    links: [['/liaison-au-sol/triangles', 'Triangles de suspension'], ['/liaison-au-sol/direction', 'Direction, rotules et biellettes'], ['/liaison-au-sol', 'Liaison au sol'], ['/freinage/vibrations-au-freinage', 'Vibrations au freinage'], ['/symptomes', 'Tous les symptômes']],
    faq: [
      ['Un claquement vient-il forcément d’un triangle ?', 'Non. Plusieurs éléments du train avant peuvent produire un bruit proche. Il faut rechercher le jeu ou le défaut réel.'],
      ['Peut-on identifier une rotule usée uniquement au bruit ?', 'Non. Le bruit peut orienter le contrôle mais ne remplace pas la vérification mécanique de l’élément concerné.']
    ]
  }
};

const ALL_PUBLIC_PATHS = [...CORE_PATHS, ...Object.values(SYMPTOM_PAGES).map((page) => page.path)];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeConfiguredOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(url.host)) return '';
    return `${url.protocol}//${url.host}`.replace(/\/$/, '');
  } catch (_) {
    return '';
  }
}

function getOrigin(req) {
  const explicit = normalizeConfiguredOrigin(process.env.PUBLIC_SITE_ORIGIN);
  if (explicit) return explicit;
  const production = normalizeConfiguredOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return production;
  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'http' ? 'http' : 'https';
  const host = String(req.headers?.host || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return `${protocol}://localhost`;
  return `${protocol}://${host}`;
}

function isPreviewDeployment() {
  return String(process.env.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
}

function getSlug(req) {
  if (typeof req.query?.slug === 'string') return req.query.slug.replace(/^\/+|\/+$/g, '');
  try {
    return new URL(req.url || '', 'http://localhost').searchParams.get('slug')?.replace(/^\/+|\/+$/g, '') || '';
  } catch (_) {
    return '';
  }
}

function renderStructuredData(page, origin) {
  const canonical = `${origin}${page.path}`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: page.h1,
      description: page.description,
      inLanguage: 'fr-FR',
      about: { '@id': `${origin}/#autorepair` }
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

function renderPage(page, origin) {
  const canonical = `${origin}${page.path}`;
  const breadcrumbs = page.breadcrumbs.map(([path, name], index) => {
    const current = index === page.breadcrumbs.length - 1;
    return current ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${esc(path)}">${esc(name)}</a>`;
  }).join('<span aria-hidden="true">›</span>');
  const sections = page.sections.map(([title, text]) => `<section><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`).join('');
  const links = page.links.map(([path, label]) => `<a class="link-card" href="${esc(path)}">${esc(label)}<span aria-hidden="true">→</span></a>`).join('');
  const faq = page.faq?.length ? `<section aria-labelledby="faq-title"><h2 id="faq-title">Questions fréquentes</h2><div class="faq">${page.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>` : '';
  const robots = isPreviewDeployment() ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large';
  const jsonLd = renderStructuredData(page, origin);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${robots}">
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
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f5f2ee;line-height:1.65}*{box-sizing:border-box}body{margin:0}a{color:inherit}.wrap{width:min(1080px,calc(100% - 32px));margin:auto}.site-header{background:#111827;color:#fff}.header-row{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-weight:900;letter-spacing:.08em;text-decoration:none}.nav{display:flex;flex-wrap:wrap;gap:16px;font-size:.92rem}.nav a{text-decoration:none;color:#e5e7eb}.hero{padding:68px 0 50px;background:linear-gradient(135deg,#fff,#ede7e0)}.crumbs{display:flex;gap:8px;flex-wrap:wrap;font-size:.9rem;color:#5d6470;margin-bottom:22px}.crumbs a{color:#374151}h1{font-size:clamp(2.2rem,6vw,4.4rem);line-height:1.03;letter-spacing:-.05em;max-width:920px;margin:0}.lead{max-width:780px;font-size:1.15rem;color:#4b5563;margin:22px 0}.cta{display:inline-flex;background:#111827;color:#fff;text-decoration:none;padding:13px 18px;border-radius:999px;font-weight:800}.content{padding:52px 0 80px}.content section{background:#fff;border:1px solid #ded8d1;border-radius:24px;padding:28px;margin:0 0 18px}h2{font-size:1.6rem;letter-spacing:-.03em;margin:0 0 10px}.content p{margin:0;color:#535b66}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:30px 0}.link-card{display:flex;justify-content:space-between;gap:12px;background:#111827;color:#fff;text-decoration:none;border-radius:18px;padding:18px;font-weight:800}.faq{display:grid;gap:10px}.faq details{border-top:1px solid #e5e7eb;padding:14px 0}.faq summary{font-weight:800;cursor:pointer}.site-footer{border-top:1px solid #d8d2ca;padding:28px 0 42px;color:#5d6470}@media(max-width:760px){.header-row{align-items:flex-start;flex-direction:column;padding:18px 0}.nav{gap:10px}.hero{padding-top:44px}.content section{padding:22px}}
</style>
</head>
<body>
<header class="site-header"><div class="wrap header-row"><a class="brand" href="/">EDM28</a><nav class="nav" aria-label="Navigation principale"><a href="/freinage">Freinage</a><a href="/liaison-au-sol">Liaison au sol</a><a href="/symptomes">Symptômes</a><a href="/prestations">Prestations</a><a href="/tarifs">Tarifs</a><a href="/contact">Contact</a></nav></div></header>
<main><div class="hero"><div class="wrap"><nav class="crumbs" aria-label="Fil d’Ariane">${breadcrumbs}</nav><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lede)}</p><a class="cta" href="/">Préparer une demande</a></div></div><div class="wrap content">${sections}<div class="links" aria-label="Pages liées">${links}</div>${faq}</div></main>
<footer class="site-footer"><div class="wrap"><p><strong>EDM28</strong> — Freinage et liaison au sol. Un symptôme oriente le contrôle, il ne remplace pas le diagnostic du véhicule.</p><p>Contact public : <a href="mailto:${PUBLIC_EMAIL}">${PUBLIC_EMAIL}</a></p></div></footer>
</body>
</html>`;
}

function renderSitemap(origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ALL_PUBLIC_PATHS.map((path) => `  <url><loc>${esc(`${origin}${path}`)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const origin = getOrigin(req);
  const mode = typeof req.query?.mode === 'string' ? req.query.mode : '';
  if (mode === 'sitemap') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(renderSitemap(origin));
  }
  const page = SYMPTOM_PAGES[getSlug(req)];
  if (!page) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(404).send('<!doctype html><html lang="fr"><head><meta name="robots" content="noindex,nofollow"><title>Page introuvable | EDM28</title></head><body><main><h1>Page introuvable</h1><a href="/symptomes">Voir les symptômes</a></main></body></html>');
  }
  if (isPreviewDeployment()) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(renderPage(page, origin));
}
