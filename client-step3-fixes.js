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

  function installStyles() {
    if (document.getElementById('edm-services-redesign')) return;
    const style = document.createElement('style');
    style.id = 'edm-services-redesign';
    style.textContent = `
      #serviceList { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .service-card { position:relative; display:block; margin:0; padding:18px 18px 18px 62px; cursor:pointer; min-height:150px; border:2px solid var(--border); transition:.18s ease; }
      .service-card:hover { transform:translateY(-2px); border-color:#c77d4e; }
      .service-card.selected { border-color:#c77d4e; box-shadow:0 14px 34px rgba(185,111,67,.18); }
      .service-card .service-check { position:absolute; left:18px; top:18px; width:28px; height:28px; margin:0; opacity:0; pointer-events:none; }
      .service-card::before { content:'+'; position:absolute; left:18px; top:18px; width:30px; height:30px; display:grid; place-items:center; border-radius:10px; border:2px solid #a8a29e; font-weight:1000; font-size:1.2rem; }
      .service-card.selected::before { content:'✓'; background:#b96f43; border-color:#b96f43; color:white; }
      .service-card .service-price { margin-top:12px; text-align:left; font-size:1.15rem; }
      .service-card .service-details { grid-column:auto; margin-top:14px; }
      .service-card .link-button { margin-top:10px; }
      .service-toolbar { gap:10px; }
      .service-toolbar .btn { min-height:48px; padding:12px 18px; }
      .check-row { grid-template-columns:1fr 1fr; }
      .check-card { position:relative; cursor:pointer; padding:18px 18px 18px 58px; min-height:170px; border:2px solid var(--border); transition:.18s ease; }
      .check-card input { position:absolute; left:18px; top:18px; width:26px; height:26px; accent-color:#b96f43; }
      .check-card:has(input:checked) { border-color:#b96f43; box-shadow:0 12px 28px rgba(185,111,67,.14); }
      #summaryBox { gap:10px; }
      #summaryBox .summary-line { display:flex; flex-direction:row; align-items:center; justify-content:space-between; padding:15px 16px; }
      #summaryBox .summary-line strong { text-align:right; }
      #summaryBox .summary-line.total { padding:18px 16px; font-size:1.08rem; }
      @media (max-width:900px) { #serviceList { grid-template-columns:1fr; } }
      @media (max-width:700px) { .check-row { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function refreshServiceCards() {
    document.querySelectorAll('.service-card').forEach((card) => {
      const input = card.querySelector('.service-check');
      if (!input) return;
      card.classList.toggle('selected', input.checked);
      card.setAttribute('role', 'checkbox');
      card.setAttribute('aria-checked', input.checked ? 'true' : 'false');
      card.tabIndex = 0;
      if (card.dataset.largeSelectBound === '1') return;
      card.dataset.largeSelectBound = '1';
      const toggle = (event) => {
        if (event.target.closest('[data-more]')) return;
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', toggle);
    });
  }

  function renderCorrectSummary() {
    const totals = calculateTotals(false) || {};
    const control = Number(totals.j7Saving || 0);
    const laborAfterDiscount = Math.max(0, Number(totals.laborBase || 0) - Number(totals.comboSaving || 0));
    const totalMin = laborAfterDiscount + control + Number(totals.partsMin || 0);
    const totalMax = laborAfterDiscount + control + Number(totals.partsMax || 0);
    const lines = document.querySelectorAll('#summaryBox .summary-line');
    const values = [
      ['Main-d’œuvre', money(totals.laborBase || 0)],
      ['Remise prestations groupées', `-${money(totals.comboSaving || 0)}`],
      ['Contrôle préalable', money(control)],
      ['Pièces estimées', `${money(totals.partsMin || 0)} à ${money(totals.partsMax || 0)}`],
      ['Total estimé', `${money(totalMin)} à ${money(totalMax)}`]
    ];
    lines.forEach((line, index) => {
      if (index >= values.length) { line.style.display = 'none'; return; }
      line.style.display = 'flex';
      line.classList.toggle('total', index === values.length - 1);
      line.classList.remove('saving');
      const span = line.querySelector('span');
      const strong = line.querySelector('strong');
      if (span) span.textContent = values[index][0];
      if (strong) strong.textContent = values[index][1];
    });
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmStep3Redesign) return;
    window.__edmStep3Redesign = true;
    installStyles();

    const originalRenderServices = renderServices;
    getSelectedServiceIds = function patchedGetSelectedServiceIds() {
      syncVisibleSelections();
      return Array.from(selectedServiceIds);
    };
    renderServices = function patchedRenderServices() {
      syncVisibleSelections();
      originalRenderServices();
      document.querySelectorAll('.service-check').forEach((input) => { input.checked = selectedServiceIds.has(input.value); });
      refreshServiceCards();
    };

    calculateTotals = function patchedCalculateTotals(showAlert = false) {
      const selected = getSelectedServices();
      if (showAlert && !selected.length) { toast('Sélectionnez au moins une prestation.'); return null; }
      let laborBase = 0, partsMin = 0, partsMax = 0;
      const groups = new Map();
      selected.forEach((service) => {
        laborBase += Number(service.labor || 0);
        partsMin += Number(service.parts?.[selectedBasket]?.[0] || 0);
        partsMax += Number(service.parts?.[selectedBasket]?.[1] || 0);
        if (service.eligible && !service.excluded) {
          const key = String(service.category || 'Autres');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(service);
        }
      });
      let comboSaving = 0;
      const discounted = Array.from(groups.values()).filter((group) => group.length >= 2).flatMap((group) => group);
      if (discounted.length) comboSaving = Math.round(Math.min(...discounted.map((s) => Number(s.labor || 0))) * 0.3 * 100) / 100;
      const controlFee = document.getElementById('j7Accepted')?.checked ? 30 : 0;
      const laborAfter = Math.round((laborBase - comboSaving) * 100) / 100;
      const totalAllMin = Math.round((laborAfter + controlFee + partsMin) * 100) / 100;
      const totalAllMax = Math.round((laborAfter + controlFee + partsMax) * 100) / 100;
      return { selected, laborBase, partsMin, partsMax, comboSaving, j7Saving: controlFee, laborAfter, totalAllMin, totalAllMax, basketExtra:0, immobilisation:0, totalBefore:laborBase };
    };

    const originalUpdateSummary = updateSummary;
    updateSummary = function patchedUpdateSummary() {
      originalUpdateSummary();
      renderCorrectSummary();
    };

    const originalSelectFreinagePack = selectFreinagePack;
    selectFreinagePack = function patchedSelectFreinagePack() {
      selectedServiceIds.clear();
      selectedServiceIds.add('FR_DISC_PLAQ_AV_AR');
      selectedServiceIds.add('FR_PURGE');
      originalSelectFreinagePack();
    };

    renderServices();
    renderBaskets();
    updateSummary();
  }

  install().catch((error) => console.error('EDM services redesign:', error));
})();