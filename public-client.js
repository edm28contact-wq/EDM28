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

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data?.session || null;
  }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href.split('#')[0] }
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
        <p>Votre compte sert uniquement à transmettre et suivre vos dossiers.</p>
        <div class="form-grid two">
          <label>Email<input id="${context}AuthEmail" type="email" autocomplete="email" placeholder="vous@exemple.fr"></label>
          <label>Mot de passe<input id="${context}AuthPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8 caractères minimum"></label>
        </div>
        <div class="action-row">
          <button class="primary-action" type="button" data-auth-signin="${context}">Se connecter</button>
          <button class="secondary-action" type="button" data-auth-signup="${context}">Créer mon compte</button>
          <button class="text-action" type="button" data-auth-reset="${context}">Mot de passe oublié</button>
        </div>
        <div id="${context}AuthStatus" class="inline-status"></div>
      </div>`;
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
        message(`${context}AuthStatus`, error.message || 'Connexion impossible.', 'errorbox');
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
          message(`${context}AuthStatus`, 'Compte créé et connecté.', 'okbox');
          await onReady();
        } else {
          message(`${context}AuthStatus`, 'Compte créé. Ouvrez l’email reçu et cliquez sur le lien de confirmation.', 'okbox');
        }
      } catch (error) {
        message(`${context}AuthStatus`, error.message || 'Création du compte impossible.', 'errorbox');
      }
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
      if (!session?.user) {
        host.innerHTML = `<section class="home-client-card"><div><div class="section-kicker">Espace client</div><h2>Suivez vos interventions</h2><p>Connectez-vous depuis Mes interventions pour retrouver vos véhicules, documents et rendez-vous.</p></div><a class="primary-action as-link" href="/mes-interventions">Mes interventions</a></section>`;
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
        host.innerHTML = `<section class="home-client-card"><div><div class="section-kicker">Espace client</div><h2>Aucun rendez-vous à venir</h2><p>Vos dossiers restent disponibles dans Mes interventions.</p></div><a class="primary-action as-link" href="/mes-interventions">Mes interventions</a></section>`;
        return;
      }
      const vehicle = data.vehicles ? [data.vehicles.plate,data.vehicles.brand,data.vehicles.model].filter(Boolean).join(' · ') : '';
      host.innerHTML = `<section class="next-appointment"><div class="section-kicker">Prochain rendez-vous</div><h2>${esc(dateTime(data.starts_at))}</h2><p>${esc(vehicle || 'Intervention EDM28')}</p><a class="primary-action as-link" href="/mes-interventions">Voir mes interventions</a></section>`;
    }

    try { await render(); } catch (_) { host.innerHTML = ''; }
    client.auth.onAuthStateChange(()=>window.setTimeout(()=>render().catch(()=>{}),0));
  }

  async function installRequestPage() {
    const host = byId('edmRequestApp');
    if (!host) return;

    host.innerHTML = `
      <section class="client-panel">
        <div class="section-kicker">1 · Véhicule</div>
        <h2>Votre véhicule</h2>
        <div class="form-grid three">
          <label>Immatriculation
            <input id="requestPlate" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AA-123-AA ou 1234 AB 28" aria-describedby="requestPlateHelp requestPlateStatus">
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
        <p>Sélectionnez une ou plusieurs prestations. EDM28 confirmera ensuite le périmètre réel avant travaux.</p>
        <div id="requestServices" class="service-choice-grid"><div class="notice">Chargement des prestations…</div></div>
        <div class="control-comparison">
          <div class="control-comparison-head">
            <div>
              <strong>Contrôles EDM28 selon le montant facturé</strong>
              <p>Le seuil est calculé sur le total TTC facturé par EDM28 pour l’intervention.</p>
            </div>
            <button class="secondary-action" type="button" id="downloadBlankOrder">Voir l’OR vierge</button>
          </div>
          <div class="control-comparison-table" role="table" aria-label="Comparatif des contrôles EDM28">
            <div class="comparison-row comparison-header" role="row">
              <span role="columnheader">Contrôle</span>
              <strong role="columnheader">Moins de 100 € TTC</strong>
              <strong role="columnheader" class="comparison-highlight">100 € TTC et plus</strong>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Points directement liés à l’intervention demandée</span>
              <span role="cell">Contrôlés</span>
              <span role="cell" class="comparison-highlight">Contrôlés</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Contrôles nécessaires selon l’état constaté du véhicule</span>
              <span role="cell">Selon besoin</span>
              <span role="cell" class="comparison-highlight">Selon besoin</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Pression des 4 pneus</span>
              <span role="cell" class="comparison-yes">Automatique</span>
              <span role="cell" class="comparison-highlight comparison-yes">Automatique</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">État des 4 pneus</span>
              <span role="cell">Selon besoin</span>
              <span role="cell" class="comparison-highlight comparison-yes">Contrôle complet</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Jeu dans les roues / liaison au sol : roulements, rotules, silentblocs, soufflets</span>
              <span role="cell">Selon besoin</span>
              <span role="cell" class="comparison-highlight comparison-yes">Contrôle complet</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Niveaux : frein, huile moteur, refroidissement, lave-glace</span>
              <span role="cell">Selon besoin</span>
              <span role="cell" class="comparison-highlight comparison-yes">Inclus</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Essuie-glaces, klaxon et éclairage complet</span>
              <span role="cell">Selon besoin</span>
              <span role="cell" class="comparison-highlight comparison-yes">Inclus</span>
            </div>
            <div class="comparison-row" role="row">
              <span role="cell">Checklist complémentaire complète EDM28</span>
              <span role="cell">Non automatique</span>
              <span role="cell" class="comparison-highlight comparison-yes">Incluse</span>
            </div>
          </div>
          <p class="comparison-note">La pression des pneus est vérifiée automatiquement. À partir de 100 € TTC facturés, EDM28 ajoute le contrôle complet de l’état des pneus, des jeux et éléments de liaison au sol, des niveaux, des équipements et de l’éclairage, puis rattache la checklist complète au dossier.</p>
        </div>
        <label style="display:block;margin-top:18px">Symptômes ou précisions
          <textarea id="requestNotes" rows="5" placeholder="Bruit, vibration, remarque du contrôle technique, contexte…"></textarea>
        </label>
      </section>

      <section class="client-panel">
        <div class="section-kicker">3 · Coordonnées</div>
        <h2>Vos coordonnées</h2>
        <div class="form-grid three">
          <label>Prénom<input id="requestFirstName" autocomplete="given-name"></label>
          <label>Nom<input id="requestLastName" autocomplete="family-name"></label>
          <label>Téléphone<input id="requestPhone" autocomplete="tel"></label>
        </div>
        <div id="requestAccountArea" style="margin-top:18px"></div>
      </section>

      <section class="client-panel">
        <div class="section-kicker">4 · Vérification</div>
        <h2>Transmettre la demande</h2>
        <p>La demande est étudiée par EDM28 avant devis. Aucun travail supplémentaire n’est ajouté sans validation.</p>
        <div class="action-row">
          <button id="requestSubmit" class="primary-action" type="button">Envoyer ma demande pour étude</button>
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

    async function renderAccount() {
      const area = byId('requestAccountArea');
      const session = await getSession();
      if (!session?.user) {
        area.innerHTML = authBlock('request');
        bindAuth('request', renderAccount);
        return;
      }
      const { data: profile } = await client.from('profiles').select('first_name,last_name,phone').eq('id',session.user.id).maybeSingle();
      if (profile) {
        byId('requestFirstName').value = profile.first_name || byId('requestFirstName').value;
        byId('requestLastName').value = profile.last_name || byId('requestLastName').value;
        byId('requestPhone').value = profile.phone || byId('requestPhone').value;
      }
      area.innerHTML = `<div class="signed-box"><div><strong>Connecté</strong><p>${esc(session.user.email || '')}</p></div><button class="secondary-action" type="button" id="requestSignOut">Se déconnecter</button></div>`;
      byId('requestSignOut')?.addEventListener('click', async () => { await signOut(); await renderAccount(); });
    }

    async function submit() {
      try {
        message('requestSubmitStatus','Enregistrement de la demande…');
        const session = await getSession();
        if (!session?.user) throw new Error('Connectez-vous ou créez votre compte avant de transmettre la demande.');

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
        if (!firstName || !lastName || !phone) throw new Error('Prénom, nom et téléphone obligatoires.');

        const { error: profileError } = await client.from('profiles').update({
          first_name:firstName,last_name:lastName,phone
        }).eq('id',session.user.id);
        if (profileError) throw profileError;

        const { data: vehicle, error: vehicleError } = await client.from('vehicles').upsert({
          user_id:session.user.id,
          plate,
          plate_normalized:plateNormalized,
          brand:byId('requestBrand').value.trim() || null,
          model:byId('requestModel').value.trim() || null,
          year:intOrNull(byId('requestYear').value),
          energy:byId('requestEnergy').value.trim() || null,
          mileage:intOrNull(byId('requestMileage').value)
        },{onConflict:'user_id,plate_normalized'}).select('id').single();
        if (vehicleError) throw vehicleError;

        const serviceRows = selected.map((service) => ({
          id:service.id,
          slug:service.slug,
          name:service.name,
          category:service.category,
          labor:Number(service.labor_price || service.displayed_price || 0),
          duration_minutes:Number(service.duration_minutes || 0)
        }));
        const laborTotal = serviceRows.reduce((sum,row)=>sum+Number(row.labor||0),0);
        const totals = { laborBase:laborTotal,laborTotal,totalMin:laborTotal,totalMax:laborTotal,totalAllMin:laborTotal,totalAllMax:laborTotal };

        const { data: request, error: requestError } = await client.from('service_requests').insert({
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
        }).select('id').single();
        if (requestError) throw requestError;

        const response = await fetch('/api/submit-request-v2',{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
          body:JSON.stringify({requestId:request.id})
        });
        const result = await response.json().catch(()=>({}));
        if (!response.ok || result.success !== true) throw new Error(result.error || 'Transmission impossible.');

        message('requestSubmitStatus',result.emailSent === false
          ? 'Demande enregistrée. La notification email est momentanément indisponible, mais le dossier est bien dans le back-office.'
          : 'Demande transmise. EDM28 l’étudiera avant de vous proposer la suite.','okbox');
      } catch (error) {
        message('requestSubmitStatus',error.message || 'Envoi impossible.','errorbox');
      }
    }

    byId('downloadBlankOrder')?.addEventListener('click', () => {
      try {
        if (!window.EDMPdfLite?.build) throw new Error('Générateur PDF indisponible.');
        const controlGroups = [
          ['FREINAGE', [
            'Plaquettes avant gauche','Plaquettes avant droite','Plaquettes arrière gauche','Plaquettes arrière droite',
            'Disque avant gauche','Disque avant droit','Disque arrière gauche','Disque arrière droit','Flexibles de frein'
          ]],
          ['PNEUMATIQUES - ÉTAT', [
            'Pneu avant gauche','Pneu avant droit','Pneu arrière gauche','Pneu arrière droit'
          ]],
          ['LIAISON AU SOL', [
            'Jeu dans les roues','Amortisseurs','Rotules','Silentblocs','Roulements','Soufflets','Géométrie'
          ]],
          ['CONTRÔLES COMPLÉMENTAIRES - PRESSION DES PNEUS', [
            'Pression avant gauche','Pression avant droite','Pression arrière gauche','Pression arrière droite'
          ]],
          ['CONTRÔLES COMPLÉMENTAIRES - NIVEAUX', [
            'Niveau liquide de frein','Niveau huile moteur','Niveau liquide de refroidissement','Niveau lave-glace'
          ]],
          ['CONTRÔLES COMPLÉMENTAIRES - ÉQUIPEMENTS ET ÉCLAIRAGE', [
            'Essuie-glaces avant','Essuie-glace arrière','Klaxon',
            'Feu de position avant gauche','Feu de position avant droit','Feu de position arrière gauche','Feu de position arrière droit',
            'Feu de croisement gauche','Feu de croisement droit','Feu de route gauche','Feu de route droit',
            'Feu stop gauche','Feu stop droit','Troisième feu stop',
            'Feu de recul gauche','Feu de recul droit',
            'Antibrouillard avant gauche','Antibrouillard avant droit','Antibrouillard arrière',
            'Éclairage de plaque gauche','Éclairage de plaque droit',
            'Clignotant avant gauche','Clignotant avant droit','Clignotant arrière gauche','Clignotant arrière droit',
            'Répétiteur latéral gauche','Répétiteur latéral droit','Feux de détresse'
          ]]
        ];
        const lines = [
          { text:'EDM28', bold:true, size:22 },
          { text:'ORDRE DE RÉPARATION - MODÈLE VIERGE', bold:true, size:16, gap:6 },
          { text:'Document de préparation à compléter avant intervention.', size:9, gap:4 },
          { text:'CLIENT', bold:true, size:11, gap:14 },
          'Nom / Prénom : ____________________________________________',
          'Téléphone : ______________________________________________',
          'Email : ___________________________________________________',
          { text:'VÉHICULE', bold:true, size:11, gap:12 },
          'Immatriculation : __________________________________________',
          'Marque / Modèle : __________________________________________',
          'Kilométrage : ______________________________________________',
          { text:'TRAVAUX AUTORISÉS / DEMANDE CLIENT', bold:true, size:11, gap:12 },
          '____________________________________________________________',
          '____________________________________________________________',
          '____________________________________________________________',
          { text:'POINTS DE CONTRÔLE EDM28', bold:true, size:11, gap:14 },
          { text:'À partir de 100 € TTC facturés chez EDM28 : contrôle complet de cette liste.', bold:true, size:9, gap:4 },
          ...controlGroups.flatMap(([group, labels]) => [
            { text:group, bold:true, size:9, gap:9 },
            ...labels.map((label) => '[ ] ' + label)
          ]),
          { text:'OBSERVATIONS / MESURES', bold:true, size:11, gap:14 },
          '____________________________________________________________',
          '____________________________________________________________',
          '____________________________________________________________',
          { text:'VALIDATION', bold:true, size:11, gap:14 },
          'Date : _______________________   Technicien : _______________________',
          'Nom client : _____________________________________________________',
          'Signature client : __________________   Visa technicien : _____________'
        ];
        const blob = window.EDMPdfLite.build(lines);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ordre-reparation-vierge-edm28.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        message('requestSubmitStatus', error.message || 'Téléchargement impossible.', 'errorbox');
      }
    });

    byId('requestSubmit')?.addEventListener('click',submit);
    await renderAccount();
    client.auth.onAuthStateChange(()=>window.setTimeout(renderAccount,0));
  }

  function eventCard(type,title,date,status,details=[],documentPath='') {
    const detailHtml = details.filter(Boolean).map(([label,value]) => value ? `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : '').join('');
    return `<article class="intervention-event">
      <div class="event-head"><span class="event-type">${esc(type)}</span><span class="event-status">${esc(status || '')}</span></div>
      <h3>${esc(title)}</h3>
      <p class="event-date">${esc(date)}</p>
      ${detailHtml ? `<div class="event-details">${detailHtml}</div>` : ''}
      ${documentPath ? `<button class="text-action" type="button" data-doc-path="${esc(documentPath)}">Ouvrir le document</button>` : ''}
    </article>`;
  }

  async function openDocument(path) {
    const { data, error } = await client.storage.from('repair-documents').createSignedUrl(path,120);
    if (error || !data?.signedUrl) throw error || new Error('Document indisponible.');
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }

  async function installInterventionsPage() {
    const host = byId('edmInterventionsApp');
    if (!host) return;

    async function render() {
      const session = await getSession();
      if (!session?.user) {
        host.innerHTML = `<section class="client-panel">${authBlock('history')}</section>`;
        bindAuth('history',render);
        return;
      }

      host.innerHTML = '<section class="client-panel"><div class="notice">Chargement de vos interventions…</div></section>';

      const uid = session.user.id;
      const results = await Promise.all([
        client.from('vehicles').select('id,plate,brand,model,year,energy,engine,mileage,created_at').eq('user_id',uid).order('created_at'),
        client.from('service_requests').select('id,vehicle_id,status,services,notes,submitted_at,created_at').eq('user_id',uid).order('created_at',{ascending:false}),
        client.from('quotes').select('id,vehicle_id,service_request_id,quote_number,status,title,total,pdf_path,visible_to_client,created_at').eq('user_id',uid).eq('visible_to_client',true).order('created_at',{ascending:false}),
        client.from('disbursements').select('id,vehicle_id,service_request_id,quote_id,status,description,authorized_limit,provision_required,provision_received,parts_status,amount,refunded_amount,created_at').eq('user_id',uid).order('created_at',{ascending:false}),
        client.from('appointments').select('id,vehicle_id,service_request_id,starts_at,ends_at,status,notes,visible_to_client,created_at').eq('user_id',uid).eq('visible_to_client',true).order('starts_at',{ascending:false}),
        client.from('repair_orders').select('id,vehicle_id,service_request_id,order_number,status,pdf_path,visible_to_client,signed_at,created_at').eq('user_id',uid).eq('visible_to_client',true).order('created_at',{ascending:false}),
        client.from('inspection_reports').select('id,vehicle_id,report_number,status,observations,pdf_path,visible_to_client,completed_at,created_at').eq('user_id',uid).eq('visible_to_client',true).order('created_at',{ascending:false}),
        client.from('invoices').select('id,vehicle_id,invoice_number,status,total,amount_paid,pdf_path,visible_to_client,issued_at,created_at').eq('user_id',uid).eq('visible_to_client',true).order('created_at',{ascending:false})
      ]);
      const failed = results.find((result)=>result.error);
      if (failed?.error) throw failed.error;
      const [vehicles,requests,quotes,disbursements,appointments,orders,inspections,invoices] = results.map((result)=>result.data || []);

      const byVehicle = new Map(vehicles.map((vehicle)=>[vehicle.id,{vehicle,events:[]}]));
      const add = (vehicleId,html,stamp) => {
        if (!vehicleId || !byVehicle.has(vehicleId)) return;
        byVehicle.get(vehicleId).events.push({html,stamp:new Date(stamp || 0).getTime() || 0});
      };

      requests.forEach((row)=>add(row.vehicle_id,eventCard(
        'Demande',
        (row.services || []).map((s)=>s.name || s.label || s.id).filter(Boolean).join(' · ') || 'Demande d’intervention',
        dateTime(row.submitted_at || row.created_at),
        row.status,
        [['Notes',row.notes || '']]
      ),row.submitted_at || row.created_at));

      quotes.forEach((row)=>add(row.vehicle_id,eventCard(
        'Devis',row.quote_number || row.title || 'Devis',dateTime(row.created_at),row.status,
        [['Total',money(row.total)]],row.pdf_path
      ),row.created_at));

      disbursements.forEach((row)=>add(row.vehicle_id,eventCard(
        'Pièces',row.description || 'Pièces / débours',dateTime(row.created_at),row.parts_status || row.status,
        [
          ['Provision demandée',row.provision_required ? money(row.provision_required) : ''],
          ['Provision reçue',row.provision_received ? money(row.provision_received) : ''],
          ['Montant réel',row.amount ? money(row.amount) : '']
        ]
      ),row.created_at));

      appointments.forEach((row)=>add(row.vehicle_id,eventCard(
        'Rendez-vous',dateTime(row.starts_at),dateTime(row.created_at),row.status,
        [['Fin',row.ends_at ? dateTime(row.ends_at) : ''],['Informations',row.notes || '']]
      ),row.starts_at || row.created_at));

      orders.forEach((row)=>add(row.vehicle_id,eventCard(
        'Intervention',row.order_number || 'Ordre de réparation',dateTime(row.signed_at || row.created_at),row.status,[],row.pdf_path
      ),row.signed_at || row.created_at));

      inspections.forEach((row)=>add(row.vehicle_id,eventCard(
        'Contrôle',row.report_number || 'Fiche de contrôle',dateTime(row.completed_at || row.created_at),row.status,
        [['Observations',row.observations || '']],row.pdf_path
      ),row.completed_at || row.created_at));

      invoices.forEach((row)=>add(row.vehicle_id,eventCard(
        'Facture',row.invoice_number || 'Facture',dateTime(row.issued_at || row.created_at),row.status,
        [['Total',money(row.total)],['Payé',money(row.amount_paid)]],row.pdf_path
      ),row.issued_at || row.created_at));

      const nextAppointment = appointments
        .filter((row)=>row.starts_at && new Date(row.starts_at) > new Date() && row.status !== 'cancelled')
        .sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0];

      const cards = [...byVehicle.values()].map(({vehicle,events})=>{
        events.sort((a,b)=>b.stamp-a.stamp);
        const title = [vehicle.brand,vehicle.model].filter(Boolean).join(' ') || 'Véhicule';
        return `<section class="vehicle-history-card">
          <div class="vehicle-head">
            <div><span class="vehicle-plate">${esc(vehicle.plate || 'Sans plaque')}</span><h2>${esc(title)}</h2><p>${esc([vehicle.year,vehicle.energy,vehicle.mileage ? vehicle.mileage+' km' : ''].filter(Boolean).join(' · '))}</p></div>
            <span class="event-count">${events.length} élément${events.length>1?'s':''}</span>
          </div>
          <div class="timeline-list">${events.length ? events.map((event)=>event.html).join('') : '<div class="notice">Aucun dossier pour ce véhicule.</div>'}</div>
        </section>`;
      }).join('');

      host.innerHTML = `
        <section class="client-panel account-strip">
          <div><strong>${esc(session.user.email || '')}</strong><p>Compte client EDM28</p></div>
          <div class="action-row"><a class="primary-action as-link" href="/demande">Nouvelle demande</a><button class="secondary-action" id="historySignOut" type="button">Se déconnecter</button></div>
        </section>
        ${nextAppointment ? `<section class="next-appointment"><div class="section-kicker">Prochain rendez-vous</div><h2>${esc(dateTime(nextAppointment.starts_at))}</h2><p>Le rendez-vous est aussi conservé dans le dossier du véhicule concerné.</p></section>` : ''}
        ${cards || '<section class="client-panel"><div class="notice">Aucun véhicule enregistré.</div></section>'}`;

      byId('historySignOut')?.addEventListener('click',async()=>{await signOut();await render();});
      host.querySelectorAll('[data-doc-path]').forEach((button)=>button.addEventListener('click',async()=>{
        try { await openDocument(button.dataset.docPath); }
        catch (error) { window.alert(error.message || 'Document indisponible.'); }
      }));
    }

    try { await render(); }
    catch (error) { host.innerHTML = `<section class="client-panel"><div class="errorbox">${esc(error.message || 'Chargement impossible.')}</div></section>`; }
    client.auth.onAuthStateChange(()=>window.setTimeout(()=>render().catch(()=>{}),0));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',()=>{ void installHomePage(); void installRequestPage(); void installInterventionsPage(); },{once:true});
  } else {
    void installHomePage();
    void installRequestPage();
    void installInterventionsPage();
  }
})();