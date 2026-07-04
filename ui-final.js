(function () {
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  function setText(selector, text) {
    const el = qs(selector);
    if (el) el.textContent = text;
  }

  function setHTML(selector, html) {
    const el = qs(selector);
    if (el) el.innerHTML = html;
  }

  function enforceAccountUi() {
    hide(document.getElementById("btnLoadLocal"));

    const help = document.querySelector("#clientCard .section-title p");
    if (help) {
      help.textContent = "Créez votre compte ou connectez-vous avant de pouvoir transmettre une demande.";
    }
  }

  function lockClientFieldsIfConnected() {
    const connected = Boolean(window.state?.user?.id);
    ["firstName", "lastName", "phone", "email"].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.readOnly = connected;
      input.style.background = connected ? "#f8fafc" : "white";
    });
  }

  function patchHeroAndStaticTexts() {
    setText(".eyebrow", "Demande simple · estimation claire · reprise manuelle");
    setText("#home h1", "Préparez votre demande mécanique en quelques minutes.");
    setText("#home .lead", "Créez votre compte, renseignez votre véhicule, sélectionnez les prestations souhaitées, consultez une estimation, puis transmettez votre demande à EDM AUTO pour reprise manuelle.");

    const stats = qsa(".hero-stat");
    if (stats[0]) stats[0].innerHTML = '<span>1</span><div><b>Compte</b><p>Créez votre compte pour retrouver vos véhicules et vos demandes.</p></div>';
    if (stats[1]) stats[1].innerHTML = '<span>2</span><div><b>Estimation</b><p>Consultez plusieurs niveaux de panier selon votre besoin et votre budget.</p></div>';
    if (stats[2]) stats[2].innerHTML = '<span>3</span><div><b>Validation EDM</b><p>Chaque demande est ensuite revue manuellement avant confirmation.</p></div>';

    setText("#appointment .section-title p", "Un parcours simple : compte, véhicule, prestations, estimation, puis transmission de votre demande.");
    setText("#garage .section-title p", "Retrouvez ici les véhicules enregistrés sur votre compte.");
    setText("#history p", "Retrouvez ici l’historique de vos demandes.");
    setText("#about .lead", "EDM AUTO vous permet de préparer simplement votre demande mécanique en ligne avant reprise manuelle. L’objectif est de vous faire gagner du temps et de clarifier les prestations souhaitées avant validation.");

    const aboutCards = qsa("#about .grid-3 .card");
    if (aboutCards[0]) aboutCards[0].innerHTML = '<span class="pill green">Clair</span><h3 style="margin-top:12px">Demande lisible</h3><p>Vous renseignez votre besoin et obtenez une estimation simple à comprendre.</p>';
    if (aboutCards[1]) aboutCards[1].innerHTML = '<span class="pill blue">Pratique</span><h3 style="margin-top:12px">Préparation rapide</h3><p>Le site vous aide à préparer votre demande avant reprise par EDM AUTO.</p>';
    if (aboutCards[2]) aboutCards[2].innerHTML = '<span class="pill orange">Humain</span><h3 style="margin-top:12px">Validation manuelle</h3><p>Chaque demande est vérifiée manuellement avant confirmation finale.</p>';

    const aboutNotice = qs("#about .notice");
    if (aboutNotice) {
      aboutNotice.textContent = "Chaque demande est reprise manuellement par EDM AUTO après étude du véhicule, des prestations souhaitées et du panier sélectionné.";
    }
  }

  function patchVehicleSection() {
    setText("#vehicleCard .section-title p", "Renseignez manuellement les informations utiles de votre véhicule pour préparer votre demande.");
    const badge = qs("#vehicleCard .pill");
    if (badge) {
      badge.textContent = "Saisie manuelle";
      badge.className = "pill blue";
    }

    hide(document.getElementById("btnDetectPlate"));
    hide(document.getElementById("plateStatus"));
    hide(document.getElementById("vehicleResult"));

    const engine = document.getElementById("engine")?.closest("label");
    const emissions = document.getElementById("emissions")?.closest("label");
    hide(engine);
    hide(emissions);
  }

  function patchServicesAndCombo() {
    setText("#servicesArea .card .section-title p", "Choisissez les prestations souhaitées pour obtenir une estimation plus claire de votre demande.");
    const badge = qsa("#servicesArea .section-title .pill.orange")[0];
    if (badge) badge.style.display = "none";

    const toolbar = qs(".service-toolbar");
    if (toolbar && !document.getElementById("comboExplainBtn")) {
      const wrap = document.createElement("div");
      wrap.style.margin = "12px 0 0";
      wrap.innerHTML = `
        <button class="btn btn-ghost" id="comboExplainBtn" type="button">Combo -30% ?</button>
        <div id="comboExplainBox" class="infobox hidden" style="margin-top:10px">
          Lorsque plusieurs prestations compatibles sont réalisées ensemble sur la même intervention, une remise de 30% peut être appliquée sur la prestation éligible la moins chère.
        </div>
      `;
      toolbar.insertAdjacentElement("afterend", wrap);
      document.getElementById("comboExplainBtn").addEventListener("click", () => {
        document.getElementById("comboExplainBox")?.classList.toggle("hidden");
      });
    }
  }

  function patchBasketSection() {
    window.BASKETS.eco.desc = "Pièces compatibles / adaptables / premier prix.";
    window.BASKETS.standard.desc = "Pièces milieu de gamme, bon équilibre prix / qualité.";
    window.BASKETS.premium.desc = "Pièces haut de gamme, qualité et durabilité renforcées.";
    window.BASKETS.eco.extra = 0;
    window.BASKETS.standard.extra = 0;
    window.BASKETS.premium.extra = 0;

    setText("#servicesArea .card:nth-of-type(2) .section-title h3", "4. Paniers de pièces");
    setText("#servicesArea .card:nth-of-type(2) .section-title p", "Choisissez le niveau de panier qui correspond le mieux à votre budget et à la qualité de pièces souhaitée.");
    hide(document.getElementById("btnAiBasket"));
    hide(document.getElementById("aiPanel"));
  }

  function patchPreparationBlock() {
    setText("#servicesArea .summary-grid .card h3", "Contrôle préalable avant réparation");
    const cards = qsa("#servicesArea .check-card");
    if (cards[0]) {
      cards[0].innerHTML = '<input type="checkbox" id="j7Accepted" checked><span><b>Je souhaite ajouter le contrôle général du véhicule avant réparation : 30 €</b><span class="field-hint">Un contrôle général du véhicule peut être effectué avant la réparation pour un montant de 30 €. Ce contrôle permet de mieux préparer l’intervention et de limiter les erreurs ou imprévus avant la réparation.</span></span>';
    }
    if (cards[1]) {
      cards[1].innerHTML = '<input type="checkbox" id="refuseControl"><span><b>Je refuse le contrôle préalable</b><span class="field-hint">En cas de refus du contrôle préalable, la préparation de l’intervention se fera sur la base des informations transmises avant le rendez-vous. Si le panier de pièces a été préparé par EDM AUTO et qu’une erreur de compatibilité provient de notre sélection, EDM AUTO en assumera la responsabilité. Si le client apporte lui-même ses pièces et que celles-ci s’avèrent incompatibles, 70 % de la main-d’œuvre prévue sera facturée.</span></span>';
    }
  }

  function patchSummaryLabels() {
    const lines = qsa("#summaryBox .summary-line");
    if (lines[0]) lines[0].querySelector("span").textContent = "Main-d’œuvre estimée";
    if (lines[1]) lines[1].querySelector("span").textContent = "Remise combo";
    if (lines[2]) hide(lines[2]);
    if (lines[3]) lines[3].querySelector("span").textContent = "Contrôle préalable";
    if (lines[4]) lines[4].querySelector("span").textContent = "Pièces estimées";
    if (lines[5]) lines[5].querySelector("span").textContent = "Économie combo";
    if (lines[6]) lines[6].querySelector("span").textContent = "Total estimé tout compris";
    const notice = qs("#servicesArea .summary-grid .card:last-child .notice");
    if (notice) notice.textContent = "Cette estimation est donnée à titre indicatif. Elle aide à préparer la demande, mais la validation finale des pièces et du montant reste faite manuellement.";
    setText("#btnSubmit", "Envoyer ma demande pour étude");
  }

  function patchBranding() {
    const sub = qs(".brand-sub");
    if (sub) sub.innerHTML = 'Mécano du Dimanche<br>Demande simple · estimation · reprise manuelle';
    const side = qsa(".sidebar-card");
    if (side[0]) side[0].innerHTML = "<b>Non connecté</b><br>Connectez-vous pour retrouver votre garage et vos demandes.";
    if (side[1]) side[1].innerHTML = "<b>Fonctionnement actuel</b><br>Le site prépare votre demande et votre estimation. La validation finale reste faite manuellement par EDM AUTO.";
  }

  function installStyleOverrides() {
    const style = document.createElement("style");
    style.textContent = `
      #btnLoadLocal, #btnDetectPlate, #btnAiBasket, #aiPanel, #vehicleResult { display:none !important; }
      .basket-top .pill { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function syncControlCheckboxes() {
    const a = document.getElementById("j7Accepted");
    const b = document.getElementById("refuseControl");
    if (!a || !b) return;
    a.addEventListener("change", () => {
      if (a.checked) b.checked = false;
      if (typeof updateSummary === "function") updateSummary();
    });
    b.addEventListener("change", () => {
      if (b.checked) a.checked = false;
      if (typeof updateSummary === "function") updateSummary();
    });
  }

  function patchNavigationAndAccountPage() {
    const nav = qs(".nav");
    if (nav && !nav.querySelector('[data-page="account"]')) {
      const button = document.createElement("button");
      button.dataset.page = "account";
      button.textContent = "👤 Mon compte";
      nav.insertBefore(button, nav.querySelector('[data-page="garage"]') || null);
      button.addEventListener("click", () => {
        if (typeof showPage === "function") showPage("account");
      });
    }

    if (!document.getElementById("account")) {
      const main = qs("main.main");
      const section = document.createElement("section");
      section.id = "account";
      section.className = "page";
      section.innerHTML = `
        <div class="panel">
          <div class="section-title">
            <div>
              <h2>Mon compte</h2>
              <p>Retrouvez ici les informations liées à votre compte client.</p>
            </div>
          </div>
          <div id="accountPageContent"></div>
        </div>
      `;
      main.appendChild(section);
    }
  }

  async function deleteCurrentAccount() {
    if (!window.state?.user?.id) {
      if (typeof toast === "function") toast("Aucun compte connecté.");
      return;
    }

    const confirmed = window.confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est définitive.");
    if (!confirmed) return;

    try {
      const { data } = await supabaseClient.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error("Session introuvable.");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Suppression du compte indisponible pour le moment.");
      }

      await supabaseClient.auth.signOut();
      window.state = { user: null, vehicles: [], requests: [] };
      if (typeof saveState === "function") saveState();
      renderAccountPage();
      if (typeof toast === "function") toast("Compte supprimé.");
      if (typeof showPage === "function") showPage("home");
    } catch (error) {
      const box = qs("#accountDeleteStatus");
      if (box) {
        box.innerHTML = `<div class="errorbox"><strong>Suppression impossible.</strong><br>${escapeHtml(error.message || "Réessaie plus tard.")}</div>`;
      }
      if (typeof toast === "function") toast("Suppression du compte indisponible.");
    }
  }

  function renderAccountPage() {
    const container = document.getElementById("accountPageContent");
    if (!container) return;

    if (!window.state?.user?.id) {
      container.innerHTML = `
        <div class="empty">
          Connectez-vous pour consulter votre compte client.
        </div>
      `;
      return;
    }

    const user = window.state.user;
    container.innerHTML = `
      <div class="grid">
        <div class="card">
          <h3>Informations du compte</h3>
          <div class="summary" style="margin-top:14px">
            <div class="summary-line"><span>Nom</span><strong>${escapeHtml(user.lastName || "-")}</strong></div>
            <div class="summary-line"><span>Prénom</span><strong>${escapeHtml(user.firstName || "-")}</strong></div>
            <div class="summary-line"><span>Téléphone</span><strong>${escapeHtml(user.phone || "-")}</strong></div>
            <div class="summary-line"><span>Email</span><strong>${escapeHtml(user.email || "-")}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Actions sur le compte</h3>
          <p style="margin-top:12px">Vous pouvez vous déconnecter ou demander la suppression définitive de votre compte.</p>
          <div class="btn-row">
            <button class="btn btn-secondary" id="accountSignOutBtn" type="button">Se déconnecter</button>
            <button class="btn btn-danger" id="accountDeleteBtn" type="button">Supprimer mon compte</button>
          </div>
          <div id="accountDeleteStatus" style="margin-top:12px"></div>
        </div>
      </div>
    `;

    qs("#accountSignOutBtn")?.addEventListener("click", async () => {
      if (typeof signOutFromSupabase === "function") {
        await signOutFromSupabase();
      } else {
        await supabaseClient.auth.signOut();
      }
      renderAccountPage();
      if (typeof showPage === "function") showPage("home");
    });

    qs("#accountDeleteBtn")?.addEventListener("click", deleteCurrentAccount);
  }

  function wrapAccountUiRefresh() {
    if (typeof window.updateAccountUi !== "function") return;
    const base = window.updateAccountUi;
    window.updateAccountUi = function () {
      base();
      lockClientFieldsIfConnected();
      renderAccountPage();
    };
  }

  function overrideValidationAndTotals() {
    const baseValidate = window.validateBeforeServices;
    window.validateBeforeServices = function () {
      if (!window.state?.user?.id) {
        if (typeof setAuthStatus === "function") {
          setAuthStatus("Créez un compte ou connectez-vous avant de pouvoir continuer.", true);
        }
        if (typeof toast === "function") toast("Connexion obligatoire avant de prendre RDV.");
        return false;
      }
      return baseValidate ? baseValidate() : true;
    };

    window.calculateTotals = function (showAlert = false) {
      const selected = typeof getSelectedServices === "function" ? getSelectedServices() : [];
      if (showAlert && !selected.length) {
        if (typeof toast === "function") toast("Sélectionne au moins une prestation.");
        return null;
      }

      let laborBase = 0;
      let partsMin = 0;
      let partsMax = 0;
      const eligible = [];

      selected.forEach((service) => {
        laborBase += Number(service.labor || 0);
        partsMin += Number(service.parts[selectedBasket]?.[0] || 0);
        partsMax += Number(service.parts[selectedBasket]?.[1] || 0);
        if (service.eligible && !service.excluded) eligible.push(service);
      });

      let comboSaving = 0;
      let discountServiceId = "";
      if (eligible.length >= 2) {
        const cheapest = [...eligible].sort((a, b) => a.labor - b.labor)[0];
        comboSaving = Math.round(cheapest.labor * 0.30 * 100) / 100;
        discountServiceId = cheapest.id;
      }

      const controlFee = document.getElementById("j7Accepted")?.checked ? 30 : 0;
      const laborAfter = Math.round((laborBase - comboSaving + controlFee) * 100) / 100;
      const totalAllMin = Math.round((laborAfter + partsMin) * 100) / 100;
      const totalAllMax = Math.round((laborAfter + partsMax) * 100) / 100;

      return {
        selected,
        laborBase,
        partsMin,
        partsMax,
        basketExtra: 0,
        totalBefore: laborBase,
        comboSaving,
        discountServiceId,
        j7Saving: controlFee,
        immobilisation: 0,
        laborAfter,
        totalAllMin,
        totalAllMax
      };
    };

    window.updateSummary = function () {
      const totals = window.calculateTotals(false) || { laborBase: 0, comboSaving: 0, j7Saving: 0, partsMin: 0, partsMax: 0, laborAfter: 0, totalAllMin: 0, totalAllMax: 0 };
      const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setVal("laborBefore", money(totals.laborBase || 0));
      setVal("comboSaving", `-${money(totals.comboSaving || 0)}`);
      setVal("j7Saving", money(totals.j7Saving || 0));
      setVal("partsTotal", `${money(totals.partsMin || 0)} à ${money(totals.partsMax || 0)}`);
      setVal("totalSaving", money(totals.comboSaving || 0));
      setVal("laborAfter", `${money(totals.totalAllMin || 0)} à ${money(totals.totalAllMax || 0)}`);
    };

    window.renderBaskets = function () {
      const box = document.getElementById("basketList");
      if (!box) return;
      box.innerHTML = Object.entries(BASKETS).map(([key, basket]) => {
        const totalsForBasket = typeof sumPartsForBasket === "function" ? sumPartsForBasket(key) : { min: 0, max: 0 };
        return `<article class="basket-card ${selectedBasket === key ? "selected" : ""}" data-basket="${key}">
          <div class="basket-top">
            <div><div class="basket-title">${basket.label}</div><p>${escapeHtml(basket.desc)}</p></div>
          </div>
          <div class="basket-price">Pièces estimées : ${money(totalsForBasket.min)} à ${money(totalsForBasket.max)}</div>
          <p class="small">Sélectionnez ce niveau de panier pour orienter la préparation de votre demande.</p>
          <div class="basket-ai"><strong>${selectedBasket === key ? "Sélectionné" : "Disponible"}</strong></div>
        </article>`;
      }).join("");

      qsa(".basket-card").forEach((card) => card.addEventListener("click", () => {
        selectedBasket = card.dataset.basket;
        window.renderBaskets();
        if (typeof renderServices === "function") renderServices();
        if (typeof updateSummary === "function") updateSummary();
      }));
    };
  }

  function patchSubmitMessage() {
    const baseSubmit = window.submitRequest;
    window.submitRequest = async function () {
      await baseSubmit();
      const ok = document.querySelector("#submitStatus .okbox");
      if (ok) {
        ok.innerHTML = "<strong>Demande transmise.</strong><br>EDM AUTO reviendra vers vous après étude de votre véhicule et des prestations demandées.";
      }
    };
  }

  function init() {
    installStyleOverrides();
    patchBranding();
    enforceAccountUi();
    patchHeroAndStaticTexts();
    patchVehicleSection();
    patchServicesAndCombo();
    patchBasketSection();
    patchPreparationBlock();
    patchSummaryLabels();
    patchNavigationAndAccountPage();
    wrapAccountUiRefresh();
    overrideValidationAndTotals();
    patchSubmitMessage();
    syncControlCheckboxes();
    if (typeof renderBaskets === "function") renderBaskets();
    if (typeof renderServices === "function") renderServices();
    if (typeof updateSummary === "function") updateSummary();
    lockClientFieldsIfConnected();
    renderAccountPage();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
})();
