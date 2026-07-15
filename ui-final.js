(function () {
  const EDM_LOGO = "data:image/jpeg;base64,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[... ELLIPSIZATION ...]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";
  function $(s, r = document) { return r.querySelector(s); }
  function $$(s, r = document) { return Array.from(r.querySelectorAll(s)); }
  function hide(el) { if (el) el.style.display = 'none'; }
  function txt(s, v) { const el = $(s); if (el) el.textContent = v; }

  function injectPremiumTheme() {
    if ($('#edm-premium-theme')) return;
    const style = document.createElement('style');
    style.id = 'edm-premium-theme';
    style.textContent = `
      :root {
        --bg:#070b0d; --surface:#101619; --surface-2:#151d21; --ink:#f6f0ea;
        --muted:#aaa8a5; --border:#2b3438; --brand:#b96f43; --blue:#c98253;
        --blue-soft:#241812; --green:#b96f43; --green-soft:#211711;
        --orange:#d18a58; --orange-soft:#291a12; --red:#c95d50; --red-soft:#2b1514;
        --shadow:0 30px 80px rgba(0,0,0,.42); --copper:#b96f43; --copper-2:#d69a6d;
        --silver:#c8cdd0; --silver-dark:#7d858a;
      }
      html { background:#070b0d; }
      body {
        color:var(--ink);
        background:
          radial-gradient(circle at 18% 0%, rgba(185,111,67,.16), transparent 30rem),
          radial-gradient(circle at 92% 12%, rgba(200,205,208,.08), transparent 28rem),
          linear-gradient(180deg,#070b0d,#0b1012 55%,#070b0d);
      }
      body::before {
        content:""; position:fixed; inset:0; pointer-events:none; z-index:-1;
        background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
        background-size:34px 34px; mask-image:linear-gradient(to bottom,rgba(0,0,0,.5),transparent 70%);
      }
      p,.field-hint,.small { color:var(--muted); }
      .app-shell { grid-template-columns:270px minmax(0,1fr); }
      .sidebar {
        background:linear-gradient(180deg,rgba(8,12,14,.99),rgba(12,17,19,.99));
        border-right:1px solid rgba(185,111,67,.23); box-shadow:18px 0 60px rgba(0,0,0,.22);
      }
      .brand-block { grid-template-columns:74px 1fr; align-items:center; gap:14px; }
      .brand-mark {
        width:74px; height:74px; border-radius:18px; font-size:0; overflow:hidden;
        background:#0b1012 url("${EDM_LOGO}") center/cover no-repeat;
        box-shadow:0 16px 36px rgba(0,0,0,.46),0 0 0 1px rgba(201,130,83,.25);
      }
      .brand-name { color:var(--copper-2); font-size:1.25rem; letter-spacing:.09em; }
      .brand-sub { color:#b9b7b4; font-size:.8rem; }
      .nav button { color:#c9c7c4; border-radius:14px; }
      .nav button:hover,.nav button.active {
        color:#fff; background:linear-gradient(90deg,rgba(185,111,67,.22),rgba(185,111,67,.06));
        border-color:rgba(201,130,83,.35); box-shadow:inset 3px 0 0 var(--copper);
      }
      .sidebar-card { background:rgba(255,255,255,.035); border-color:rgba(201,130,83,.22); }
      .main { max-width:1380px; }
      .topbar {
        background:rgba(11,16,18,.88); border-color:rgba(201,130,83,.22); color:var(--ink);
        box-shadow:0 18px 50px rgba(0,0,0,.28); backdrop-filter:blur(18px);
      }
      .topbar-title { color:var(--copper-2); letter-spacing:.08em; }
      .panel {
        background:linear-gradient(145deg,rgba(18,25,28,.97),rgba(12,17,19,.98));
        border-color:rgba(201,130,83,.18); box-shadow:var(--shadow);
      }
      .hero {
        min-height:610px; position:relative;
        background:
          linear-gradient(90deg,rgba(8,12,14,.98) 0%,rgba(8,12,14,.9) 45%,rgba(8,12,14,.38) 100%),
          radial-gradient(circle at 72% 50%,rgba(185,111,67,.28),transparent 23rem),
          linear-gradient(135deg,#0a0f11,#151b1d 58%,#0d1214);
      }
      .hero::after {
        content:""; position:absolute; width:430px; height:430px; right:3%; top:50%; transform:translateY(-50%);
        border-radius:50%; opacity:.92; filter:drop-shadow(0 22px 30px rgba(0,0,0,.55));
        background:url("${EDM_LOGO}") center/contain no-repeat;
      }
      .hero-grid { position:relative; z-index:2; grid-template-columns:minmax(0,1fr) minmax(280px,.58fr); }
      .hero-grid>div:first-child { max-width:760px; }
      .hero h1 { font-size:clamp(3rem,6vw,5.9rem); text-transform:uppercase; letter-spacing:.01em; line-height:.93; }
      .hero h1::first-line { color:#f6eee8; }
      .hero .lead { max-width:690px; color:#d6d2ce; font-size:1.08rem; }
      .eyebrow { color:var(--copper-2); background:rgba(185,111,67,.08); border-color:rgba(201,130,83,.3); }
      .hero-card { background:rgba(8,12,14,.66); border-color:rgba(201,130,83,.25); }
      .hero-stat { background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.05); }
      .hero-stat span { background:linear-gradient(145deg,var(--copper-2),#93512f); color:#fff; }
      .btn { border-radius:12px; letter-spacing:.02em; }
      .btn-primary,.btn-blue,.btn-success {
        color:#fff; background:linear-gradient(135deg,#c77d4e,#91502f); box-shadow:0 14px 34px rgba(185,111,67,.24);
      }
      .btn-primary:hover,.btn-blue:hover,.btn-success:hover { background:linear-gradient(135deg,#d39061,#a95e36); }
      .btn-secondary { color:#f7eee8; background:#1c2428; border:1px solid #313a3e; }
      .btn-ghost { color:#ece7e2; border-color:#3a4449; }
      .hero .btn-secondary { background:linear-gradient(135deg,#c77d4e,#91502f); color:#fff; border-color:transparent; }
      .card,.step,.basket-card,.service-card,.summary,.notice,.okbox,.errorbox,.infobox {
        background:linear-gradient(145deg,#151d21,#101619); border-color:#303a3f; color:var(--ink);
      }
      .section-title h2,.section-title h3,h2,h3 { color:#f4eee8; }
      input,select,textarea { background:#0e1417; color:#f7f2ed; border-color:#364147; }
      input:focus,select:focus,textarea:focus { border-color:var(--copper); box-shadow:0 0 0 4px rgba(185,111,67,.14); }
      .step.current { color:#f5d5be; background:#2a1b13; border-color:#8f5535; }
      .step.done { color:#e8c3a8; background:#211711; border-color:#74452c; }
      .pill.blue,.pill.green,.pill.orange { color:#f5d5be; background:#2a1b13; border-color:#7f4d31; }
      .basket-card.recommended { border-color:var(--copper); box-shadow:0 20px 48px rgba(185,111,67,.15); }
      .service-price,.basket-title,.summary-line.total strong,.saving { color:var(--copper-2); }
      .table th { color:var(--copper-2); }
      .table td,.table th { border-color:#30383d; }
      .toast { background:#1b2428; border:1px solid rgba(201,130,83,.3); color:#fff; }
      ::selection { background:rgba(185,111,67,.45); color:#fff; }
      @media (max-width:980px){
        .hero::after { opacity:.18; width:360px; height:360px; right:-80px; }
        .hero-grid { grid-template-columns:1fr; }
      }
      @media (max-width:760px){
        .brand-block { grid-template-columns:58px 1fr; }
        .brand-mark { width:58px; height:58px; }
        .hero { min-height:auto; }
        .hero::after { width:260px; height:260px; right:-70px; top:32%; }
      }
    `;
    document.head.appendChild(style);
    document.documentElement.style.colorScheme = 'dark';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#090d0f');
  }

  function patchTexts() {
    txt('.eyebrow', 'Spécialiste du freinage · diagnostic · intervention');
    txt('#home h1', 'Votre sécurité, notre expertise.');
    txt('#home .lead', 'Préparez votre demande de freinage et d’entretien automobile, obtenez une estimation claire puis transmettez votre dossier à EDM pour validation.');
    txt('#appointment .section-title p', 'Un parcours premium et simple : compte, véhicule, prestations, estimation, puis transmission.');
    txt('#garage .section-title p', 'Retrouvez vos véhicules et préparez rapidement une nouvelle intervention.');
    txt('#history p', 'Consultez l’historique de vos demandes et de vos estimations.');
    txt('#about .lead', 'EDM est spécialisé dans le freinage et l’entretien automobile. Le site vous permet de préparer votre demande, d’obtenir une estimation lisible et de transmettre les informations utiles avant validation.');
    const stats = $$('.hero-stat');
    if (stats[0]) stats[0].innerHTML = '<span>1</span><div><b>Diagnostic précis</b><p>Renseignez votre véhicule et votre besoin en quelques minutes.</p></div>';
    if (stats[1]) stats[1].innerHTML = '<span>2</span><div><b>Tarifs transparents</b><p>Comparez les niveaux de pièces et le détail de l’estimation.</p></div>';
    if (stats[2]) stats[2].innerHTML = '<span>3</span><div><b>Validation EDM</b><p>Votre demande est vérifiée avant confirmation de l’intervention.</p></div>';
  }

  function patchVehicleAndAccount() {
    hide(document.getElementById('btnLoadLocal'));
    hide(document.getElementById('btnDetectPlate'));
    hide(document.getElementById('plateStatus'));
    hide(document.getElementById('vehicleResult'));
    hide(document.getElementById('btnAiBasket'));
    hide(document.getElementById('aiPanel'));
    const engine = document.getElementById('engine')?.closest('label');
    const emissions = document.getElementById('emissions')?.closest('label');
    hide(engine); hide(emissions);
    txt('#vehicleCard .section-title p', 'Renseignez les informations utiles de votre véhicule pour préparer une estimation fiable.');
    const badge = $('#vehicleCard .pill');
    if (badge) { badge.textContent = 'Mon véhicule'; badge.className = 'pill orange'; }
    const help = $('#clientCard .section-title p');
    if (help) help.textContent = 'Créez votre espace client ou connectez-vous pour enregistrer vos véhicules et transmettre une demande.';
  }

  function patchServices() {
    txt('#servicesArea .card .section-title p', 'Sélectionnez les prestations souhaitées. Le détail des pièces et de la main-d’œuvre reste clairement séparé.');
    const orange = $$('#servicesArea .section-title .pill.orange')[0];
    if (orange) orange.style.display = 'none';
  }

  function patchSummary() {
    const lines = $$('#summaryBox .summary-line');
    if (lines[0]) lines[0].querySelector('span').textContent = 'Main-d’œuvre estimée';
    if (lines[1]) lines[1].querySelector('span').textContent = 'Remise prestations groupées';
    if (lines[2]) hide(lines[2]);
    if (lines[3]) lines[3].querySelector('span').textContent = 'Contrôle préalable';
    if (lines[4]) lines[4].querySelector('span').textContent = 'Pièces estimées';
    if (lines[5]) lines[5].querySelector('span').textContent = 'Économie estimée';
    if (lines[6]) lines[6].querySelector('span').textContent = 'Total estimé';
    txt('#btnSubmit', 'Demander une estimation');
    const note = $('#servicesArea .summary-grid .card:last-child .notice');
    if (note) note.textContent = 'Cette estimation est indicative. Le montant final et la compatibilité des pièces sont confirmés après vérification par EDM.';
    const leftTitle = $('#servicesArea .summary-grid .card h3');
    if (leftTitle) leftTitle.textContent = 'Contrôle préalable avant intervention';
  }

  function patchBaskets() {
    if (typeof BASKETS !== 'undefined') {
      BASKETS.eco.desc = 'Pièces compatibles sélectionnées pour maîtriser le budget.';
      BASKETS.standard.desc = 'Équilibre recommandé entre qualité, longévité et prix.';
      BASKETS.premium.desc = 'Pièces haut de gamme pour une durabilité renforcée.';
      BASKETS.eco.extra = 0; BASKETS.standard.extra = 0; BASKETS.premium.extra = 0;
    }
  }

  function patchSidebarAndAbout() {
    const sub = $('.brand-sub');
    if (sub) sub.innerHTML = 'Spécialiste du freinage<br>Expertise · qualité · transparence';
    const cards = $$('.sidebar-card');
    if (cards[0]) cards[0].innerHTML = '<b>Espace client</b><br>Connectez-vous pour retrouver vos véhicules, documents et demandes.';
    if (cards[1]) cards[1].innerHTML = '<b>Accompagnement EDM</b><br>Chaque estimation est vérifiée avant confirmation finale de l’intervention.';
    const aboutCards = $$('#about .grid-3 .card');
    if (aboutCards[0]) aboutCards[0].innerHTML = '<span class="pill orange">Expertise</span><h3 style="margin-top:12px">Spécialiste du freinage</h3><p>Une approche centrée sur la sécurité, le diagnostic et la qualité du montage.</p>';
    if (aboutCards[1]) aboutCards[1].innerHTML = '<span class="pill orange">Qualité</span><h3 style="margin-top:12px">Pièces sélectionnées</h3><p>Plusieurs niveaux de pièces pour adapter la prestation au véhicule et au budget.</p>';
    if (aboutCards[2]) aboutCards[2].innerHTML = '<span class="pill orange">Transparence</span><h3 style="margin-top:12px">Estimation détaillée</h3><p>Main-d’œuvre, pièces et options sont présentées clairement avant validation.</p>';
    const notice = $('#about .notice');
    if (notice) notice.textContent = 'Votre demande est étudiée par EDM avant confirmation du rendez-vous, des pièces et du montant final.';
  }

  function patchBrand() {
    const topTitle = $('.topbar-title');
    if (topTitle) topTitle.innerHTML = '<span style="color:var(--copper-2)">EDM</span><span style="font-size:.72rem;color:var(--muted);letter-spacing:.04em">SPÉCIALISTE DU FREINAGE</span>';
    const title = document.querySelector('title');
    if (title) title.textContent = 'EDM · Spécialiste du freinage';
  }

  function init() {
    injectPremiumTheme();
    patchBrand();
    patchTexts();
    patchVehicleAndAccount();
    patchServices();
    patchSummary();
    patchBaskets();
    patchSidebarAndAbout();
    if (typeof renderBaskets === 'function') renderBaskets();
    if (typeof renderServices === 'function') renderServices();
    if (typeof updateSummary === 'function') updateSummary();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
