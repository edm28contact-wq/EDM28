(() => {
  if (window.__edmBookingHistoryRouterInstalled) return;
  window.__edmBookingHistoryRouterInstalled = true;

  let observedHistoryHost = null;
  let historyHostObserver = null;

  function isManagedHistorySection(node) {
    if (!(node instanceof HTMLElement)) return false;
    return [...node.attributes].some((attribute) => attribute.name.startsWith('data-') && attribute.name.endsWith('-history'));
  }

  function revealManagedHistory(host = document.getElementById('historyList')) {
    if (!host) return;
    [...host.children].forEach((child) => {
      if (isManagedHistorySection(child) && child.hidden) child.hidden = false;
    });
  }

  function observeHistoryHost(host) {
    if (!host || observedHistoryHost === host) return;
    historyHostObserver?.disconnect();
    observedHistoryHost = host;
    historyHostObserver = new MutationObserver(() => revealManagedHistory(host));
    historyHostObserver.observe(host, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ['hidden']
    });
  }

  function ensureHistoryHost() {
    const history = document.getElementById('history');
    if (!history) return null;

    let host = document.getElementById('historyList');
    if (!host) {
      host = document.createElement('div');
      host.id = 'historyList';
      const vehicleHistory = history.querySelector('#edmVehicleHistory');
      if (vehicleHistory?.parentElement) vehicleHistory.parentElement.insertBefore(host, vehicleHistory);
      else (history.querySelector('.panel') || history).appendChild(host);
    }

    observeHistoryHost(host);
    revealManagedHistory(host);
    return host;
  }

  function activateBooking() {
    if (!document.getElementById('booking')) return;
    document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === 'booking'));
    document.querySelectorAll('[data-page]').forEach((button) => {
      const active = button.dataset.page === 'booking';
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sideNav')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('show');
    document.body?.classList.remove('menu-open');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function installHistoryHook() {
    if (window.__edmVehicleHistoryHookInstalled) return;
    window.__edmVehicleHistoryHookInstalled = true;
  }

  function install() {
    installHistoryHook();
    ensureHistoryHost();

    document.addEventListener('click', (event) => {
      const booking = event.target.closest?.('[data-page="booking"]');
      if (!booking) return;
      event.preventDefault();
      activateBooking();
    });

    const history = document.getElementById('history');
    if (history) {
      new MutationObserver(() => ensureHistoryHost()).observe(history, { childList: true });
      new MutationObserver(() => {
        if (history.classList.contains('active') && typeof window.renderVehicleHistory === 'function') {
          ensureHistoryHost();
          setTimeout(() => window.renderVehicleHistory()
            .then(() => revealManagedHistory())
            .catch((error) => console.warn('EDM vehicle history unavailable', error)), 50);
        }
      }).observe(history, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();