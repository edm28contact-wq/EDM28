(() => {
  if (window.__edmQuoteDurationInstalled) return;
  window.__edmQuoteDurationInstalled = true;
  const BUFFER_MINUTES = 30;
  let timer = null;

  const A = () => window.EDMAdmin;
  const ids = () => [...document.querySelectorAll('#quoteList article[data-quote-id]')].map((node) => node.dataset.quoteId).filter(Boolean);

  function durationText(minutes) {
    const total = Number(minutes || 0) + BUFFER_MINUTES;
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return `${hours ? `${hours} h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} min` : ''}` || '30 min';
  }

  async function installFields() {
    const quoteIds = ids();
    if (!quoteIds.length || !A()?.db) return;
    const { data, error } = await A().db.from('quotes').select('id,labor_duration_minutes').in('id', quoteIds);
    if (error) throw error;
    const values = new Map((data || []).map((row) => [row.id, row.labor_duration_minutes]));

    document.querySelectorAll('#quoteList article[data-quote-id]').forEach((article) => {
      if (article.querySelector('[data-field="laborDuration"]')) return;
      const locked = !/draft|brouillon/i.test(article.querySelector('.pill')?.textContent || '');
      const minutes = Number(values.get(article.dataset.quoteId) || 0);
      const validUntil = article.querySelector('[data-field="validUntil"]')?.closest('label');
      const label = document.createElement('label');
      label.innerHTML = `Temps de main-d’œuvre prévu (minutes)<input data-field="laborDuration" type="number" min="15" max="480" step="15" value="${minutes || ''}" ${locked ? 'disabled' : ''}><span class="muted" data-duration-summary>${minutes ? `Créneau bloqué : ${durationText(minutes)} avec 30 min entre clients.` : 'Obligatoire avant publication. 30 min seront ajoutées automatiquement.'}</span>`;
      (validUntil?.parentElement || article).appendChild(label);
      const input = label.querySelector('input');
      input?.addEventListener('input', () => {
        const value = Number(input.value || 0);
        label.querySelector('[data-duration-summary]').textContent = value >= 15 ? `Créneau bloqué : ${durationText(value)} avec 30 min entre clients.` : 'Obligatoire avant publication.';
      });
    });
  }

  async function persistAndContinue(button) {
    const article = button.closest('article[data-quote-id]');
    const input = article?.querySelector('[data-field="laborDuration"]');
    const minutes = Number(input?.value || 0);
    if (!article || !input) throw new Error('Champ de durée introuvable. Actualisez la page.');
    if (!Number.isFinite(minutes) || minutes < 15 || minutes > 480) throw new Error('Renseignez un temps de main-d’œuvre entre 15 et 480 minutes.');
    const { data, error } = await A().db.from('quotes').update({ labor_duration_minutes: minutes }).eq('id', article.dataset.quoteId).eq('status', 'draft').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('La durée ne peut être modifiée que sur un devis brouillon.');
    button.dataset.durationPass = '1';
    button.disabled = false;
    button.click();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#quoteList [data-save], #quoteList [data-publish]');
    if (!button) return;
    if (button.dataset.durationPass === '1') {
      delete button.dataset.durationPass;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    persistAndContinue(button).catch((error) => {
      A()?.status('quoteStatus', error.message || 'Durée impossible à enregistrer.', true);
      button.disabled = false;
    });
  }, true);

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => installFields().catch((error) => console.warn('EDM quote duration unavailable', error)), 80);
  }

  const start = () => {
    const host = document.getElementById('quoteList');
    if (host) new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
    document.querySelector('[data-page="quotes"]')?.addEventListener('click', schedule);
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();