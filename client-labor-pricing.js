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
    DIR_BIELLETTES_ROTULES: 82,
    DIR_BIELLETTES_INTERIEURES: 106,
    STAB_BIELLETTES: 55
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

  function cloneParts(parts = {}) {
    return Object.fromEntries(
      Object.entries(parts).map(([key, range]) => [key, Array.isArray(range) ? [...range] : range])
    );
  }

  function removePricingTables() {
    document.getElementById('edmLaborPricing')?.remove();
    document.getElementById('edmCompetitorPricing')?.remove();
    document.getElementById('edm-labor-pricing-styles')?.remove();
    document.getElementById('edm-competitor-pricing-styles')?.remove();
  }

  function splitDirectionService() {
    if (SERVICES.some((service) => service.id === 'DIR_BIELLETTES_INTERIEURES')) return;

    const index = SERVICES.findIndex((service) => service.id === 'DIR_BIELLETTES_ROTULES');
    if (index < 0) return;

    const source = SERVICES[index];
    const external = {
      ...source,
      id: 'DIR_BIELLETTES_ROTULES',
      name: 'Rotules de direction extérieures, la paire',
      labor: LABOR_PRICES.DIR_BIELLETTES_ROTULES,
      parts: cloneParts(source.parts),
      short: 'Remplace les rotules extérieures de direction par paire.',
      detail: 'À prévoir en cas de jeu, claquement, usure irrégulière des pneus ou défaut au contrôle technique.'
    };

    const internal = {
      ...source,
      id: 'DIR_BIELLETTES_INTERIEURES',
      name: 'Biellettes / rotules intérieures, la paire',
      labor: LABOR_PRICES.DIR_BIELLETTES_INTERIEURES,
      parts: cloneParts(source.parts),
      short: 'Remplace les biellettes ou rotules intérieures de direction par paire.',
      detail: 'À prévoir en cas de jeu dans la direction, claquement ou imprécision du train avant. Parallélisme conseillé après intervention.'
    };

    SERVICES.splice(index, 1, external, internal);
  }

  function applyNewPrices() {
    splitDirectionService();

    SERVICES.forEach((service) => {
      if (Object.prototype.hasOwnProperty.call(LABOR_PRICES, service.id)) {
        service.labor = LABOR_PRICES[service.id];
      }

      if (service.id === 'FR_PURGE') {
        service.parts = {
          ...(service.parts || {}),
          eco: [8, 8],
          standard: [8, 8],
          premium: [8, 8]
        };
        if (service.parts.sport) service.parts.sport = [0, 0];
        service.short = 'Purge à la machine : 52 € au total avec environ 1 litre de liquide.';
      }
    });
  }

  function displayPurgeTotal() {
    document.querySelectorAll('.service-card').forEach((card) => {
      const serviceId = card.querySelector('.service-check')?.value;
      if (serviceId !== 'FR_PURGE') return;
      const price = card.querySelector('.service-price');
      if (price) price.textContent = money(52);
    });
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmLaborPricingInstalled) return;
    window.__edmLaborPricingInstalled = true;

    removePricingTables();
    applyNewPrices();

    const baseRenderServices = window.renderServices;
    window.renderServices = function renderServicesWithNewPrices() {
      baseRenderServices();
      removePricingTables();
      displayPurgeTotal();
    };

    renderServices();
    renderBaskets();
    updateSummary();
  }

  install().catch((error) => console.error('EDM labor pricing:', error));
})();
