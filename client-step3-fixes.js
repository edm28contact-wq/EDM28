(() => {
  const selectedServiceIds = new Set();

  const waitForApp = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (typeof renderServices === 'function' && typeof getSelectedServices === 'function' && typeof money === 'function') return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const syncVisibleSelections = () => {
    document.querySelectorAll('.service-check').forEach((input) => {
      if (input.checked) selectedServiceIds.add(input.value);
      else selectedServiceIds.delete(input.value);
    });
  };

  const originalGetSelectedServiceIds = getSelectedServiceIds;
  const originalRenderServices = renderServices;

  getSelectedServiceIds = function patchedGetSelectedServiceIds() {
    syncVisibleSelections();
    return Array.from(selectedServiceIds);
  };

  renderServices = function patchedRenderServices() {
    syncVisibleSelections();
    originalRenderServices();
    document.querySelectorAll('.service-check').forEach((input) => {
      input.checked = selectedServiceIds.has(input.value);
    });
  };

  calculateTotals = function patchedCalculateTotals(showAlert = false) {
    const selected = getSelectedServices();
    if (showAlert && !selected.length) {
      toast('Sélectionne au moins une prestation.');
      return null;
    }

    let laborBase = 0;
    let partsMin = 0;
    let partsMax = 0;

    selected.forEach((service) => {
      laborBase += Number(service.labor || 0);
      partsMin += Number(service.parts?.[selectedBasket]?.[0] || 0);
      partsMax += Number(service.parts?.[selectedBasket]?.[1] || 0);
    });

    const compatibleGroups = new Map();
    selected
      .filter((service) => service.eligible && !service.excluded)
      .forEach((service) => {
        const key = String(service.category || 'Autres');
        if (!compatibleGroups.has(key)) compatibleGroups.set(key, []);
        compatibleGroups.get(key).push(service);
      });

    const candidates = Array.from(compatibleGroups.values())
      .filter((group) => group.length >= 2)
      .flatMap((group) => group);

    let comboSaving = 0;
    if (candidates.length) {
      const cheapest = [...candidates].sort((a, b) => Number(a.labor || 0) - Number(b.labor || 0))[0];
      comboSaving = Math.round(Number(cheapest.labor || 0) * 0.30 * 100) / 100;
    }

    const controlFee = document.getElementById('j7Accepted')?.checked ? 30 : 0;
    const laborAfter = Math.round((laborBase - comboSaving + controlFee) * 100) / 100;
    const totalAllMin = Math.round((laborAfter + partsMin) * 100) / 100;
    const totalAllMax = Math.round((laborAfter + partsMax) * 100) / 100;

    return {
      selected,
      laborBase,
      partsMin,
      partsMax,
      comboSaving,
      j7Saving: controlFee,
      laborAfter,
      totalAllMin,
      totalAllMax,
      basketExtra: 0,
      immobilisation: 0,
      totalBefore: laborBase
    };
  };

  const originalSelectFreinagePack = selectFreinagePack;
  selectFreinagePack = function patchedSelectFreinagePack() {
    selectedServiceIds.clear();
    selectedServiceIds.add('FR_DISC_PLAQ_AV_AR');
    selectedServiceIds.add('FR_PURGE');
    originalSelectFreinagePack();
  };

  window.__edmStep3SelectionState = selectedServiceIds;

  renderServices();
  renderBaskets();
  updateSummary();
})();