(() => {
  if (window.__edmComboSuspended) return;
  window.__edmComboSuspended = true;

  const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

  function suspendCalculation() {
    const original = window.calculateTotals;
    if (typeof original !== 'function' || original.__edmComboSuspended) return;

    function calculateTotalsWithoutCombo(showAlert = false) {
      const totals = original(showAlert);
      if (!totals) return totals;

      const laborBase = roundMoney(totals.laborBase ?? totals.laborTotal);
      const partsMin = roundMoney(totals.partsMin);
      const partsMax = Math.max(partsMin, roundMoney(totals.partsMax));
      const controlFee = document.getElementById('j7Accepted')?.checked
        ? roundMoney(totals.controlFee ?? totals.j7Saving ?? 30)
        : 0;
      const laborAfter = roundMoney(laborBase + controlFee);
      const totalAllMin = roundMoney(laborAfter + partsMin);
      const totalAllMax = roundMoney(laborAfter + partsMax);

      return {
        ...totals,
        laborBase,
        partsMin,
        partsMax,
        controlFee,
        j7Saving: controlFee,
        comboSaving: 0,
        comboDiscount: 0,
        comboSuspended: true,
        pricingPolicy: 'combo_suspended',
        laborAfter,
        totalAllMin,
        totalAllMax,
        totalMin: totalAllMin,
        totalMax: totalAllMax
      };
    }

    calculateTotalsWithoutCombo.__edmComboSuspended = true;
    calculateTotalsWithoutCombo.__edmOriginal = original;
    window.calculateTotals = calculateTotalsWithoutCombo;
  }

  function updateInterface() {
    document.documentElement.dataset.comboPolicy = 'suspended';

    const button = document.getElementById('comboExplainBtn');
    if (button) {
      button.textContent = 'Remise combo suspendue';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Les taux sont en cours de révision.';
    }

    const box = document.getElementById('comboExplainBox');
    if (box) {
      box.classList.remove('hidden');
      box.textContent = 'La remise groupée est temporairement suspendue pendant la révision des tarifs.';
    }

    const comboLine = document.getElementById('comboSaving')?.closest('.summary-line');
    const savingLine = document.getElementById('totalSaving')?.closest('.summary-line');
    if (comboLine) comboLine.style.display = 'none';
    if (savingLine) savingLine.style.display = 'none';

    try {
      if (typeof window.updateSummary === 'function') window.updateSummary();
    } catch (error) {
      console.warn('EDM combo suspension summary refresh unavailable', error);
    }
  }

  function install() {
    suspendCalculation();
    updateInterface();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.addEventListener('load', () => {
    install();
    setTimeout(install, 800);
    setTimeout(updateInterface, 2200);
  }, { once: true });
})();
