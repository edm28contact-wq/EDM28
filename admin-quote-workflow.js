(() => {
  const A = () => window.EDMAdmin;
  let observer;
  let pendingPublishedQuote = null;
  let pendingTimer = null;

  function ensureWaitingPage() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard) return;

    if (!document.getElementById('quote-waiting')) {
      const button = document.createElement('button');
      button.className = 'btn ghost';
      button.dataset.page = 'quote-waiting';
      button.textContent = "En attente d'acceptation";
      const notifications = nav.querySelector('[data-page="notifications"]');
      nav.insertBefore(button, notifications || null);

      const section = document.createElement('section');
      section.id = 'quote-waiting';
      section.className = 'page';
      section.innerHTML = `<div class="card"><div class="top"><div><h2>En attente d'acceptation</h2><p class="muted">Devis publiés au client et verrouillés jusqu'à sa réponse.</p></div><button id="quoteWaitingRefresh" class="btn ghost">Actualiser</button></div><div id="quoteWaitingStatus" class="status hidden"></div><div id="quoteWaitingList"><p class="muted">Aucun devis en attente d'acceptation.</p></div></div>`;
      dashboard.appendChild(section);

      button.addEventListener('click', () => {
        A()?.page('quote-waiting');
        refreshQuotes();
      });
      section.querySelector('#quoteWaitingRefresh')?.addEventListener('click', refreshQuotes);
    }
  }

  function rawStatus(article) {
    return String(article.querySelector('.pill')?.textContent || '').trim().toLowerCase();
  }

  function splitQuoteLists() {
    ensureWaitingPage();
    const quoteList = document.getElementById('quoteList');
    const waitingList = document.getElementById('quoteWaitingList');
    if (!quoteList || !waitingList) return;
    if (!quoteList.querySelector('article[data-quote-id]') && /chargement/i.test(quoteList.textContent || '')) return;

    observer?.disconnect();
    waitingList.innerHTML = '';

    let draftCount = 0;
    let waitingCount = 0;
    let publishedArticleFound = false;

    [...quoteList.querySelectorAll('article[data-quote-id]')].forEach((article) => {
      const status = rawStatus(article);
      const pill = article.querySelector('.pill');
      if (status === 'draft' || status === 'brouillon') {
        draftCount += 1;
        if (pill) pill.textContent = 'Brouillon';
        return;
      }
      if (status === 'sent' || status === "en attente d'acceptation") {
        waitingCount += 1;
        if (pill) pill.textContent = "En attente d'acceptation";
        if (article.dataset.quoteId === pendingPublishedQuote) publishedArticleFound = true;
        waitingList.appendChild(article);
        return;
      }
      article.remove();
    });

    if (!draftCount) quoteList.innerHTML = '<p class="muted">Aucun devis brouillon à compléter.</p>';
    if (!waitingCount) waitingList.innerHTML = '<p class="muted">Aucun devis en attente d\'acceptation.</p>';

    observer?.observe(quoteList, { childList: true, subtree: false });

    if (publishedArticleFound) {
      clearTimeout(pendingTimer);
      pendingPublishedQuote = null;
      A()?.page('quote-waiting');
      A()?.status('quoteWaitingStatus', "Le devis a quitté les brouillons et attend maintenant la réponse du client.");
    }
  }

  async function refreshQuotes() {
    const waitingList = document.getElementById('quoteWaitingList');
    if (waitingList) waitingList.innerHTML = '<p class="muted">Chargement…</p>';
    try {
      await window.EDMAdminQuotes?.load();
      splitQuoteLists();
    } catch (error) {
      A()?.status('quoteWaitingStatus', error.message || 'Actualisation impossible.', true);
    }
  }

  function bind() {
    ensureWaitingPage();
    const quoteList = document.getElementById('quoteList');
    if (!quoteList) return;

    observer = new MutationObserver(() => splitQuoteLists());
    observer.observe(quoteList, { childList: true, subtree: false });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-publish]');
      if (!button) return;
      pendingPublishedQuote = button.dataset.publish || null;
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pendingPublishedQuote = null; }, 10000);
    }, true);

    splitQuoteLists();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
