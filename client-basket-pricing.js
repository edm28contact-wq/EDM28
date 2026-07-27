(() => {
  if (window.__edmBasketPricingInstalled) return;

  const SPORT_KEY = 'sport';
  const SPORT_DESCRIPTION = 'Pour les voitures sportives, versions haute performance, montages spécifiques ou pièces renforcées. La compatibilité, les références et le tarif sont validés après étude du véhicule.';

  const waitForApp = async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (
        typeof BASKETS !== 'undefined' &&
        typeof SERVICES !== 'undefined' &&
        typeof renderBaskets === 'function' &&
        typeof renderServices === 'function' &&
        typeof calculateTotals === 'function' &&
        typeof updateSummary === 'function' &&
        typeof money === 'function'
      ) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const safe = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  function installStyles() {
    if (document.getElementById('edm-basket-pricing-styles')) return;
    const style = document.createElement('style');
    style.id = 'edm-basket-pricing-styles';
    style.textContent = `
      #basketList { grid-template-columns:repeat(4,minmax(0,1fr)); }
      #basketList .basket-card { min-height:285px; }
      #basketList .basket-price { margin-top:auto; }
      #basketList .basket-card[data-basket="sport"] { border-style:dashed; }
      #basketList .basket-card[data-basket="sport"].selected { border-style:solid; }
      .basket-price-note { display:block; margin-top:7px; color:var(--muted); font-size:.86rem; font-weight:700; line-height:1.35; }
      @media (max-width:1100px) { #basketList { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:700px) { #basketList { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function configureBaskets() {
    BASKETS.eco = {
      ...BASKETS.eco,
      desc: 'Tarif de base indicatif avec des pièces compatibles, adaptables ou premier prix.'
    };
    BASKETS.standard = {
      ...BASKETS.standard,
      desc: 'Tarif de base indicatif avec des pièces milieu de gamme, pour un bon équilibre entre prix et qualité.'
    };
    BASKETS.premium = {
      ...BASKETS.premium,
      desc: 'Tarif de base indicatif avec des pièces haut de gamme privilégiant qualité et durabilité.'
    };
    BASKETS[SPORT_KEY] = {
      label: 'SPORT',
      desc: SPORT_DESCRIPTION,
      priceOnQuote: true
    };

    SERVICES.forEach((service) => {
      if (!service.parts || typeof service.parts !== 'object') service.parts = {};
      if (!Array.isArray(service.parts[SPORT_KEY])) service.parts[SPORT_KEY] = [0, 0];
    });
  }

  function ensureSportNotice() {
    const basketList = document.getElementById('basketList');
    if (!basketList || document.getElementById('sportBasketNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'sportBasketNotice';
    notice.className = 'infobox';
    notice.innerHTML = '<strong>Panier SPORT :</strong> réservé aux véhicules sportifs, versions haute performance et montages spécifiques. Le prix est établi sur devis après vérification du véhicule, des dimensions, des références et des contraintes de montage.';
    basketList.insertAdjacentElement('afterend', notice);
  }

  function renderBasketCards() {
    const box = document.getElementById('basketList');
    if (!box) return;

    box.innerHTML = Object.entries(BASKETS).map(([key, basket]) => {
      const onQuote = basket.priceOnQuote === true || key === SPORT_KEY;
      const totals = onQuote ? null : sumPartsForBasket(key);
      const price = onQuote
        ? 'Prix sur devis'
        : `Tarif de base indicatif : ${money(totals.min)} à ${money(totals.max)}`;
      const note = onQuote
        ? 'Étude obligatoire avant chiffrage.'
        : 'Le montant final dépend du véhicule et des références réellement compatibles.';

      return `<article class="basket-card ${selectedBasket === key ? 'selected' : ''}" data-basket="${safe(key)}">
        <div>
          <div class="basket-title">${safe(basket.label)}</div>
          <p>${safe(basket.desc)}</p>
        </div>
        <div class="basket-price">${safe(price)}<span class="basket-price-note">${safe(note)}</span></div>
        <div class="basket-ai"><strong>${selectedBasket === key ? 'Sélectionné' : onQuote ? 'Sur étude' : 'Disponible'}</strong></div>
      </article>`;
    }).join('');

    box.querySelectorAll('.basket-card').forEach((card) => card.addEventListener('click', () => {
      selectedBasket = card.dataset.basket;
      renderBaskets();
      renderServices();
      updateSummary();
    }));

    ensureSportNotice();
  }

  function replaceSportServicePrices() {
    if (selectedBasket !== SPORT_KEY) return;
    document.querySelectorAll('.service-details .small').forEach((element) => {
      element.textContent = 'Pièces et montage SPORT : prix sur devis après vérification de la compatibilité et des spécificités du véhicule.';
    });
  }

  function setSummaryLine(valueId, label, value, visible = true) {
    const strong = document.getElementById(valueId);
    const line = strong?.closest('.summary-line');
    if (!line) return;
    line.style.display = visible ? 'flex' : 'none';
    const text = line.querySelector('span');
    if (text) text.textContent = label;
    if (strong) strong.textContent = value;
  }

  function renderSportSummary() {
    const controlFee = document.getElementById('j7Accepted')?.checked ? 30 : 0;
    setSummaryLine('laborBefore', 'Panier SPORT', 'Prix sur devis');
    setSummaryLine('comboSaving', '', '', false);
    setSummaryLine('j7Saving', 'Contrôle préalable', money(controlFee));
    setSummaryLine('partsTotal', 'Véhicule concerné', 'Sportif / haute performance');
    setSummaryLine('totalSaving', '', '', false);
    setSummaryLine('laborAfter', 'Total estimé', 'Sur devis après étude');
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmBasketPricingInstalled) return;
    window.__edmBasketPricingInstalled = true;

    installStyles();
    configureBaskets();

    const baseRenderBaskets = window.renderBaskets;
    window.renderBaskets = function renderBasketsWithPricing() {
      renderBasketCards();
    };
    window.renderBaskets.__edmOriginal = baseRenderBaskets;

    const baseRenderServices = window.renderServices;
    window.renderServices = function renderServicesWithSportPricing() {
      baseRenderServices();
      replaceSportServicePrices();
    };

    const baseCalculateTotals = window.calculateTotals;
    function calculateTotalsWithSport(showAlert = false) {
      if (selectedBasket !== SPORT_KEY) return baseCalculateTotals(showAlert);
      const selected = getSelectedServices();
      if (showAlert && !selected.length) {
        toast('Sélectionnez au moins une prestation.');
        return null;
      }
      const laborBase = selected.reduce((sum, service) => sum + Number(service.labor || 0), 0);
      const controlFee = document.getElementById('j7Accepted')?.checked ? 30 : 0;
      return {
        selected,
        laborBase,
        laborTotal: laborBase,
        partsMin: 0,
        partsMax: 0,
        controlFee,
        j7Saving: controlFee,
        comboSaving: 0,
        comboDiscount: 0,
        comboSuspended: true,
        priceOnQuote: true,
        sportVehicle: true,
        pricingPolicy: 'sport_on_quote',
        laborAfter: 0,
        totalAllMin: 0,
        totalAllMax: 0,
        totalMin: 0,
        totalMax: 0,
        estimateLabel: 'Prix sur devis'
      };
    }
    calculateTotalsWithSport.__edmComboSuspended = true;
    calculateTotalsWithSport.__edmSportPricing = true;
    calculateTotalsWithSport.__edmOriginal = baseCalculateTotals;
    window.calculateTotals = calculateTotalsWithSport;

    const baseUpdateSummary = window.updateSummary;
    window.updateSummary = function updateSummaryWithSportPricing() {
      if (selectedBasket === SPORT_KEY) {
        renderSportSummary();
        return;
      }
      baseUpdateSummary();
      const partsLabel = document.getElementById('partsTotal')?.closest('.summary-line')?.querySelector('span');
      if (partsLabel) partsLabel.textContent = 'Pièces — tarif de base indicatif';
    };

    renderBaskets();
    renderServices();
    updateSummary();
  }

  install().catch((error) => console.error('EDM basket pricing:', error));
})();
