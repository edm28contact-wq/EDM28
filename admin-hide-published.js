(() => {
  if (window.__edmHidePublishedInstalled) return;
  window.__edmHidePublishedInstalled = true;

  const ACTIVE_PAGES = new Set(['quotes', 'interventions', 'invoice-actions', 'document-pdf']);

  function hidePublishedCards(root) {
    if (!root) return;
    root.querySelectorAll('article.card').forEach((card) => {
      const status = String(card.querySelector('.pill')?.textContent || '').trim().toLowerCase();
      if (!status) return;

      const page = card.closest('.page')?.id || '';
      if (!ACTIVE_PAGES.has(page)) return;

      const hide = page === 'quotes'
        ? status !== 'draft'
        : page === 'invoice-actions'
          ? status !== 'draft'
          : page === 'interventions'
            ? ['completed', 'invoiced'].includes(status)
            : page === 'document-pdf'
              ? ['sent', 'accepted', 'refused', 'issued', 'partially_paid', 'paid', 'overdue', 'completed', 'invoiced'].includes(status)
              : false;

      card.hidden = hide;
    });
  }

  function install() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    hidePublishedCards(dashboard);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        hidePublishedCards(mutation.target.closest?.('.page') || mutation.target);
      }
    });
    observer.observe(dashboard, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
