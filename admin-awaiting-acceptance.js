(() => {
  if (window.__edmAwaitingAcceptanceInstalled) return;
  window.__edmAwaitingAcceptanceInstalled = true;

  const A = () => window.EDMAdmin;

  function ensureUi() {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard) return null;

    let button = nav.querySelector('[data-page="awaiting-acceptance"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'btn ghost';
      button.dataset.page = 'awaiting-acceptance';
      button.textContent = "En attente d’acceptation";
      const operationsButton = nav.querySelector('[data-page="operations"]');
      nav.insertBefore(button, operationsButton || null);
      button.addEventListener('click', () => {
        A()?.page('awaiting-acceptance');
        load().catch((error) => A()?.status('awaitingAcceptanceStatus', error.message || 'Devis en attente indisponibles.', true));
      });
    }

    let section = document.getElementById('awaiting-acceptance');
    if (!section) {
      section = document.createElement('section');
      section.id = 'awaiting-acceptance';
      section.className = 'page';
      section.innerHTML = `<div class="card">
        <div class="top"><div><h2>En attente d’acceptation</h2><p class="muted">Devis publiés au client qui n’ont pas encore été acceptés ou refusés.</p></div><button id="awaitingAcceptanceRefresh" class="btn ghost" type="button">Actualiser</button></div>
        <div id="awaitingAcceptanceStatus" class="status hidden"></div>
        <div id="awaitingAcceptanceList"></div>
      </div>`;
      const operations = document.getElementById('operations');
      dashboard.insertBefore(section, operations || null);
      section.querySelector('#awaitingAcceptanceRefresh').addEventListener('click', () => load().catch((error) => A()?.status('awaitingAcceptanceStatus', error.message || 'Actualisation impossible.', true)));
    }
    return section;
  }

  function render(rows) {
    const host = document.getElementById('awaitingAcceptanceList');
    if (!host) return;
    host.innerHTML = rows.length ? rows.map((quote) => {
      const profile = quote.profiles || {};
      const vehicle = quote.vehicles || {};
      const client = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Client';
      const vehicleLabel = [vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(' · ') || 'Véhicule non renseigné';
      const validUntil = quote.valid_until ? new Date(`${quote.valid_until}T00:00:00`).toLocaleDateString('fr-FR') : 'Non renseignée';
      return `<article class="card" style="margin:12px 0">
        <div class="top"><div><span class="pill">En attente</span><h3>${A().esc(quote.quote_number || 'Devis')}</h3></div><strong>${A().money(quote.total)}</strong></div>
        <div class="grid2">
          <div><h4>Client</h4><p><strong>${A().esc(client)}</strong><br>${A().esc(profile.phone || 'Téléphone non renseigné')}<br>${A().esc(profile.email || '')}</p></div>
          <div><h4>Véhicule</h4><p>${A().esc(vehicleLabel)}</p></div>
        </div>
        <p class="muted">Valable jusqu’au ${A().esc(validUntil)}.</p>
      </article>`;
    }).join('') : '<p class="muted">Aucun devis en attente d’acceptation.</p>';
  }

  async function load() {
    ensureUi();
    const host = document.getElementById('awaitingAcceptanceList');
    if (!host || !A()?.db) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const result = await A().db.from('quotes')
      .select('id,quote_number,total,valid_until,created_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model)')
      .eq('status', 'sent')
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    render(result.data || []);
  }

  function install() { ensureUi(); }

  window.EDMAdminAwaitingAcceptance = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
