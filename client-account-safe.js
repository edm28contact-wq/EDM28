(() => {
  if (window.__edmAccountCompatibility) return;
  window.__edmAccountCompatibility = true;

  // Compatibility entry point only. Navigation and account rendering are
  // intentionally delegated to the single showPage/renderAccountPage pair
  // defined by the main application. No click listener is installed here.
  window.renderSafeAccount = function renderSafeAccount() {
    if (typeof showPage === 'function') {
      showPage('account');
      return;
    }

    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === 'account');
    });
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === 'account');
    });
    document.getElementById('sidebar')?.classList.remove('open');
  };
})();
