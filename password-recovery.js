// This runs before the existing clients can consume an email recovery callback.
export function recoveryBridge() {
  const current = new URL(window.location.href);
  const hash = new URLSearchParams(current.hash.slice(1));
  const type = hash.get('type') || current.searchParams.get('type');
  if (type === 'recovery') {
    const target = new URL('/reinitialiser-mot-de-passe', current.origin);
    for (const key of ['type', 'token_hash', 'code', 'error', 'error_code']) {
      if (current.searchParams.has(key)) target.searchParams.set(key, current.searchParams.get(key));
    }
    target.hash = current.hash;
    // Prevent an existing client from consuming the same tokens during navigation.
    window.history.replaceState(null, '', current.pathname);
    window.location.replace(target.href);
    return;
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#adminResetPasswordBtn, [data-auth-reset], #btnPasswordReset');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const admin = button.id === 'adminResetPasswordBtn';
    window.location.assign('/mot-de-passe-oublie' + (admin ? '?espace=admin' : ''));
  }, true);
}

export function injectRecoveryBridge(html) {
  if (typeof html !== 'string' || !html.includes('<head>') || html.includes('id="edm-recovery-bridge"')) return html;
  return html.replace('<head>', `<head><meta charset="utf-8"><script id="edm-recovery-bridge">(${recoveryBridge.toString()})();</script>`);
}

// The recovery client is isolated from existing client/admin sessions.
export async function recoveryBoot(config) {
  const $ = (id) => document.getElementById(id);
  const incoming = new URL(window.location.href);
  const hash = new URLSearchParams(incoming.hash.slice(1));
  const type = hash.get('type') || incoming.searchParams.get('type');
  const admin = config.mode === 'admin' || incoming.searchParams.get('espace') === 'admin';
  const requestMode = config.mode === 'request';
  const adminEmail = 'admin@edm28.fr';
  let recoveryUser = null;
  let updating = false;
  let sending = false;
  const status = (message, error = false) => {
    $('recoveryStatus').textContent = message;
    $('recoveryStatus').className = error ? 'status error' : 'status';
  };
  const invalidLink = () => {
    recoveryUser = null;
    $('savePassword').disabled = true;
    $('newPassword').disabled = true;
    $('confirmPassword').disabled = true;
    status('Lien absent, invalide ou expir\u00e9. Demandez un nouveau lien de r\u00e9initialisation.', true);
  };
  const returnTo = (email) => email === adminEmail ? '/admin' : '/mes-interventions';
  $('recoverySpace').textContent = admin ? 'Compte administrateur' : 'Compte EDM28';
  $('requestPanel').hidden = !requestMode;
  $('passwordPanel').hidden = requestMode;
  $('newLink').href = '/mot-de-passe-oublie' + (admin ? '?espace=admin' : '');
  $('backToLogin').href = admin ? '/admin' : '/mes-interventions';
  if (admin) {
    $('recoveryEmail').value = adminEmail;
    $('recoveryEmail').readOnly = true;
  }
  // Remove credentials before loading a session. They remain only in this closure.
  window.history.replaceState(null, '', incoming.pathname + (admin ? '?espace=admin' : ''));
  if (!window.supabase?.createClient) {
    status('Service de connexion indisponible. Rechargez la page pour r\u00e9essayer.', true);
    return;
  }
  const client = window.supabase.createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' }
  });
  $('sendRecovery').disabled = false;
  $('requestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    const email = (admin ? adminEmail : $('recoveryEmail').value).trim().toLowerCase();
    if (!email || !$('recoveryEmail').checkValidity()) {
      status('Renseignez une adresse email valide.', true);
      return;
    }
    sending = true;
    $('sendRecovery').disabled = true;
    status('Envoi du lien de r\u00e9initialisation...');
    try {
      const destination = email === adminEmail ? '/admin-reset' : '/reinitialiser-mot-de-passe';
      const redirectTo = new URL(destination, window.location.origin).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      status('Si un compte correspond \u00e0 cette adresse, un email de r\u00e9initialisation a \u00e9t\u00e9 envoy\u00e9. Ouvrez le dernier email re\u00e7u et v\u00e9rifiez aussi les ind\u00e9sirables.');
    } catch (error) {
      status(error?.status === 429
        ? 'Trop de demandes rapproch\u00e9es. Patientez avant de demander un nouveau lien.'
        : 'Envoi impossible pour le moment. R\u00e9essayez plus tard.', true);
    } finally {
      sending = false;
      $('sendRecovery').disabled = false;
    }
  });
  $('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (updating || !recoveryUser) return;
    const password = $('newPassword').value;
    if (password.length < 8) return status('Le mot de passe doit contenir au moins 8 caract\u00e8res.', true);
    if (password !== $('confirmPassword').value) return status('Les deux mots de passe ne correspondent pas.', true);
    updating = true;
    $('savePassword').disabled = true;
    status('Enregistrement du nouveau mot de passe...');
    try {
      const verified = await client.auth.getUser();
      if (verified.error || verified.data?.user?.id !== recoveryUser.id) return invalidLink();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      const destination = returnTo(String(recoveryUser.email || '').toLowerCase());
      recoveryUser = null;
      $('newPassword').value = '';
      $('confirmPassword').value = '';
      $('newPassword').disabled = true;
      $('confirmPassword').disabled = true;
      $('passwordForm').hidden = true;
      $('loginAfterReset').href = destination;
      $('loginAfterReset').hidden = false;
      status('Mot de passe enregistr\u00e9. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.');
      // Password success is not undone by a temporary sign-out failure.
      try { await client.auth.signOut({ scope: 'local' }); } catch (_) {}
    } catch (error) {
      if (error?.status === 401 || error?.code === 'session_not_found') invalidLink();
      else if (error?.code === 'same_password') status('Choisissez un mot de passe diff\u00e9rent de l\u2019ancien.', true);
      else if (error?.code === 'weak_password') status('Ce mot de passe est trop faible. Choisissez un mot de passe plus long et unique.', true);
      else status('Modification impossible pour le moment. R\u00e9essayez sans fermer cette page.', true);
    } finally {
      updating = false;
      $('savePassword').disabled = !recoveryUser;
    }
  });
  if (requestMode) {
    status('Renseignez l\u2019adresse email du compte pour recevoir un lien s\u00e9curis\u00e9.');
    return;
  }
  status('V\u00e9rification du lien de r\u00e9initialisation...');
  try {
    if (type !== 'recovery' || hash.has('error') || incoming.searchParams.has('error')) return invalidLink();
    const tokenHash = incoming.searchParams.get('token_hash');
    let result;
    if (tokenHash) {
      result = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    } else if (hash.get('access_token') && hash.get('refresh_token')) {
      result = await client.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
    } else {
      return invalidLink();
    }
    if (result.error || !result.data?.session) return invalidLink();
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data?.user?.id) return invalidLink();
    if (admin && String(verified.data.user.email || '').toLowerCase() !== adminEmail) return invalidLink();
    recoveryUser = verified.data.user;
    $('recoveryAccount').textContent = 'Compte : ' + (recoveryUser.email || 'EDM28');
    $('newPassword').disabled = false;
    $('confirmPassword').disabled = false;
    $('savePassword').disabled = false;
    status('Lien valide. Choisissez et confirmez votre nouveau mot de passe.');
    $('newPassword').focus();
  } catch (_) {
    invalidLink();
  }
}

function publicKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch (_) { return false; }
}

export function serveRecoveryPage(req, res, config) {
  const query = new URL(req.url || '/', 'http://localhost').searchParams;
  const mode = req.query?.authRecovery || query.get('authRecovery');
  if (!['request', 'reset', 'admin'].includes(mode)) return false;
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end();
    return true;
  }
  if (!config?.url || !publicKey(config?.key)) {
    res.status(503).send('Configuration de connexion indisponible.');
    return true;
  }
  const payload = JSON.stringify({ url: config.url, key: config.key, mode }).replaceAll('<', '\\u003c');
  const title = mode === 'request' ? 'Mot de passe oubli\u00e9' : 'R\u00e9initialiser le mot de passe';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${title} | EDM28</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f4f2ef;color:#18212f;font:17px/1.6 system-ui,sans-serif}main{width:min(100% - 32px,540px);margin:7vh auto;padding:28px;background:white;border:1px solid #d9d5cf;border-radius:20px}h1{font-size:1.65rem;line-height:1.2}label{display:block;margin:16px 0}input,button{font:inherit;width:100%;padding:12px;border:1px solid #aeb3bb;border-radius:8px}input{margin-top:5px}button,.action{background:#18212f;color:white;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.action{display:block;text-align:center;padding:12px;border-radius:8px;text-decoration:none}.status{margin:18px 0;padding:12px;background:#f1f4f7;overflow-wrap:anywhere}.error{background:#fff0ed;color:#8a2517}a{color:#253f66}small{display:block}.brand{font-weight:800;letter-spacing:.1em}[hidden]{display:none!important}:focus-visible{outline:3px solid #396ab1;outline-offset:3px}
  </style></head><body><main><div class="brand">EDM28</div><p id="recoverySpace">Compte EDM28</p><h1>${title}</h1>
  <section id="requestPanel" ${mode === 'request' ? '' : 'hidden'}><p>Recevez un lien par email pour choisir un nouveau mot de passe.</p><form id="requestForm"><label>Adresse email<input id="recoveryEmail" type="email" autocomplete="email" required></label><button id="sendRecovery" type="submit" disabled>Recevoir le lien de r\u00e9initialisation</button></form></section>
  <section id="passwordPanel" ${mode === 'request' ? 'hidden' : ''}><p id="recoveryAccount"></p><form id="passwordForm"><label>Nouveau mot de passe<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required disabled></label><label>Confirmer le mot de passe<input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" required disabled></label><small>Au moins 8 caract\u00e8res. Utilisez un mot de passe unique.</small><button id="savePassword" type="submit" disabled>Enregistrer le nouveau mot de passe</button></form><a id="loginAfterReset" class="action" href="/mes-interventions" hidden>Se connecter avec le nouveau mot de passe</a><p><a id="newLink" href="/mot-de-passe-oublie">Recevoir un nouveau lien</a></p></section>
  <p id="recoveryStatus" class="status" role="status" aria-live="polite">Chargement du service de connexion...</p><p><a id="backToLogin" href="/mes-interventions">Retour \u00e0 la connexion</a></p><noscript>Activez JavaScript pour utiliser la r\u00e9initialisation s\u00e9curis\u00e9e.</noscript></main>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0"></script><script>(${recoveryBoot.toString()})(${payload}).catch(function(){document.getElementById('recoveryStatus').textContent='Service indisponible. Rechargez la page.';});</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-EDM-Recovery', 'admin-client-v1');
  if (req.method === 'HEAD') res.status(200).end();
  else res.status(200).send(html);
  return true;
}
