(function () {
  const EDM_LOGO = "/logo-edm.svg";
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
        .app-shell { grid-template-columns:1fr; }
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
    txt('.eyebrow', 'Freinage · liaison au sol · sur rendez-vous');
    txt('#home h1', 'Votre sécurité, preuves à l’appui.');
    txt('#home .lead', 'Décrivez votre besoin, comparez les niveaux de pièces et validez le prix avant toute intervention supplémentaire.');
    txt('#appointment .section-title p', 'Préparez votre demande en ligne. EDM vérifie le véhicule, les pièces et la disponibilité avant de confirmer le rendez-vous.');
    txt('#garage .section-title p', 'Retrouvez vos véhicules et préparez rapidement une nouvelle intervention.');
    txt('#history p', 'Consultez l’historique de vos demandes et de vos estimations.');
    txt('#about .lead', 'EDM est spécialisé dans le freinage et la liaison au sol. Chaque demande distingue clairement le besoin, les pièces, la main-d’œuvre et ce qui reste à confirmer.');
    const stats = $$('.hero-stat');
    if (stats[0]) stats[0].innerHTML = '<span>1</span><div><b>Demande qualifiée</b><p>Véhicule, symptômes et prestations sont regroupés dans un seul dossier.</p></div>';
    if (stats[1]) stats[1].innerHTML = '<span>2</span><div><b>Estimation détaillée</b><p>Pièces et main-d’œuvre restent séparées et lisibles.</p></div>';
    if (stats[2]) stats[2].innerHTML = '<span>3</span><div><b>Accord avant travaux</b><p>Aucune intervention supplémentaire n’est ajoutée sans votre validation.</p></div>';
  }

  function ensureSafetyNotice() {
    const sectionTitle = $('#appointment .section-title');
    if (!sectionTitle || $('#edm-safety-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'edm-safety-notice';
    notice.className = 'errorbox';
    notice.style.marginBottom = '18px';
    notice.innerHTML = '<strong>Freinage potentiellement dangereux ?</strong><br>En cas de perte de freinage, pédale au plancher, fuite visible ou voyant rouge, immobilisez le véhicule et contactez une assistance. La demande en ligne ne remplace pas une prise en charge urgente.';
    sectionTitle.insertAdjacentElement('afterend', notice);
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
    if (sub) sub.innerHTML = 'Freinage & liaison au sol<br>Mesures · prix · accord';
    const cards = $$('.sidebar-card');
    if (cards[0]) cards[0].innerHTML = '<b>Espace client</b><br>Connectez-vous pour retrouver vos véhicules, documents et demandes.';
    if (cards[1]) cards[1].innerHTML = '<b>Engagement EDM</b><br>Aucune intervention supplémentaire sans votre accord.';
    const aboutCards = $$('#about .grid-3 .card');
    if (aboutCards[0]) aboutCards[0].innerHTML = '<span class="pill orange">Expertise</span><h3 style="margin-top:12px">Freinage & liaison au sol</h3><p>Une approche centrée sur les organes qui relient le véhicule à la route.</p>';
    if (aboutCards[1]) aboutCards[1].innerHTML = '<span class="pill orange">Transparence</span><h3 style="margin-top:12px">Détail avant décision</h3><p>Pièces, main-d’œuvre et limites de l’estimation sont présentées séparément.</p>';
    if (aboutCards[2]) aboutCards[2].innerHTML = '<span class="pill orange">Accord</span><h3 style="margin-top:12px">Validation explicite</h3><p>Tout travail supplémentaire doit être chiffré puis accepté avant réalisation.</p>';
    const notice = $('#about .notice');
    if (notice) notice.textContent = 'Votre demande est étudiée par EDM avant confirmation du rendez-vous, des pièces et du montant final.';
  }

  function patchBrand() {
    const topTitle = $('.topbar-title');
    if (topTitle) topTitle.innerHTML = '<span style="color:var(--copper-2)">EDM</span><span style="font-size:.72rem;color:var(--muted);letter-spacing:.04em">FREINAGE & LIAISON AU SOL</span>';
    const title = document.querySelector('title');
    if (title) title.textContent = 'EDM · Freinage & liaison au sol';
  }

  function init() {
    injectPremiumTheme();
    patchBrand();
    patchTexts();
    ensureSafetyNotice();
    patchVehicleAndAccount();
    patchServices();
    patchSummary();
    patchBaskets();
    patchSidebarAndAbout();
    if (typeof renderBaskets === 'function') renderBaskets();
    if (typeof renderServices === 'function') renderServices();
    if (typeof updateSummary === 'function') updateSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('load', init);
})();
