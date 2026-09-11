(() => {
  if (window.__edmBookingHistoryRouterInstalled) return;
  window.__edmBookingHistoryRouterInstalled = true;

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

  function install() {
    document.addEventListener('click', (event) => {
      const booking = event.target.closest?.('[data-page="booking"]');
      if (!booking) return;
      event.preventDefault();
      activateBooking();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
