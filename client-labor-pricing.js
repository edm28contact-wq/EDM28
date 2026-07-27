(() => {
  if (window.__edmLaborPricingInstalled) return;

  const LABOR_PRICES = Object.freeze({
    FR_PLAQ_AV: 40,
    FR_PLAQ_AR: 48,
    FR_PLAQ_AV_AR: 88,
    FR_DISC_PLAQ_AV: 66,
    FR_DISC_PLAQ_AR: 74,
    FR_DISC_PLAQ_AV_AR: 140,
    FR_PURGE: 44,
    SUS_TRIANGLES: 104,
    DIR_BIELLETTES_ROTULES: 70,
    STAB_BIELLETTES: 50
  });

  const waitForApp = async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (
        typeof SERVICES !== 'undefined' &&
        typeof renderServices === 'function' &&
        typeof renderBaskets === 'function' &&
        typeof updateSummary === 'function' &&
        typeof money === 'function'
      ) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const formatRange = (minimum, maximum) => {
    const min = Number(minimum || 0);
    const max = Math.max(min, Number(maximum || 0));
    return min === max ? money(min) : `${money(min)} à ${money(max)}`;
  };

  function installStyles() {
    if (document.getElementById('edm-labor-pricing-styles')) return;
    const style = document.createElement('style');
    style.id = 'edm-labor-pricing-styles';
    style.textContent = `
      #edmLaborPricing { margin:16px 0 20px; border:1px solid var(--border); border-radius:18px; overflow:hidden; background:var(--surface-2, #fff); }
      #edmLaborPricing .labor-pricing-head { padding:16px; border-bottom:1px solid var(--border); }
      #edmLaborPricing .labor-pricing-head h4 { margin:0 0 6px; font-size:1.05rem; }
      #edmLaborPricing .labor-pricing-head p { margin:0; }
      #edmLaborPricing .labor-pricing-scroll { overflow-x:auto; }
      #edmLaborPricing table { width:100%; border-collapse:collapse; min-width:780px; }
      #edmLaborPricing th,
      #edmLaborPricing td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--border); vertical-align:top; }
      #edmLaborPricing th { font-size:.86rem; color:var(--muted); background:var(--surface-1, #f8f8f8); }
      #edmLaborPricing td:not(:first-child),
      #edmLaborPricing th:not(:first-child) { text-align:right; white-space:nowrap; }
      #edmLaborPricing tbody tr:last-child td { border-bottom:0; }
      #edmLaborPricing .labor-price { font-weight:900; }
      #edmLaborPricing .client-total { font-weight:800; }
      #edmLaborPricing .labor-pricing-foot { padding:13px 16px; border-top:1px solid var(--border); font-size:.9rem; color:var(--muted); }
      .service-card .service-price .labor-price-label { display:block; margin-bottom:3px; color:var(--muted); font-size:.78rem; font-weight:800; }
      @media (max-width:700px) {
        #edmLaborPricing .labor-pricing-head,
        #edmLaborPricing .labor-pricing-foot { padding:14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function applyLaborPrices() {
    SERVICES.forEach((service) => {
      if (Object.prototype.hasOwnProperty.call(LABOR_PRICES, service.id)) {
        service.labor = LABOR_PRICES[service.id];
        service.pricingPolicy = 'edm_75_percent_competitor_labor';
      }

      if (service.id === 'FR_PURGE') {
        service.parts = {
          ...(service.parts || {}),
          eco: [8, 8],
          standard: [8, 8],
          premium: [8, 8]
        };
        service.short = 'Purge à la machine : 44 € de main-d’œuvre, liquide en supplément.';
      }
    });
  }

  function totalForBasket(service, basketKey) {
    const range = service.parts?.[basketKey] || [0, 0];
    return formatRange(
      Number(service.labor || 0) + Number(range[0] || 0),
      Number(service.labor || 0) + Number(range[1] || 0)
    );
  }

  function renderPricingGrid() {
    const serviceList = document.getElementById('serviceList');
    if (!serviceList) return;

    let block = document.getElementById('edmLaborPricing');
    if (!block) {
      block = document.createElement('section');
      block.id = 'edmLaborPricing';
      block.setAttribute('aria-labelledby', 'edmLaborPricingTitle');
      serviceList.insertAdjacentElement('beforebegin', block);
    }

    const rows = SERVICES.map((service) => `
      <tr>
        <td>${escapeHtml(service.name)}</td>
        <td class="labor-price">${money(service.labor)}</td>
        <td class="client-total">${totalForBasket(service, 'eco')}</td>
        <td class="client-total">${totalForBasket(service, 'standard')}</td>
        <td class="client-total">${totalForBasket(service, 'premium')}</td>
      </tr>
    `).join('');

    block.innerHTML = `
      <div class="labor-pricing-head">
        <h4 id="edmLaborPricingTitle">Grille tarifaire EDM et coût estimé pour le client</h4>
        <p>Le coût total estimé correspond à la main-d’œuvre EDM additionnée aux pièces estimées en débours. Les montants varient selon le véhicule et les références compatibles.</p>
      </div>
      <div class="labor-pricing-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Prestation</th>
              <th scope="col">Main-d’œuvre EDM</th>
              <th scope="col">Total client ÉCO</th>
              <th scope="col">Total client STANDARD</th>
              <th scope="col">Total client PREMIUM</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td>Véhicule sportif ou montage particulier</td>
              <td colspan="4" class="client-total">Prix sur devis après étude</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="labor-pricing-foot">Les tarifs sont indicatifs. Une difficulté de démontage, une pièce grippée, une référence spéciale ou un véhicule sportif peut nécessiter un devis complémentaire avant intervention.</div>
    `;
  }

  function annotateServiceCards() {
    document.querySelectorAll('.service-card').forEach((card) => {
      const serviceId = card.querySelector('.service-check')?.value;
      const service = SERVICES.find((item) => item.id === serviceId);
      if (!service) return;

      const price = card.querySelector('.service-price');
      if (price) {
        price.innerHTML = `<span class="labor-price-label">Main-d’œuvre EDM</span>${money(service.labor)}`;
      }

      const partsLine = card.querySelector('.service-details .small');
      if (partsLine && typeof selectedBasket !== 'undefined' && selectedBasket !== 'sport') {
        const range = service.parts?.[selectedBasket] || [0, 0];
        const basketLabel = typeof BASKETS !== 'undefined' ? BASKETS[selectedBasket]?.label || selectedBasket : selectedBasket;
        const total = formatRange(
          Number(service.labor || 0) + Number(range[0] || 0),
          Number(service.labor || 0) + Number(range[1] || 0)
        );

        partsLine.textContent = service.id === 'FR_PURGE'
          ? `Liquide estimé : ${money(range[0])}. Coût total indicatif pour le client : ${total}.`
          : `Pièces estimées en débours, panier ${basketLabel} : ${formatRange(range[0], range[1])}. Coût total indicatif pour le client : ${total}.`;
      }
    });
  }

  function updateSummaryLabels() {
    const partsLabel = document.getElementById('partsTotal')?.closest('.summary-line')?.querySelector('span');
    if (partsLabel) partsLabel.textContent = 'Pièces estimées en débours';

    const laborLabel = document.getElementById('laborBefore')?.closest('.summary-line')?.querySelector('span');
    if (laborLabel) laborLabel.textContent = 'Main-d’œuvre EDM';

    const totalLabel = document.getElementById('laborAfter')?.closest('.summary-line')?.querySelector('span');
    if (totalLabel && typeof selectedBasket !== 'undefined' && selectedBasket !== 'sport') {
      totalLabel.textContent = 'Coût total estimé pour le client';
    }
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmLaborPricingInstalled) return;
    window.__edmLaborPricingInstalled = true;

    installStyles();
    applyLaborPrices();
    renderPricingGrid();

    const baseRenderServices = window.renderServices;
    window.renderServices = function renderServicesWithLaborPricing() {
      baseRenderServices();
      annotateServiceCards();
      renderPricingGrid();
      updateSummaryLabels();
    };

    const baseUpdateSummary = window.updateSummary;
    window.updateSummary = function updateSummaryWithLaborPricing() {
      baseUpdateSummary();
      updateSummaryLabels();
    };

    renderServices();
    renderBaskets();
    updateSummary();
  }

  install().catch((error) => console.error('EDM labor pricing:', error));
})();
