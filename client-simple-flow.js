(() => {
  const $ = (id) => document.getElementById(id);
  const MODE_KEY = 'edm28_auth_mode';
  let mode = localStorage.getItem(MODE_KEY) === 'login' ? 'login' : 'signup';

  const wait = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof getClient === 'function' && $('clientCard')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const status = (text, error = false) => setAuthStatus(text, error);
  const friendly = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    if (message.includes('rate limit')) return 'Un email a déjà été envoyé. Utilisez le dernier reçu, sans redemander un nouveau lien.';
    if (message.includes('invalid login')) return 'Email ou mot de passe incorrect.';
    if (message.includes('email not confirmed')) return 'Le compte existe, mais l’email doit encore être confirmé.';
    if (message.includes('already')) return 'Ce compte existe déjà. Utilisez la connexion.';
    return error?.message || 'Une erreur est survenue.';
  };

  const goVehicle = () => {
    showPage('appointment');
    updateStepper(2);
    $('vehicleCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const render = () => {
    const connected = Boolean(state?.user?.id);
    ['account', 'garage', 'history'].forEach((page) => {
      document.querySelectorAll(`[data-page="${page}"]`).forEach((button) => button.classList.toggle('hidden', !connected));
    });

    const grid = $('clientCard')?.querySelector('.grid');
    const contactIds = ['firstName', 'lastName', 'phone'];
    if (connected) {
      grid?.classList.add('hidden');
      contactIds.forEach((id) => $(id)?.closest('label')?.classList.remove('hidden'));
      $('btnAccountContinue').textContent = 'Continuer vers mon véhicule';
      $('btnAuthMode').classList.add('hidden');
      $('btnSimpleSignOut').classList.remove('hidden');
      status(`Connecté : ${state.user.email || 'compte client'}.`);
      return;
    }

    grid?.classList.remove('hidden');
    const login = mode === 'login';
    contactIds.forEach((id) => $(id)?.closest('label')?.classList.toggle('hidden', login));
    $('clientCard').querySelector('h3').textContent = login ? 'Connexion' : 'Vos coordonnées';
    $('clientCard').querySelector('.section-title p').textContent = login
      ? 'Entrez votre email et votre mot de passe.'
      : 'Renseignez vos informations une seule fois. Votre espace client sera créé automatiquement.';
    $('btnAccountContinue').textContent = login ? 'Me connecter et continuer' : 'Continuer';
    $('btnAuthMode').textContent = login ? 'Je crée un compte' : 'J’ai déjà un compte';
    $('btnAuthMode').classList.remove('hidden');
    $('btnSimpleSignOut').classList.add('hidden');
  };

  const submitAuth = async () => {
    if (state?.user?.id) return goVehicle();
    const client = getClient();
    const password = getPassword();
    if (!client.email) return status('Entrez votre adresse email.', true);
    if (!password || password.length < 6) return status('Le mot de passe doit contenir au moins 6 caractères.', true);
    if (mode === 'signup' && (!client.firstName || !client.lastName || !client.phone)) return status('Complétez prénom, nom et téléphone.', true);

    const button = $('btnAccountContinue');
    setButtonBusy(button, true, 'Vérification...');
    try {
      if (mode === 'login') {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: client.email, password });
        if (error) throw error;
        await hydrateUserFromSupabase(data.user);
        render();
        goVehicle();
        return;
      }

      const redirect = new URL('/', window.location.origin);
      redirect.searchParams.set('confirmed', '1');
      redirect.hash = 'appointment';
      const { data, error } = await supabaseClient.auth.signUp({
        email: client.email,
        password,
        options: {
          emailRedirectTo: redirect.toString(),
          data: { first_name: client.firstName, last_name: client.lastName, phone: client.phone }
        }
      });
      if (error) throw error;
      if (data?.session?.user) {
        await hydrateUserFromSupabase(data.session.user);
        render();
        goVehicle();
      } else {
        status(`Compte créé. Ouvrez l’email envoyé à ${client.email}, cliquez une seule fois sur le lien, puis revenez ici.`);
      }
    } catch (error) {
      status(friendly(error), true);
    } finally {
      setButtonBusy(button, false);
    }
  };

  const install = async () => {
    if (!(await wait()) || window.__edmSimpleFlow) return;
    window.__edmSimpleFlow = true;

    const row = $('clientCard').querySelector('.btn-row');
    row.innerHTML = `
      <button class="btn btn-primary" id="btnAccountContinue" type="button">Continuer</button>
      <button class="btn btn-secondary" id="btnAuthMode" type="button">J’ai déjà un compte</button>
      <button class="btn btn-ghost hidden" id="btnSimpleSignOut" type="button">Se déconnecter</button>`;

    $('btnAccountContinue').addEventListener('click', submitAuth);
    $('btnAuthMode').addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      localStorage.setItem(MODE_KEY, mode);
      status('');
      render();
    });
    $('btnSimpleSignOut').addEventListener('click', async () => {
      await signOutFromSupabase();
      mode = 'login';
      localStorage.setItem(MODE_KEY, mode);
      render();
    });

    $('btnSaveVehicle')?.classList.add('hidden');
    if ($('btnAccessServices')) $('btnAccessServices').textContent = 'Continuer vers les services';
    const intro = $('appointment')?.querySelector('.panel > .section-title p');
    if (intro) intro.textContent = 'Vos coordonnées, votre véhicule, votre besoin, puis l’envoi.';
    ['1 · Vos coordonnées', '2 · Votre véhicule', '3 · Votre besoin', '4 · Envoyer'].forEach((label, index) => {
      const step = document.querySelectorAll('#stepper .step')[index];
      if (step) step.textContent = label;
    });

    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.user) await hydrateUserFromSupabase(data.session.user);
    render();
    supabaseClient.auth.onAuthStateChange(() => setTimeout(render, 0));

    const confirmed = new URLSearchParams(location.search).get('confirmed') === '1' || location.hash.includes('access_token');
    if (confirmed) {
      showPage('appointment');
      setTimeout(() => {
        if (state?.user?.id) {
          status('Email confirmé. Votre espace client est prêt.');
          render();
          goVehicle();
        } else {
          mode = 'login';
          localStorage.setItem(MODE_KEY, mode);
          status('Email confirmé. Connectez-vous pour continuer.');
          render();
        }
      }, 800);
    }
  };

  install().catch((error) => console.error('EDM simple flow:', error));
})();
