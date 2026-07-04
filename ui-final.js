(function () {
  function $(s, r = document) { return r.querySelector(s); }
  function $$(s, r = document) { return Array.from(r.querySelectorAll(s)); }
  function hide(el) { if (el) el.style.display = 'none'; }
  function txt(s, v) { const el = $(s); if (el) el.textContent = v; }

  function patchTexts() {
    txt('.eyebrow', 'Demande simple · estimation claire · reprise manuelle');
    txt('#home h1', 'Préparez votre demande mécanique en quelques minutes.');
    txt('#home .lead', 'Créez votre compte, renseignez votre véhicule, sélectionnez les prestations souhaitées, consultez une estimation, puis transmettez votre demande à EDM AUTO pour reprise manuelle.');
    txt('#appointment .section-title p', 'Un parcours simple : compte, véhicule, prestations, estimation, puis transmission de votre demande.');
    txt('#garage .section-title p', 'Retrouvez ici les véhicules enregistrés sur votre compte.');
    txt('#history p', 'Retrouvez ici l’historique de vos demandes.');
    txt('#about .lead', 'EDM AUTO vous permet de préparer simplement votre demande mécanique en ligne avant reprise manuelle. L’objectif est de vous faire gagner du temps et de clarifier les prestations souhaitées avant validation.');
    const stats = $$('.hero-stat');
    if (stats[0]) stats[0].innerHTML = '<span>1</span><div><b>Compte</b><p>Créez votre compte pour retrouver vos véhicules et vos demandes.</p></div>';
    if (stats[1]) stats[1].innerHTML = '<span>2</span><div><b>Estimation</b><p>Consultez plusieurs niveaux de panier selon votre besoin et votre budget.</p></div>';
    if (stats[2]) stats[2].innerHTML = '<span>3</span><div><b>Validation EDM</b><p>Chaque demande est ensuite revue manuellement avant confirmation.</p></div>';
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
    txt('#vehicleCard .section-title p', 'Renseignez manuellement les informations utiles de votre véhicule pour préparer votre demande.');
    const badge = $('#vehicleCard .pill');
    if (badge) { badge.textContent = 'Saisie manuelle'; badge.className = 'pill blue'; }
    const help = $('#clientCard .section-title p');
    if (help) help.textContent = 'Créez votre compte ou connectez-vous avant de pouvoir transmettre une demande.';
  }

  function patchServices() {
    txt('#servicesArea .card .section-title p', 'Choisissez les prestations souhaitées pour obtenir une estimation plus claire de votre demande.');
    const orange = $$('#servicesArea .section-title .pill.orange')[0];
    if (orange) orange.style.display = 'none';
    if (!$('.combo-box')) {
      const toolbar = $('.service-toolbar');
      if (toolbar) {
        const wrap = document.createElement('div');
        wrap.className = 'combo-box';
        wrap.style.margin = '12px 0 0';
        wrap.innerHTML = '<button class="btn btn-ghost" id="comboExplainBtn" type="button">Combo -30% ?</button><div id="comboExplainBox" class="infobox hidden" style="margin-top:10px">Lorsque plusieurs prestations compatibles sont réalisées ensemble sur la même intervention, une remise de 30% peut être appliquée sur la prestation éligible la moins chère.</div>';
        toolbar.insertAdjacentElement('afterend', wrap);
        $('#comboExplainBtn')?.addEventListener('click', () => $('#comboExplainBox')?.classList.toggle('hidden'));
      }
    }
  }

  function patchSummary() {
    const lines = $$('#summaryBox .summary-line');
    if (lines[0]) lines[0].querySelector('span').textContent = 'Main-d’œuvre estimée';
    if (lines[1]) lines[1].querySelector('span').textContent = 'Remise combo';
    if (lines[2]) hide(lines[2]);
    if (lines[3]) lines[3].querySelector('span').textContent = 'Contrôle préalable';
    if (lines[4]) lines[4].querySelector('span').textContent = 'Pièces estimées';
    if (lines[5]) lines[5].querySelector('span').textContent = 'Économie combo';
    if (lines[6]) lines[6].querySelector('span').textContent = 'Total estimé tout compris';
    txt('#btnSubmit', 'Envoyer ma demande pour étude');
    const note = $('#servicesArea .summary-grid .card:last-child .notice');
    if (note) note.textContent = 'Cette estimation est donnée à titre indicatif. Elle aide à préparer la demande, mais la validation finale des pièces et du montant reste faite manuellement.';
    const leftTitle = $('#servicesArea .summary-grid .card h3');
    if (leftTitle) leftTitle.textContent = 'Contrôle préalable avant réparation';
    const cards = $$('.check-card');
    if (cards[0]) cards[0].innerHTML = '<input type="checkbox" id="j7Accepted" checked><span><b>Je souhaite ajouter le contrôle général du véhicule avant réparation : 30 €</b><span class="field-hint">Un contrôle général du véhicule peut être effectué avant la réparation pour un montant de 30 €. Ce contrôle permet de mieux préparer l’intervention et de limiter les erreurs ou imprévus avant la réparation.</span></span>';
    if (cards[1]) cards[1].innerHTML = '<input type="checkbox" id="refuseControl"><span><b>Je refuse le contrôle préalable</b><span class="field-hint">En cas de refus du contrôle préalable, la préparation de l’intervention se fera sur la base des informations transmises avant le rendez-vous. Si le panier de pièces a été préparé par EDM AUTO et qu’une erreur de compatibilité provient de notre sélection, EDM AUTO en assumera la responsabilité. Si le client apporte lui-même ses pièces et que celles-ci s’avèrent incompatibles, 70 % de la main-d’œuvre prévue sera facturée.</span></span>';
  }

  function patchBaskets() {
    if (typeof BASKETS !== 'undefined') {
      BASKETS.eco.desc = 'Pièces compatibles / adaptables / premier prix.';
      BASKETS.standard.desc = 'Pièces milieu de gamme, bon équilibre prix / qualité.';
      BASKETS.premium.desc = 'Pièces haut de gamme, qualité et durabilité renforcées.';
      BASKETS.eco.extra = 0; BASKETS.standard.extra = 0; BASKETS.premium.extra = 0;
    }
  }

  function patchSidebarAndAbout() {
    const sub = $('.brand-sub');
    if (sub) sub.innerHTML = 'Mécano du Dimanche<br>Demande simple · estimation · reprise manuelle';
    const cards = $$('.sidebar-card');
    if (cards[0]) cards[0].innerHTML = '<b>Non connecté</b><br>Connectez-vous pour retrouver votre garage et vos demandes.';
    if (cards[1]) cards[1].innerHTML = '<b>Fonctionnement actuel</b><br>Le site prépare votre demande et votre estimation. La validation finale reste faite manuellement par EDM AUTO.';
    const aboutCards = $$('#about .grid-3 .card');
    if (aboutCards[0]) aboutCards[0].innerHTML = '<span class="pill green">Clair</span><h3 style="margin-top:12px">Demande lisible</h3><p>Vous renseignez votre besoin et obtenez une estimation simple à comprendre.</p>';
    if (aboutCards[1]) aboutCards[1].innerHTML = '<span class="pill blue">Pratique</span><h3 style="margin-top:12px">Préparation rapide</h3><p>Le site vous aide à préparer votre demande avant reprise par EDM AUTO.</p>';
    if (aboutCards[2]) aboutCards[2].innerHTML = '<span class="pill orange">Humain</span><h3 style="margin-top:12px">Validation manuelle</h3><p>Chaque demande est vérifiée manuellement avant confirmation finale.</p>';
    const notice = $('#about .notice');
    if (notice) notice.textContent = 'Chaque demande est reprise manuellement par EDM AUTO après étude du véhicule, des prestations souhaitées et du panier sélectionné.';
  }

  function patchNavAndAccountPage() {
    const nav = $('.nav');
    if (nav && !nav.querySelector('[data-page="account"]')) {
      const b = document.createElement('button');
      b.dataset.page = 'account';
      b.textContent = '👤 Mon compte';
      nav.insertBefore(b, nav.querySelector('[data-page="garage"]') || null);
      b.addEventListener('click', () => typeof showPage === 'function' && showPage('account'));
    }
    if (!document.getElementById('account')) {
      const main = $('main.main');
      const section = document.createElement('section');
      section.id = 'account'; section.className = 'page';
      section.innerHTML = '<div class="panel"><div class="section-title"><div><h2>Mon compte</h2><p>Retrouvez ici les informations liées à votre compte client.</p></div></div><div id="accountPageContent"></div></div>';
      main.appendChild(section);
    }
  }

  function init() {
    patchTexts();
    patchVehicleAndAccount();
    patchServices();
    patchSummary();
    patchBaskets();
    patchSidebarAndAbout();
    patchNavAndAccountPage();
    if (typeof renderBaskets === 'function') renderBaskets();
    if (typeof renderServices === 'function') renderServices();
    if (typeof updateSummary === 'function') updateSummary();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
