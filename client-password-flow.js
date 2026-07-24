(() => {
  if (window.__edmPasswordFlow) return;
  window.__edmPasswordFlow = true;

  const MIN_PASSWORD_LENGTH = 8;
  const MAX_PASSWORD_LENGTH = 72;
  const RECOVERY_STORAGE_KEY = 'edm28_password_recovery_email';
  const $ = (id) => document.getElementById(id);

  let verificationMode = null;
  let verificationEmail = '';
  let resendTimer = null;

  const waitForApp = async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (
        typeof supabaseClient !== 'undefined' &&
        typeof hydrateUserFromSupabase === 'function' &&
        typeof getClient === 'function' &&
        $('clientCard')
      ) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const passwordValue = (id = 'password') => $(id)?.value || '';

  const friendly = (error) => {
    const message = String(error?.message || error || '');
    const text = message.toLowerCase();
    if (text.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (text.includes('email not confirmed')) return 'Vérifiez votre adresse email avant de vous connecter.';
    if (text.includes('user already registered')) return 'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié / à définir ».';
    if (text.includes('password should be') || text.includes('weak password')) return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    if (text.includes('same password')) return 'Choisissez un mot de passe différent de l’ancien.';
    if (text.includes('rate limit') || text.includes('security purposes')) return 'Trop de tentatives. Attendez une minute avant de recommencer.';
    if (text.includes('expired') || text.includes('invalid token') || text.includes('token has expired')) return 'Code incorrect ou expiré. Demandez un nouveau code.';
    return message || 'Une erreur est survenue.';
  };

  const setMessage = (message, error = false) => setAuthStatus(message, error);

  function validatePassword(password, confirmation) {
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setMessage(`Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`, true);
      return false;
    }
    if (confirmation !== undefined && password !== confirmation) {
      setMessage('Les deux mots de passe ne correspondent pas.', true);
      return false;
    }
    return true;
  }

  function ensurePasswordFields() {
    const grid = $('clientCard')?.querySelector('.grid');
    if (!grid) return;

    let input = $('password');
    let label = input?.closest('label');
    if (!input || !label) {
      label = document.createElement('label');
      label.innerHTML = 'Mot de passe <input id="password" type="password">';
      grid.appendChild(label);
      input = $('password');
    }

    label.id = 'passwordLabel';
    label.firstChild.textContent = 'Mot de passe ';
    input.type = 'password';
    input.minLength = MIN_PASSWORD_LENGTH;
    input.maxLength = MAX_PASSWORD_LENGTH;
    input.autocomplete = 'current-password';
    input.placeholder = `${MIN_PASSWORD_LENGTH} caractères minimum`;

    if (!$('passwordConfirm')) {
      label.insertAdjacentHTML('afterend', `
        <label id="passwordConfirmLabel">Confirmer le mot de passe
          <input id="passwordConfirm" type="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" autocomplete="new-password" placeholder="Uniquement pour créer le compte">
        </label>`);
    }

    if (!$('passwordAuthHint')) {
      grid.insertAdjacentHTML('afterend', `
        <div id="passwordAuthHint" class="small" style="margin-top:10px">
          L’adresse email est vérifiée une seule fois à la création. Les connexions suivantes utilisent l’email et le mot de passe.
        </div>`);
    }
  }

  function installControls() {
    const row = $('clientCard')?.querySelector('.btn-row');
    if (!row) return;

    $('otpPanel')?.remove();
    $('passwordVerificationPanel')?.remove();
    $('passwordRecoveryPanel')?.remove();

    row.replaceChildren();
    row.insertAdjacentHTML('beforeend', `
      <button class="btn btn-primary" id="btnSignUp" type="button">Créer mon compte</button>
      <button class="btn btn-secondary" id="btnSignIn" type="button">Se connecter</button>
      <button class="btn btn-ghost" id="btnPasswordReset" type="button">Mot de passe oublié / à définir</button>
      <button class="btn btn-ghost hidden" id="btnSignOut" type="button">Se déconnecter</button>`);

    row.insertAdjacentHTML('afterend', `
      <div id="passwordVerificationPanel" class="card hidden" style="margin-top:14px">
        <h3>Vérification de l’adresse email</h3>
        <p id="passwordVerificationText">Entrez le code reçu par email.</p>
        <label>Code reçu
          <input id="passwordVerificationCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="12345678">
        </label>
        <div class="btn-row">
          <button class="btn btn-success" id="btnPasswordVerify" type="button">Valider le code</button>
          <button class="btn btn-ghost" id="btnPasswordResend" type="button">Renvoyer le code</button>
        </div>
      </div>
      <div id="passwordRecoveryPanel" class="card hidden" style="margin-top:14px">
        <h3>Définir un nouveau mot de passe</h3>
        <label>Nouveau mot de passe
          <input id="passwordRecoveryNew" type="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" autocomplete="new-password" placeholder="${MIN_PASSWORD_LENGTH} caractères minimum">
        </label>
        <label style="margin-top:10px">Confirmer le nouveau mot de passe
          <input id="passwordRecoveryConfirm" type="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" autocomplete="new-password">
        </label>
        <button class="btn btn-success" id="btnPasswordRecoverySave" type="button" style="margin-top:12px;width:100%">Enregistrer le nouveau mot de passe</button>
      </div>`);
  }

  function setConnectedUi(connected) {
    $('btnSignUp')?.classList.toggle('hidden', connected);
    $('btnSignIn')?.classList.toggle('hidden', connected);
    $('btnPasswordReset')?.classList.toggle('hidden', connected);
    $('btnSignOut')?.classList.toggle('hidden', !connected);
    $('passwordLabel')?.classList.toggle('hidden', connected);
    $('passwordConfirmLabel')?.classList.toggle('hidden', connected);
    $('passwordAuthHint')?.classList.toggle('hidden', connected);

    if (connected) {
      $('passwordVerificationPanel')?.classList.add('hidden');
      if ($('password')) $('password').value = '';
      if ($('passwordConfirm')) $('passwordConfirm').value = '';
    }
  }

  function startResendCountdown() {
    clearInterval(resendTimer);
    const button = $('btnPasswordResend');
    if (!button) return;
    button.disabled = true;
    let seconds = 60;
    button.textContent = `Renvoyer dans ${seconds}s`;
    resendTimer = setInterval(() => {
      seconds -= 1;
      button.textContent = seconds > 0 ? `Renvoyer dans ${seconds}s` : 'Renvoyer le code';
      if (seconds <= 0) {
        clearInterval(resendTimer);
        button.disabled = false;
      }
    }, 1000);
  }

  function showVerificationPanel(email, mode, message) {
    verificationEmail = normalizeEmail(email);
    verificationMode = mode;
    const panel = $('passwordVerificationPanel');
    if (!panel) return;
    $('passwordVerificationText').textContent = message;
    panel.classList.remove('hidden');
    $('passwordRecoveryPanel')?.classList.add('hidden');
    $('passwordVerificationCode').value = '';
    $('passwordVerificationCode').focus();
    startResendCountdown();
  }

  function openRecoveryPanel() {
    $('passwordVerificationPanel')?.classList.add('hidden');
    $('passwordRecoveryPanel')?.classList.remove('hidden');
    $('passwordRecoveryNew')?.focus();
  }

  async function finishAuthentication(user, message) {
    if (!user) throw new Error('Session introuvable après authentification.');
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    await hydrateUserFromSupabase(user);
    setConnectedUi(true);
    setMessage(message);
    if (typeof updateStepper === 'function') updateStepper(2);
    $('vehicleCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function createAccount() {
    const client = getClient();
    const email = normalizeEmail(client.email);
    const password = passwordValue('password');
    const confirmation = passwordValue('passwordConfirm');

    if (!client.firstName || !client.lastName || !client.phone || !email) {
      return setMessage('Complétez prénom, nom, téléphone et email.', true);
    }
    if (!validatePassword(password, confirmation)) return;

    const button = $('btnSignUp');
    setButtonBusy(button, true, 'Création...');
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: client.firstName,
            last_name: client.lastName,
            phone: client.phone
          }
        }
      });
      if (error) throw error;

      if (data?.session?.user) {
        await finishAuthentication(data.session.user, 'Compte créé et connecté.');
        return;
      }

      showVerificationPanel(
        email,
        'signup',
        `Un email de confirmation a été envoyé à ${email}. Cliquez sur le lien reçu ou saisissez le code affiché dans l’email.`
      );
      setMessage('Compte créé. Vérifiez votre adresse email une seule fois pour l’activer.');
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function signIn() {
    const email = normalizeEmail($('email')?.value);
    const password = passwordValue('password');
    if (!email || !password) return setMessage('Email et mot de passe obligatoires.', true);

    const button = $('btnSignIn');
    setButtonBusy(button, true, 'Connexion...');
    try {
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finishAuthentication(data?.user || data?.session?.user, 'Connexion réussie.');
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function sendRecoveryCode() {
    const email = normalizeEmail($('email')?.value);
    if (!email) return setMessage('Entrez votre adresse email.', true);

    const button = $('btnPasswordReset');
    setButtonBusy(button, true, 'Envoi...');
    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, email);
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      showVerificationPanel(
        email,
        'recovery',
        `Un email de sécurité a été envoyé à ${email}. Cliquez sur le lien reçu ou saisissez le code pour définir un nouveau mot de passe.`
      );
      setMessage('Email de récupération envoyé.');
    } catch (error) {
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function resendVerificationCode() {
    if (!verificationEmail || !verificationMode) return;

    const button = $('btnPasswordResend');
    setButtonBusy(button, true, 'Envoi...');
    try {
      if (verificationMode === 'signup') {
        const { error } = await supabaseClient.auth.resend({
          type: 'signup',
          email: verificationEmail
        });
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: verificationEmail,
          options: { shouldCreateUser: false }
        });
        if (error) throw error;
      }
      setMessage('Un nouvel email vient d’être envoyé.');
      startResendCountdown();
    } catch (error) {
      setMessage(friendly(error), true);
      setButtonBusy(button, false);
    }
  }

  async function verifyOtpWithCompatibleType(email, token, mode) {
    const types = mode === 'signup' ? ['email', 'signup'] : ['email', 'recovery'];
    let lastError = null;

    for (const type of types) {
      const result = await supabaseClient.auth.verifyOtp({ email, token, type });
      if (!result.error) return result.data;
      lastError = result.error;
    }

    throw lastError || new Error('Code incorrect ou expiré.');
  }

  async function verifyEmailCode() {
    const token = $('passwordVerificationCode')?.value.replace(/\D/g, '').slice(0, 10) || '';
    if (!verificationEmail || token.length < 6 || token.length > 10) {
      return setMessage('Entrez le code reçu par email.', true);
    }

    const button = $('btnPasswordVerify');
    setButtonBusy(button, true, 'Vérification...');
    try {
      const data = await verifyOtpWithCompatibleType(verificationEmail, token, verificationMode);
      if (!data?.user) throw new Error('Session introuvable après validation.');

      await hydrateUserFromSupabase(data.user);
      $('passwordVerificationPanel')?.classList.add('hidden');

      if (verificationMode === 'recovery') {
        openRecoveryPanel();
        setMessage('Email vérifié. Définissez maintenant votre nouveau mot de passe.');
      } else {
        await finishAuthentication(data.user, 'Adresse email vérifiée. Le compte est maintenant actif.');
      }
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function saveRecoveredPassword() {
    const password = passwordValue('passwordRecoveryNew');
    const confirmation = passwordValue('passwordRecoveryConfirm');
    if (!validatePassword(password, confirmation)) return;

    const button = $('btnPasswordRecoverySave');
    setButtonBusy(button, true, 'Enregistrement...');
    try {
      const { data, error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      $('passwordRecoveryPanel')?.classList.add('hidden');
      if ($('passwordRecoveryNew')) $('passwordRecoveryNew').value = '';
      if ($('passwordRecoveryConfirm')) $('passwordRecoveryConfirm').value = '';
      await finishAuthentication(data?.user, 'Nouveau mot de passe enregistré. Les prochaines connexions se feront sans code.');
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function signOut() {
    const button = $('btnSignOut');
    setButtonBusy(button, true, 'Déconnexion...');
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      if (typeof state !== 'undefined') {
        state.user = null;
        if (typeof saveState === 'function') saveState();
      }
      setConnectedUi(false);
      setMessage('Déconnecté.');
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  function installListeners() {
    $('btnSignUp').addEventListener('click', createAccount);
    $('btnSignIn').addEventListener('click', signIn);
    $('btnPasswordReset').addEventListener('click', sendRecoveryCode);
    $('btnSignOut').addEventListener('click', signOut);
    $('btnPasswordVerify').addEventListener('click', verifyEmailCode);
    $('btnPasswordResend').addEventListener('click', resendVerificationCode);
    $('btnPasswordRecoverySave').addEventListener('click', saveRecoveredPassword);

    $('passwordVerificationCode').addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
    });
    $('passwordVerificationCode').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void verifyEmailCode();
    });
    $('password').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void signIn();
    });
  }

  async function install() {
    if (!(await waitForApp())) throw new Error('Application non initialisée.');

    ensurePasswordFields();
    installControls();
    installListeners();

    supabaseClient.auth.onAuthStateChange((event, session) => {
      const recoveryPending = Boolean(localStorage.getItem(RECOVERY_STORAGE_KEY));
      if (session?.user) {
        void hydrateUserFromSupabase(session.user).then(() => {
          setConnectedUi(true);
          if (event === 'PASSWORD_RECOVERY' || recoveryPending) {
            openRecoveryPanel();
            setMessage('Session de récupération active. Définissez votre nouveau mot de passe.');
          }
        });
      } else if (event === 'SIGNED_OUT') {
        setConnectedUi(false);
      }
    });

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      await hydrateUserFromSupabase(data.session.user);
      setConnectedUi(true);
      if (localStorage.getItem(RECOVERY_STORAGE_KEY)) {
        openRecoveryPanel();
        setMessage('Session de récupération active. Définissez votre nouveau mot de passe.');
      } else {
        setMessage('Session active.');
      }
    } else {
      setConnectedUi(false);
      setMessage('Connectez-vous avec votre email et votre mot de passe.');
    }

    window.__edmPasswordAuthReady = true;
  }

  install().catch((error) => {
    console.error('EDM password flow:', error);
    setMessage(friendly(error), true);
  });
})();
