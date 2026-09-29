(() => {
  if (window.__edmPublicClientInstalled) return;
  window.__edmPublicClientInstalled = true;

  const config = window.EDM_PUBLIC_SUPABASE || {};
  if (!window.supabase?.createClient || !config.url || !config.key) return;
  const client = window.supabase.createClient(config.url, config.key);

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const money = (value) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}) : '—';
  };
  const dateTime = (value) => {
    const d = new Date(value || 0);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});
  };
  const SIV_RE = /^([A-HJ-NP-TV-Z]{2})(\d{3})([A-HJ-NP-TV-Z]{2})$/;
  const FNI_RE = /^(\d{1,4})([A-Z]{1,3})([A-Z0-9]{2,3})$/;
  const SERVICE_COVERAGE = {
    'plaquettes-frein-avant': ['front_pads'],
    'plaquettes-frein-arriere': ['rear_pads'],
    'plaquettes-avant-arriere': ['front_pads','rear_pads'],
    'disques-plaquettes-avant': ['front_discs','front_pads'],
    'disques-plaquettes-arriere': ['rear_discs','rear_pads'],
    'freinage-complet': ['front_discs','front_pads','rear_discs','rear_pads']
  };

  function parseFrenchPlate(value) {
    const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
    let match = compact.match(SIV_RE);
    if (match && match[1] !== 'SS' && match[3] !== 'SS') {
      return { valid:true, format:'SIV', normalized:compact, display:`${match[1]}-${match[2]}-${match[3]}` };
    }
    match = compact.match(FNI_RE);
    if (match) {
      return { valid:true, format:'FNI', normalized:compact, display:`${match[1]} ${match[2]} ${match[3]}` };
    }
    return { valid:false, format:null, normalized:compact, display:String(value || '').trim().toUpperCase() };
  }

  function serviceCoverage(service) {
    const slug = String(service?.slug || '').trim().toLowerCase();
    return SERVICE_COVERAGE[slug] || [];
  }

  function servicesOverlap(a,b) {
    const coverageA = serviceCoverage(a);
    const coverageB = new Set(serviceCoverage(b));
    return coverageA.some((token) => coverageB.has(token));
  }

  const intOrNull = (value) => {
    const n = Number.parseInt(String(value || '').replace(/\D/g,''),10);
    return Number.isFinite(n) ? n : null;
  };
  const byId = (id) => document.getElementById(id);

  function message(hostId, text, type='notice') {
    const host = byId(hostId);
    if (host) host.innerHTML = text ? `<div class="${type}">${esc(text)}</div>` : '';
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  const PENDING_CONFIRMATION_KEY = 'edm28_pending_email_confirmation_v1';

  function confirmationRedirect() {
    const local = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    return local ? `${window.location.origin}/` : 'https://edm28.fr/';
  }

  function rememberPendingConfirmation(email) {
    try {
      localStorage.setItem(PENDING_CONFIRMATION_KEY, JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        sentAt: Date.now()
      }));
    } catch (_) {}
  }

  function pendingConfirmation() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_CONFIRMATION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function clearPendingConfirmation() {
    try { localStorage.removeItem(PENDING_CONFIRMATION_KEY); } catch (_) {}
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data?.session || null;
  }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmationRedirect() }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  function authBlock(context) {
    return `
      <div class="account-box" data-auth-box="${context}">
        <div class="section-kicker">Compte client</div>
        <h2>Connexion EDM28</h2>
        <p>Connectez-vous pour retrouver vos véhicules et suivre votre demande. Nouveau client ? Créez votre compte, puis confirmez votre email grâce au lien reçu.</p>
        <div class="form-grid two">
          <label>Email<input id="${context}AuthEmail" type="email" autocomplete="email" placeholder="vous@exemple.fr"></label>
          <label>Mot de passe<input id="${context}AuthPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8 caractères minimum"></label>
        </div>
        <div class="action-row">
          <button class="primary-action" type="button" data-auth-signin="${context}">Se connecter</button>
          <button class="secondary-action" type="button" data-auth-signup="${context}">Créer mon compte</button>
          <button class="text-action" type="button" data-auth-reset="${context}">Mot de passe oublié</button>
          <button class="text-action" type="button" data-auth-resend="${context}" hidden>Renvoyer l’email de confirmation</button>
        </div>
        <div id="${context}AuthStatus" class="inline-status"></div>
      </div>`;
  }

  async function resendConfirmation(context) {
    const email = byId(`${context}AuthEmail`)?.value.trim().toLowerCase();
    if (!email) throw new Error('Renseignez votre adresse email.');
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmationRedirect() }
    });
    if (error) throw error;
    rememberPendingConfirmation(email);
    message(`${context}AuthStatus`, 'Email de confirmation renvoyé. Vérifiez votre boîte de réception et vos courriers indésirables.', 'okbox');
  }

  async function sendReset(context) {
    const email = byId(`${context}AuthEmail`)?.value.trim().toLowerCase();
    if (!email) throw new Error('Renseignez votre adresse email.');
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`
    });
    if (error) throw error;
    message(`${context}AuthStatus`, 'Email de réinitialisation envoyé.', 'okbox');
  }

  function bindAuth(context, onReady) {
    document.querySelector(`[data-auth-signin="${context}"]`)?.addEventListener('click', async () => {
      try {
        message(`${context}AuthStatus`, 'Connexion…');
        const email = byId(`${context}AuthEmail`)?.value.trim().toLowerCase();
        const password = byId(`${context}AuthPassword`)?.value || '';
        if (!email || !password) throw new Error('Email et mot de passe obligatoires.');
        await signIn(email,password);
        message(`${context}AuthStatus`, 'Connecté.', 'okbox');
        await onReady();
      } catch (error) {
        const needsConfirmation = error?.code === 'email_not_confirmed' || /email not confirmed|email.*confirm/i.test(error?.message || '');
        if (needsConfirmation) {
          document.querySelector(`[data-auth-resend="${context}"]`)?.removeAttribute('hidden');
          message(`${context}AuthStatus`, 'Adresse email non confirmée. Ouvrez l’email EDM28 et cliquez sur le lien de confirmation avant de vous connecter.', 'errorbox');
        } else {
          message(`${context}AuthStatus`, error.message || 'Connexion impossible.', 'errorbox');
        }
      }
    });

    document.querySelector(`[data-auth-signup="${context}"]`)?.addEventListener('click', async () => {
      try {
        message(`${context}AuthStatus`, 'Création du compte…');
        const email = byId(`${context}AuthEmail`)?.value.trim().toLowerCase();
        const password = byId(`${context}AuthPassword`)?.value || '';
        if (!email || password.length < 8) throw new Error('Email valide et mot de passe de 8 caractères minimum obligatoires.');
        const data = await signUp(email,password);
        if (data?.session) {
          message(`${context}AuthStatus`, 'Le compte ne peut pas encore être utilisé. Contactez EDM28 par email.', 'errorbox');
          await signOut();
        } else {
          rememberPendingConfirmation(email);
          document.querySelector(`[data-auth-resend="${context}"]`)?.removeAttribute('hidden');
          message(`${context}AuthStatus`, 'Compte créé. Un email de confirmation vient d’être envoyé. Cliquez sur le lien reçu pour valider votre adresse avant de vous connecter. Pensez à vérifier les courriers indésirables.', 'okbox');
        }
      } catch (error) {
        message(`${context}AuthStatus`, error.message || 'Création du compte impossible.', 'errorbox');
      }
    });

    document.querySelector(`[data-auth-resend="${context}"]`)?.addEventListener('click', async () => {
      try { await resendConfirmation(context); }
      catch (error) { message(`${context}AuthStatus`, error.message || 'Impossible de renvoyer l’email de confirmation.', 'errorbox'); }
    });

    document.querySelector(`[data-auth-reset="${context}"]`)?.addEventListener('click', async () => {
      try { await sendReset(context); }
      catch (error) { message(`${context}AuthStatus`, error.message || 'Réinitialisation impossible.', 'errorbox'); }
    });
  }

  async function installHomePage() {
    const host = byId('edmHomeClientApp');
    if (!host) return;

    async function render() {
      const session = await getSession();
      const pending = pendingConfirmation();
      const justConfirmed = Boolean(
        session?.user?.email &&
        session.user.email_confirmed_at &&
        pending?.email &&
        String(session.user.email).toLowerCase() === String(pending.email).toLowerCase()
      );
      if (justConfirmed) clearPendingConfirmation();
      if (!session?.user) {
        host.innerHTML = '';
        return;
      }
      const { data, error } = await client.from('appointments')
        .select('id,starts_at,status,vehicle_id,vehicles(plate,brand,model)')
        .eq('user_id',session.user.id)
        .eq('visible_to_client',true)
        .neq('status','cancelled')
        .gte('starts_at',new Date().toISOString())
        .order('starts_at',{ascending:true})
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.starts_at) {
        host.innerHTML = `${justConfirmed ? '<section class="client-panel"><div class="okbox"><strong>Adresse email confirmée.</strong> Votre compte EDM28 est maintenant actif.</div></section>' : ''}<section class="home-client-card"><div><div class="section-kicker">Espace client</div><h2>Aucun rendez-vous à venir</h2><p>Vos dossiers restent disponibles dans Mes interventions.</p></div><a class="primary-action as-link" href="/mes-interventions">Mes interventions</a></section>`;
        return;
      }
      const vehicle = data.vehicles ? [data.vehicles.plate,data.vehicles.brand,data.vehicles.model].filter(Boolean).join(' · ') : '';
      host.innerHTML = `${justConfirmed ? '<section class="client-panel"><div class="okbox"><strong>Adresse email confirmée.</strong> Votre compte EDM28 est maintenant actif.</div></section>' : ''}<section class="next-appointment"><div class="section-kicker">Prochain rendez-vous</div><h2>${esc(dateTime(data.starts_at))}</h2><p>${esc(vehicle || 'Intervention EDM28')}</p><a class="primary-action as-link" href="/mes-interventions">Voir mes interventions</a></section>`;
    }

    try { await render(); } catch (_) { host.innerHTML = ''; }
    client.auth.onAuthStateChange(()=>window.setTimeout(()=>render().catch(()=>{}),0));
  }

  async function installRequestPage() {
    const host = byId('edmRequestApp');
    if (!host) return;

    host.innerHTML = `
      <section class="client-panel" id="connexion"><div id="requestAccountArea"></div></section>
      <section class="client-panel">
        <div class="section-kicker">1 · Véhicule</div>
        <h2>Votre véhicule</h2>
        <div id="requestVehiclePicker" hidden><label>Rechercher un véhicule<input id="requestVehicleSearch" type="search" placeholder="Plaque, marque ou modèle"></label><label>Mes véhicules enregistrés<select id="requestVehicleSelect"><option value="">Ajouter un autre véhicule</option></select></label></div>
        <p>Seule la plaque est obligatoire. Les autres informations nous aident à préparer votre devis.</p>
        <div class="form-grid three">
          <label>Immatriculation (obligatoire)
            <input id="requestPlate" required aria-required="true" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AA-123-AA ou 1234 AB 28" aria-describedby="requestPlateHelp requestPlateStatus">
            <small id="requestPlateHelp" class="field-help">Formats acceptés : nouveau SIV AA-123-AA ou ancien FNI 1234 AB 28.</small>
            <small id="requestPlateStatus" class="plate-status"></small>
          </label>
          <label>Marque<input id="requestBrand" placeholder="Renault"></label>
          <label>Modèle<input id="requestModel" placeholder="Clio"></label>
          <label>Année<input id="requestYear" inputmode="numeric" placeholder="2018"></label>
          <label>Énergie<input id="requestEnergy" placeholder="Essence, Diesel…"></label>
          <label>Kilométrage<input id="requestMileage" inputmode="numeric" placeholder="85000"></label>
        </div>
      </section>

      <section class="client-panel">
        <div class="section-kicker">2 · Intervention</div>
        <h2>Que faut-il faire ?</h2>
        <p>Choisissez les prestations souhaitées. Le devis précisera le travail prévu et le prix.</p>
        <div id="requestServices" class="service-choice-grid"><div class="notice">Chargement des prestations…</div></div>
        <div class="benefit-card advantage-card">
          <div>
            <span class="advantage-badge">Dès 100 € TTC</span>
            <strong>Mes avantages à partir de 100 €</strong>
            <p>Comparatif des contrôles, OR vierge et checklist complète EDM28.</p>
            <small>Le PDF s’ouvre dans un nouvel onglet.</small>
          </div>
          <button class="advantage-action" type="button" id="downloadBlankOrder">Mes avantages à partir de 100 € <span aria-hidden="true">→</span></button>
        </div>
        <label style="display:block;margin-top:18px">Symptômes ou précisions
          <textarea id="requestNotes" rows="5" placeholder="Bruit, vibration, remarque du contrôle technique, contexte…"></textarea>
        </label>
      </section>

      <section class="client-panel">
        <div class="section-kicker">3 · Coordonnées</div>
        <h2>Vos coordonnées (facultatif)</h2>
        <div class="form-grid three">
          <label>Prénom<input id="requestFirstName" autocomplete="given-name"></label>
          <label>Nom<input id="requestLastName" autocomplete="family-name"></label>
          <label>Téléphone<input id="requestPhone" autocomplete="tel"></label>
        </div>
      </section>

      <section class="client-panel">
        <div class="section-kicker">4 · Vérification</div>
        <h2>Transmettre la demande</h2>
        <p>Nous étudions votre demande et vous envoyons un devis par email. Aucune intervention ne commence sans votre accord.</p>
        <div class="action-row">
          <button id="requestSubmit" class="primary-action" type="button" disabled>Envoyer ma demande</button>
        </div>
        <div id="requestSubmitStatus" class="inline-status"></div>
      </section>`;

    const servicesHost = byId('requestServices');
    const { data: services, error } = await client
      .from('site_services')
      .select('id,name,slug,category,client_description,pricing_type,displayed_price,labor_price,duration_minutes')
      .eq('active',true)
      .not('published_at','is',null)
      .order('display_order',{ascending:true});
    if (error) {
      servicesHost.innerHTML = '<div class="errorbox">Catalogue momentanément indisponible.</div>';
    } else {
      servicesHost.innerHTML = (services || []).map((service) => `
        <label class="service-choice">
          <input type="checkbox" value="${esc(service.id)}" data-service-json="${esc(encodeURIComponent(JSON.stringify(service)))}">
          <span><strong>${esc(service.name)}</strong><small>${esc(service.client_description || service.category || '')}</small><small class="service-conflict-note"></small></span>
          <b>${service.pricing_type === 'quote' ? 'Sur devis' : money(service.displayed_price)}</b>
        </label>`).join('') || '<div class="notice">Aucune prestation disponible actuellement.</div>';
    }

    const plateInput = byId('requestPlate');
    const plateStatus = byId('requestPlateStatus');

    function refreshPlateStatus(formatValue = false) {
      const parsed = parseFrenchPlate(plateInput?.value);
      if (!plateInput?.value.trim()) {
        plateInput?.removeAttribute('aria-invalid');
        if (plateStatus) {
          plateStatus.textContent = '';
          plateStatus.className = 'plate-status';
        }
        return parsed;
      }
      plateInput.setAttribute('aria-invalid', String(!parsed.valid));
      if (parsed.valid) {
        if (formatValue) plateInput.value = parsed.display;
        if (plateStatus) {
          plateStatus.textContent = `Format ${parsed.format} valide.`;
          plateStatus.className = 'plate-status valid';
        }
      } else if (plateStatus) {
        plateStatus.textContent = 'Plaque invalide. Utilisez AA-123-AA ou un ancien format comme 1234 AB 28.';
        plateStatus.className = 'plate-status invalid';
      }
      return parsed;
    }

    plateInput?.addEventListener('input', () => {
      plateInput.value = plateInput.value.toUpperCase().replace(/[^A-Z0-9 -]/g,'').slice(0,14);
      refreshPlateStatus(false);
    });
    plateInput?.addEventListener('blur', () => refreshPlateStatus(true));

    function decodeServiceInput(input) {
      try { return JSON.parse(decodeURIComponent(input.dataset.serviceJson || '')); }
      catch (_) { return null; }
    }

    function refreshServiceConflicts() {
      const inputs = [...servicesHost.querySelectorAll('input[type="checkbox"]')];
      const selected = inputs.filter((input) => input.checked).map((input) => ({ input, service:decodeServiceInput(input) })).filter((row) => row.service);

      inputs.forEach((input) => {
        const label = input.closest('.service-choice');
        const note = label?.querySelector('.service-conflict-note');
        label?.classList.toggle('is-selected', input.checked);
        if (input.checked) {
          input.disabled = false;
          label?.classList.remove('is-conflict-disabled');
          if (note) note.textContent = '';
          return;
        }
        const service = decodeServiceInput(input);
        const conflict = service ? selected.find((row) => servicesOverlap(service,row.service)) : null;
        input.disabled = Boolean(conflict);
        label?.classList.toggle('is-conflict-disabled',Boolean(conflict));
        if (note) note.textContent = conflict ? `Déjà couvert par « ${conflict.service.name} ».` : '';
      });
    }

    servicesHost.addEventListener('change',(event)=>{
      if (event.target.matches('input[type="checkbox"]')) refreshServiceConflicts();
    });
    refreshServiceConflicts();

    let savedVehicles = [];
    let currentRequestUser = null;
    let accountGeneration = 0;
    function renderVehicleOptions() {
      const selected = byId('requestVehicleSelect').value;
      const term = byId('requestVehicleSearch').value.trim().toLowerCase();
      byId('requestVehicleSelect').innerHTML = '<option value="">Ajouter un autre v\u00e9hicule</option>' + savedVehicles
        .filter(v => [v.plate,v.brand,v.model].join(' ').toLowerCase().includes(term))
        .map(v=>`<option value="${esc(v.id)}">${esc([v.plate,v.brand,v.model].filter(Boolean).join(' \u00b7 '))}</option>`).join('');
      byId('requestVehicleSelect').value = selected;
    }
    byId('requestVehicleSearch').addEventListener('input',renderVehicleOptions);
    byId('requestVehicleSelect').addEventListener('change',()=>{
      const vehicle = savedVehicles.find(v=>v.id===byId('requestVehicleSelect').value);
      const fields = {plate:'requestPlate',brand:'requestBrand',model:'requestModel',year:'requestYear',energy:'requestEnergy',mileage:'requestMileage'};
      for (const [key,id] of Object.entries(fields)) byId(id).value = vehicle?.[key] ?? '';
      refreshPlateStatus(true);
    });
    async function renderAccount() {
      const generation = ++accountGeneration;
      const area = byId('requestAccountArea');
      const session = await getSession();
      if (generation !== accountGeneration) return;
      const uid = session?.user?.id || null;
      if (currentRequestUser && currentRequestUser !== uid) {
        for (const id of ['requestPlate','requestBrand','requestModel','requestYear','requestEnergy','requestMileage','requestFirstName','requestLastName','requestPhone']) byId(id).value = '';
        savedVehicles = [];
      }
      currentRequestUser = uid;
      byId('requestSubmit').disabled = !uid || byId('requestSubmit').dataset.sent === 'true';
      byId('requestVehiclePicker').hidden = !uid;
      if (!uid) {
        area.innerHTML = authBlock('request');
        bindAuth('request', async()=>{
          await renderAccount();
          const params = new URLSearchParams(location.search);
          if (params.get('retour') === 'interventions') {
            const target = new URL('/mes-interventions',location.origin);
            const quote = params.get('devis');
            if (/^[0-9a-f-]{36}$/i.test(quote || '')) target.searchParams.set('devis',quote);
            location.replace(target.href);
          }
        });
        return;
      }
      area.innerHTML = `<div class="signed-box"><div><strong>Connect\u00e9</strong><p>${esc(session.user.email || '')}</p></div><button class="secondary-action" type="button" id="requestSignOut">Me d\u00e9connecter</button></div>`;
      byId('requestSignOut').addEventListener('click', async()=>{await signOut();await renderAccount();});
      const [profileResult,vehicleResult] = await Promise.all([
        client.from('profiles').select('first_name,last_name,phone').eq('id',uid).maybeSingle(),
        client.from('vehicles').select('id,plate,brand,model,year,energy,mileage').eq('user_id',uid).order('plate')
      ]);
      if (generation !== accountGeneration || currentRequestUser !== uid) return;
      const profile = profileResult.data;
      for (const [key,id] of Object.entries({first_name:'requestFirstName',last_name:'requestLastName',phone:'requestPhone'})) {
        if (!byId(id).value && profile?.[key]) byId(id).value = profile[key];
      }
      if (vehicleResult.error) {
        message('requestSubmitStatus','Vos v\u00e9hicules ne peuvent pas \u00eatre charg\u00e9s. Vous pouvez renseigner votre plaque.','notice');
      }
      savedVehicles = vehicleResult.data || [];
      renderVehicleOptions();
    }

    let submitting = false;
    let draftRequestId = null;
    let draftOwner = null;
    async function submit() {
      if (submitting) return;
      submitting = true;
      byId('requestSubmit').disabled = true;
      try {
        message('requestSubmitStatus','Enregistrement de la demande…');
        const session = await getSession();
        if (!session?.user) {
          byId('connexion').scrollIntoView({behavior:'smooth'});
          byId('requestAuthEmail')?.focus();
          throw new Error('Connectez-vous en haut de cette page pour envoyer la demande.');
        }

        const parsedPlate = refreshPlateStatus(true);
        if (!parsedPlate.valid) throw new Error('Immatriculation obligatoire au format AA-123-AA ou ancien format FNI, par exemple 1234 AB 28.');
        const plate = parsedPlate.display;
        const plateNormalized = parsedPlate.normalized;

        const selected = [...document.querySelectorAll('#requestServices input[type="checkbox"]:checked')].map(decodeServiceInput).filter(Boolean);
        if (!selected.length) throw new Error('Choisissez au moins une prestation.');
        for (let i = 0; i < selected.length; i += 1) {
          for (let j = i + 1; j < selected.length; j += 1) {
            if (servicesOverlap(selected[i],selected[j])) {
              throw new Error(`Les prestations « ${selected[i].name} » et « ${selected[j].name} » se recouvrent. Gardez uniquement la prestation la plus complète.`);
            }
          }
        }

        const firstName = byId('requestFirstName').value.trim();
        const lastName = byId('requestLastName').value.trim();
        const phone = byId('requestPhone').value.trim();


        const profilePatch = Object.fromEntries(Object.entries({ first_name:firstName, last_name:lastName, phone }).filter(([,value])=>value));
        if (Object.keys(profilePatch).length) {
          const { error: profileError } = await client.from('profiles').update(profilePatch).eq('id',session.user.id);
          if (profileError) throw profileError;
        }

        const { data: vehicle, error: vehicleError } = await client.from('vehicles').upsert({
          user_id:session.user.id,
          plate,
          plate_normalized:plateNormalized,
          ...Object.fromEntries(Object.entries({
            brand:byId('requestBrand').value.trim(), model:byId('requestModel').value.trim(),
            year:intOrNull(byId('requestYear').value), energy:byId('requestEnergy').value.trim(),
            mileage:intOrNull(byId('requestMileage').value)
          }).filter(([,value])=>value !== null && value !== ''))
        },{onConflict:'user_id,plate_normalized'}).select('id').single();
        if (vehicleError) throw vehicleError;

        const serviceRows = selected.map((service) => ({
          id:service.id,
          slug:service.slug,
          name:service.name,
          category:service.category,
          labor:Number(service.labor_price || service.displayed_price || 0),
          duration_minutes:Number(service.duration_minutes || 0),
          durationMinutes:Number(service.duration_minutes || 0)
        }));
        const laborTotal = serviceRows.reduce((sum,row)=>sum+Number(row.labor||0),0);
        const totals = { laborBase:laborTotal,laborTotal,totalMin:laborTotal,totalMax:laborTotal,totalAllMin:laborTotal,totalAllMax:laborTotal };

        if (draftOwner !== session.user.id) draftRequestId = null;
        const requestPayload = {
          user_id:session.user.id,
          vehicle_id:vehicle.id,
          status:'draft',
          selected_basket:'standard',
          services:serviceRows,
          notes:byId('requestNotes').value.trim() || null,
          totals,
          j7_accepted:false,
          refuse_control:false,
          submitted_at:null
        };
        const mutation = draftRequestId
          ? client.from('service_requests').update(requestPayload).eq('id',draftRequestId).eq('user_id',session.user.id).eq('status','draft')
          : client.from('service_requests').insert(requestPayload);
        const { data: request, error: requestError } = await mutation.select('id').single();
        if (requestError) throw requestError;
        draftRequestId = request.id;
        draftOwner = session.user.id;

        const response = await fetch('/api/submit-request-v2',{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
          body:JSON.stringify({requestId:request.id})
        });
        const result = await response.json().catch(()=>({}));
        if (!response.ok || result.success !== true) throw new Error(result.error || 'Transmission impossible.');

        message('requestSubmitStatus',result.emailSent === false
          ? 'Demande enregistrée. La notification email est momentanément indisponible, mais le dossier est bien dans le back-office.'
          : 'Demande envoyée. Vous recevrez votre devis et votre panier par email.','okbox');
        draftRequestId = null;
        byId('requestSubmit').textContent = 'Demande envoyée';
        byId('requestSubmit').dataset.sent = 'true';
      } catch (error) {
        message('requestSubmitStatus',error.message || 'Envoi impossible.','errorbox');
      } finally {
        submitting = false;
        byId('requestSubmit').disabled = byId('requestSubmit').dataset.sent === 'true' || !currentRequestUser;
      }
    }

    byId('downloadBlankOrder')?.addEventListener('click', () => {
      try {
        if (!window.EDMPdfLite?.buildAdvantagesOrder) throw new Error('Générateur PDF indisponible.');
        const blob = window.EDMPdfLite.buildAdvantagesOrder();
        const url = URL.createObjectURL(blob);
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        message('requestSubmitStatus', error.message || 'Ouverture du PDF impossible.', 'errorbox');
      }
    });

    byId('requestSubmit')?.addEventListener('click',submit);
    await renderAccount();
    client.auth.onAuthStateChange(()=>window.setTimeout(renderAccount,0));
  }

  function eventCard(type,title,date,status,details=[],documentPath='',actions='') {
    const detailHtml = details.filter(Boolean).map(([label,value]) => value ? `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : '').join('');
    return `<article class="intervention-event">
      <div class="event-head"><span class="event-type">${esc(type)}</span><span class="event-status">${esc(status || '')}</span></div>
      <h3>${esc(title)}</h3>
      <p class="event-date">${esc(date)}</p>
      ${detailHtml ? `<div class="event-details">${detailHtml}</div>` : ''}
      ${documentPath ? `<button class="text-action" type="button" data-doc-path="${esc(documentPath)}">Ouvrir le document</button>` : ''}
      ${actions}
    </article>`;
  }

  function supplierQuoteActions(quote) {
    const basket = Array.isArray(quote.quote_parts_baskets) ? quote.quote_parts_baskets[0] : quote.quote_parts_baskets;
    let html = '';
    if (basket) {
      html += `<p>${esc(window.EDMSupplierBasketPolicy.terms)}</p>`;
      if (basket.requires_parts) {
        const url = window.EDMSupplierBasketPolicy.safeUrl(basket.supplier_url);
        html += `<p><a class="primary-action as-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir mon panier fournisseur</a></p><p><strong>Pi\u00e8ces pr\u00e9conis\u00e9es</strong></p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(basket.recommended_parts)}</p><p>${esc(window.EDMSupplierBasketPolicy.partsAdvice)}</p>`;
      }
    }
    if (quote.status === 'sent') {
      const expired = quote.valid_until && quote.valid_until < new Date().toISOString().slice(0,10);
      html += `<div class="action-row">${expired ? '<span>Devis expir\u00e9</span>' : `<button type="button" class="primary-action" data-quote-response="accepted" data-quote-id="${esc(quote.id)}">Accepter ce devis</button>`}<button type="button" class="secondary-action" data-quote-response="refused" data-quote-id="${esc(quote.id)}">Refuser ce devis</button></div>`;
    }
    return html;
  }

  async function openDocument(path) {
    const { data, error } = await client.storage.from('repair-documents').createSignedUrl(path,120);
    if (error || !data?.signedUrl) throw error || new Error('Document indisponible.');
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }

  async function installInterventionsPage() {
    if (!byId('edmInterventionsApp')) return;
    await window.EDMClientJourney.install({client,getSession,signOut,esc,money,dateTime});
  }

  async function installAccountNavigation() {
    let generation = 0;
    async function update() {
      const turn = ++generation;
      let session = null;
      try { session = await getSession(); } catch (_) {}
      if (turn !== generation) return;
      const connected = Boolean(session?.user);
      document.querySelectorAll('[data-client-only]').forEach(node=>node.hidden=!connected);
      if (location.pathname === '/demande') document.querySelectorAll('[data-request-cta]').forEach(link=>{
        link.href = connected ? '#requestVehiclePicker' : '#connexion';
        const label = link.querySelector('span') || link;
        label.textContent = connected ? 'Mes v\u00e9hicules' : 'Me connecter';
      });
    }
    await update();
    client.auth.onAuthStateChange(()=>setTimeout(()=>void update(),0));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',()=>{ void installAccountNavigation(); void installHomePage(); void installRequestPage(); void installInterventionsPage(); },{once:true});
  } else {
    void installAccountNavigation();
    void installHomePage();
    void installRequestPage();
    void installInterventionsPage();
  }
})();