(() => {
  const byId = (id) => document.getElementById(id);

  function normalizeError(error) {
    if (!error) return 'Une erreur inconnue est survenue.';
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    if (typeof error.error_description === 'string' && error.error_description.trim()) return error.error_description.trim();
    if (typeof error.error === 'string' && error.error.trim()) return error.error.trim();
    try {
      const value = JSON.stringify(error);
      return value && value !== '{}' ? value : 'Une erreur inconnue est survenue.';
    } catch (_) {
      return 'Une erreur inconnue est survenue.';
    }
  }

  function show(message, isError = true) {
    const box = byId('authStatus');
    if (!box) return;
    const safe = typeof escapeHtml === 'function' ? escapeHtml(message) : String(message);
    box.innerHTML = `<span style="color:${isError ? 'var(--red)' : 'var(--green)'};font-weight:900">${safe}</span>`;
  }

  window.addEventListener('unhandledrejection', (event) => {
    const message = normalizeError(event.reason);
    if (byId('authStatus')) show(message, true);
  });

  window.addEventListener('error', (event) => {
    if (!event?.error || !byId('authStatus')) return;
    show(normalizeError(event.error), true);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const password = byId('password');
    if (password) password.setAttribute('autocomplete', 'new-password');

    const signup = byId('btnSignUp');
    if (!signup) return;

    signup.addEventListener('click', () => {
      const box = byId('authStatus');
      if (box) box.textContent = 'Création du compte en cours…';
    }, { capture: true });
  });
})();
