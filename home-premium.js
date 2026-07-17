(function () {
  const style = document.createElement('style');
  style.id = 'edm-premium-home';
  style.textContent = `
    .premium-home{display:grid;gap:18px;margin-top:18px}
    .premium-block{padding:clamp(20px,3vw,30px);border:1px solid #3b474e;border-radius:24px;background:linear-gradient(145deg,#202b31,#12191d);box-shadow:0 18px 44px rgba(0,0,0,.28)}
    .premium-head{text-align:center;margin-bottom:22px}
    .premium-head small{color:#d99162;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .premium-head h2{margin-top:8px;color:#fff!important;font-size:clamp(1.8rem,3vw,2.6rem)}
    .premium-head p{max-width:720px;margin:10px auto 0}
    .premium-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
    .premium-step{padding:18px 14px;text-align:center;border:1px solid rgba(224,154,105,.25);border-radius:18px;background:linear-gradient(145deg,#1c262b,#10171a)}
    .premium-icon{width:48px;height:48px;margin:0 auto 13px;display:grid;place-items:center;border-radius:15px;border:1px solid rgba(224,154,105,.36);color:#f0b389;background:rgba(216,141,93,.1);font-weight:900}
    .premium-step b{display:block;color:#fff!important;margin-bottom:6px}.premium-step p{margin:0;font-size:.88rem}
    .premium-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .premium-trust article{padding:18px;border:1px solid rgba(224,154,105,.22);border-radius:18px;background:linear-gradient(145deg,#1d282e,#11181c)}
    .premium-trust b{color:#fff!important;text-transform:uppercase;font-size:.84rem}.premium-trust p{margin:7px 0 0;font-size:.9rem}
    .premium-cta{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:24px 28px;border-radius:22px;background:linear-gradient(110deg,#c17b50,#84472c 60%,#35251f);box-shadow:0 20px 44px rgba(80,38,20,.34)}
    .premium-cta h3{color:#fff!important}.premium-cta p{margin:6px 0 0;color:#f2ddd0!important}.premium-cta button{background:#101619!important;color:#fff!important}
    .hero h1{text-transform:uppercase}.hero-grid{grid-template-columns:minmax(0,1.2fr) minmax(290px,.8fr)!important}
    @media(max-width:1100px){.premium-steps{grid-template-columns:repeat(3,1fr)}.premium-trust{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:720px){.premium-steps,.premium-trust{grid-template-columns:1fr}.premium-cta{flex-direction:column;align-items:stretch}.premium-cta button{width:100%}}
  `;
  document.head.appendChild(style);

  function init() {
    const q = (selector) => document.querySelector(selector);
    const eyebrow = q('#home .eyebrow');
    if (eyebrow) eyebrow.textContent = 'EDM · Spécialiste du freinage';

    const title = q('#home h1');
    if (title) title.innerHTML = 'Votre sécurité,<br>notre expertise.';

    const lead = q('#home .lead');
    if (lead) lead.textContent = 'Spécialiste du freinage et de l’entretien automobile. Préparez une demande précise, consultez une estimation transparente et bénéficiez d’une validation humaine.';

    const buttons = document.querySelectorAll('#home .btn-row .btn');
    if (buttons[0]) buttons[0].textContent = 'Demander une estimation';
    if (buttons[1]) buttons[1].textContent = 'Voir le fonctionnement';

    const stats = document.querySelectorAll('#home .hero-stat');
    const values = [
      ['01','Diagnostic précis','Décrivez le véhicule et les symptômes.'],
      ['02','Tarifs transparents','Visualisez la main-d’œuvre et les pièces estimées.'],
      ['03','Validation EDM','Chaque demande est vérifiée avant confirmation.']
    ];
    stats.forEach((node,index) => {
      if (values[index]) node.innerHTML = `<span>${values[index][0]}</span><div><b>${values[index][1]}</b><p>${values[index][2]}</p></div>`;
    });

    const home = q('#home');
    if (!home || q('.premium-home')) return;

    const wrap = document.createElement('div');
    wrap.className = 'premium-home';
    wrap.innerHTML = `
      <section class="premium-block">
        <div class="premium-head"><small>Parcours client</small><h2>Comment ça marche</h2><p>Un processus simple pour préparer votre demande avant la validation finale par EDM.</p></div>
        <div class="premium-steps">
          <article class="premium-step"><div class="premium-icon">1</div><b>Votre véhicule</b><p>Renseignez les informations utiles.</p></article>
          <article class="premium-step"><div class="premium-icon">2</div><b>Vos besoins</b><p>Sélectionnez les prestations souhaitées.</p></article>
          <article class="premium-step"><div class="premium-icon">3</div><b>Estimation</b><p>Consultez les prix et niveaux de pièces.</p></article>
          <article class="premium-step"><div class="premium-icon">4</div><b>Transmission</b><p>Envoyez votre demande complète.</p></article>
          <article class="premium-step"><div class="premium-icon">5</div><b>Validation</b><p>EDM contrôle avant confirmation.</p></article>
        </div>
      </section>
      <section class="premium-block">
        <div class="premium-head"><small>L’engagement EDM</small><h2>Pourquoi choisir EDM</h2></div>
        <div class="premium-trust">
          <article><b>Expertise freinage</b><p>Une approche centrée sur la sécurité et la précision.</p></article>
          <article><b>Pièces adaptées</b><p>Trois niveaux selon la qualité recherchée et le budget.</p></article>
          <article><b>Transparence</b><p>Une estimation détaillée, lisible et clairement indicative.</p></article>
          <article><b>Suivi humain</b><p>Chaque demande est contrôlée manuellement avant confirmation.</p></article>
        </div>
      </section>
      <section class="premium-cta">
        <div><h3>Préparez votre demande maintenant</h3><p>Renseignez votre véhicule et obtenez une première estimation.</p></div>
        <button class="btn" type="button">Commencer ma demande</button>
      </section>`;
    wrap.querySelector('button').onclick = () => q('[data-page="appointment"]')?.click();
    home.appendChild(wrap);
  }

  window.addEventListener('load', init);
  setTimeout(init, 350);
})();
