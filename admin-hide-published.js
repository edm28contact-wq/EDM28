(() => {
  if (window.__edmHidePublishedInstalled) return;
  window.__edmHidePublishedInstalled = true;

  const ACTIVE_PAGES = new Set(['quotes', 'interventions', 'invoice-actions', 'document-pdf']);
  const PUBLISHED_STATUSES = new Set(['sent', 'accepted', 'refused', 'issued', 'partially_paid', 'paid', 'overdue', 'completed', 'invoiced']);

  function cardStatus(card, page) {
    const selector = page === 'document-pdf' ? 'p.muted' : '.pill';
    return String(card.querySelector(selector)?.textContent || '').trim().toLowerCase();
  }

  function hidePublishedCards(root) {
    if (!root) return;
    root.querySelectorAll('article.card').forEach((card) => {
      const page = card.closest('.page')?.id || '';
      if (!ACTIVE_PAGES.has(page)) return;
      const status = cardStatus(card, page);
      if (!status) return;

      const hide = page === 'quotes'
        ? !['draft', 'brouillon'].includes(status)
        : page === 'invoice-actions'
          ? status !== 'draft'
          : page === 'interventions'
            ? ['completed', 'invoiced'].includes(status)
            : PUBLISHED_STATUSES.has(status);

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