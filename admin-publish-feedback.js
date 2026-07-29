(() => {
  if (window.__edmPublishFeedbackInstalled) return;
  window.__edmPublishFeedbackInstalled = true;

  function findPanel(button) {
    const card = button.closest('[data-quote-id],[data-invoice-action]');
    if (!card) return null;
    let panel = card.querySelector('[data-publish-feedback]');
    if (!panel) {
      panel = document.createElement('div');
      panel.dataset.publishFeedback = 'true';
      panel.className = 'status';
      panel.style.display = 'block';
      panel.style.marginTop = '12px';
      const toolbar = button.closest('.toolbar');
      if (toolbar) toolbar.insertAdjacentElement('afterend', panel);
      else card.appendChild(panel);
    }
    return panel;
  }

  function display(button, message, state) {
    const panel = findPanel(button);
    if (!panel) return;
    panel.textContent = message;
    panel.className = `status ${state === 'error' ? 'error' : state === 'success' ? 'ok' : ''}`;
    panel.style.display = 'block';
    button.setAttribute('aria-busy', state === 'working' ? 'true' : 'false');
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quote-id] [data-publish],[data-invoice-action] [data-issue]');
    if (!button) return;

    display(button, 'Clic reçu. Publication en cours...', 'working');
    const status = button.closest('[data-quote-id]') ? document.getElementById('quoteStatus') : document.getElementById('invoiceActionStatus');
    let finished = false;
    const observer = status ? new MutationObserver(() => {
      const message = status.textContent.trim();
      if (!message) return;
      finished = true;
      display(button, message, status.classList.contains('error') ? 'error' : 'success');
      observer.disconnect();
    }) : null;
    if (observer) observer.observe(status, { childList: true, subtree: true, attributes: true });

    window.setTimeout(() => {
      if (finished) return;
      if (observer) observer.disconnect();
      display(button, button.disabled ? 'La publication travaille encore. Ne fermez pas cette page.' : 'La publication ne s est pas terminée. Consultez le message en haut de l onglet.', button.disabled ? 'working' : 'error');
    }, 15000);
  }, true);
})();

// Redéploiement Preview demandé après correction de RESEND_API_KEY et RESEND_FROM_EMAIL.