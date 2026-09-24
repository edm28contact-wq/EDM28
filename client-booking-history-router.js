(() => {
  if (window.__edmBookingHistoryRouterInstalled) return;
  window.__edmBookingHistoryRouterInstalled = true;

  function installHistoryHook() {
    if (window.__edmVehicleHistoryHookInstalled) return;
    const original = window.renderRequestHistory;
    window.renderRequestHistory = async function renderCombinedHistory(...args) {
      if (typeof original === 'function') await original(...args);
      try { if (typeof renderGarage === 'function') renderGarage(); } catch (error) { console.warn('EDM vehicles unavailable', error); }
      if (typeof window.renderVehicleHistory === 'function') await window.renderVehicleHistory();
    };
    window.__edmVehicleHistoryHookInstalled = true;
  }

  function install() {
    installHistoryHook();

    const history = document.getElementById('history');
    if (history) {
      new MutationObserver(() => {
        if (!history.classList.contains('active')) return;
        try { if (typeof renderGarage === 'function') renderGarage(); } catch (error) { console.warn('EDM vehicles unavailable', error); }
        if (typeof window.renderVehicleHistory === 'function') {
          setTimeout(() => window.renderVehicleHistory().catch((error) => console.warn('EDM vehicle history unavailable', error)), 50);
        }
      }).observe(history, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();