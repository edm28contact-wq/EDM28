(() => {
  if (window.__edmHistoryVisibilityInstalled) return;
  window.__edmHistoryVisibilityInstalled = true;

  function isManagedHistorySection(node) {
    if (!(node instanceof HTMLElement)) return false;
    return [...node.attributes].some((attribute) => attribute.name.startsWith('data-') && attribute.name.endsWith('-history'));
  }

  function revealManagedHistory() {
    const host = document.getElementById('historyList');
    if (!host) return;
    [...host.children].forEach((child) => {
      if (isManagedHistorySection(child) && child.hidden) child.hidden = false;
    });
  }

  function install() {
    const host = document.getElementById('historyList');
    if (!host || host.dataset.historyVisibilityObserved === '1') return;
    host.dataset.historyVisibilityObserved = '1';
    new MutationObserver(revealManagedHistory).observe(host, {
      childList: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
    revealManagedHistory();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.addEventListener('pageshow', revealManagedHistory);
  window.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-page="history"]')) setTimeout(revealManagedHistory, 0);
  }, true);
})();