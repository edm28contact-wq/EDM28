(() => {
  const $ = (id) => document.getElementById(id);
  const waitForApp = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof hydrateUserFromSupabase === 'function' && $('clientCard')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const friendly = (error) => {
    const text = String(error?.message || error || '').toLowerCase();
    if (text.includes('rate limit')) return 'Un code vient déjà d’être envoyé. Attendez une minute avant de recommencer.';
    if (text.includes('expired') || text.includes('invalid')) return 'Code incorrect ou expiré. Demandez un nouveau code.';
    return error?.message || 'Une erreur est survenue.';
  };

  const setMessage = (message, error = false) => setAuthStatus(message, error);

  async function sendCode() {
    const client = getClient();
    if (!client.email) return setMessage('Entrez votre adresse email.', true);
    if (!client.firstName || !client.lastName || !client.phone) return setMessage('Complétez prénom, nom et téléphone.', true);

    const button = $('btnOtpSend');
    setButtonBusy(button, true, 'Envoi...');
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: client.email,
        options: {
          shouldCreateUser: true,
          data: {
            first_name: client.firstName,
            last_name: client.lastName,
            phone: client.phone
          }
        }
      });
      if (error) throw error;
      $('otpEmail').value = client.email;
      $('otpPanel').classList.remove('hidden');
      $('otpCode').focus();
      setMessage(`Code envoyé à ${client.email}. Saisissez les 6 chiffres reçus.`);
      button.disabled = true;
      let seconds = 60;
      const timer = setInterval(() => {
        seconds -= 1;
        button.textContent = seconds > 0 ? `Renvoyer dans ${seconds}s` : 'Renvoyer le code';
        if (seconds <= 0) {
          clearInterval(timer);
          button.disabled = false;
        }
      }, 1000);
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      if (!button.disabled) setButtonBusy(button, false);
    }
  }

  async function verifyCode() {
    const email = $('otpEmail').value.trim().toLowerCase();
    const token = $('otpCode').value.replace(/\D/g, '').slice(0, 6);
    if (!email || token.length !== 6) return setMessage('Entrez le code à 6 chiffres.', true);

    const button = $('btnOtpVerify');
    setButtonBusy(button, true, 'Vérification...');
    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
      if (!data?.user) throw new Error('Session introuvable après validation.');
      await hydrateUserFromSupabase(data.user);
      $('btnOtpSend').classList.add('hidden');
      $('btnOtpSignOut').classList.remove('hidden');
      setMessage('Adresse email vérifiée. Votre espace client est prêt.');
      showPage('appointment');
      updateStepper(2);
      $('vehicleCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setMessage(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) return setMessage(friendly(error), true);
    state.user = null;
    saveState();
    $('btnOtpSend').classList.remove('hidden');
    $('btnOtpSignOut').classList.add('hidden');
    $('otpPanel').classList.add('hidden');
    $('otpCode').value = '';
    setMessage('Déconnecté.');
  }

  function removeLegacyPasswordUi() {
    $('password')?.closest('label')?.remove();
    ['btnSignUp', 'btnSignIn', 'btnSignOut', 'btnSaveAccount', 'btnGuest'].forEach((id) => $(id)?.remove());
    window.signUpWithSupabase = undefined;
    window.signInWithSupabase = undefined;
    window.saveAccount = undefined;
  }

  async function install() {
    if (!(await waitForApp()) || window.__edmOtpFlow) return;
    window.__edmOtpFlow = true;
    removeLegacyPasswordUi();

    const row = $('clientCard').querySelector('.btn-row');
    row.replaceChildren();
    row.insertAdjacentHTML('beforeend', `
      <button class="btn btn-primary" id="btnOtpSend" type="button">Recevoir mon code</button>
      <button class="btn btn-ghost hidden" id="btnOtpSignOut" type="button">Se déconnecter</button>`);
    row.insertAdjacentHTML('afterend', `
      <div id="otpPanel" class="card hidden" style="margin-top:14px">
        <h3>Code de vérification</h3>
        <p>Entrez le code à 6 chiffres reçu par email.</p>
        <input id="otpEmail" type="email" class="hidden" autocomplete="email">
        <label>Code reçu
          <input id="otpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">
        </label>
        <button class="btn btn-success" id="btnOtpVerify" type="button" style="margin-top:12px;width:100%">Valider et continuer</button>
      </div>`);

    $('btnOtpSend').addEventListener('click', sendCode);
    $('btnOtpVerify').addEventListener('click', verifyCode);
    $('btnOtpSignOut').addEventListener('click', signOut);
    $('otpCode').addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
    });
    $('otpCode').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') verifyCode();
    });

    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.user) {
      await hydrateUserFromSupabase(data.session.user);
      $('btnOtpSend').classList.add('hidden');
      $('btnOtpSignOut').classList.remove('hidden');
      setMessage('Session active.');
    } else {
      setMessage('Connexion sécurisée par code email. Aucun mot de passe requis.');
    }
  }

  install().catch((error) => console.error('EDM OTP flow:', error));
})();
