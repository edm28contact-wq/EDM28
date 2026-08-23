(() => {
  if (window.__edmAdminResetInstalled) return;
  window.__edmAdminResetInstalled = true;

  const CONFIRMATION = 'REINITIALISER EDM28';
  const A = () => window.EDMAdmin;

  const chunk = (items, size) => {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result;
  };

  async function purgeRepairDocuments(status) {
    status.textContent = 'Suppression des fichiers clients…';
    const pathsResult = await A().db.rpc('admin_reset_storage_paths');
    if (pathsResult.error) throw pathsResult.error;
    const paths = Array.isArray(pathsResult.data) ? pathsResult.data.filter(Boolean) : [];
    let removed = 0;
    for (const batch of chunk(paths, 100)) {
      const result = await A().db.storage.from('repair-documents').remove(batch);
      if (result.error) throw result.error;
      removed += batch.length;
      status.textContent = `Suppression des fichiers clients… ${removed}/${paths.length}`;
    }
    return removed;
  }

  async function executeReset(status) {
    const removedFiles = await purgeRepairDocuments(status);
    status.textContent = 'Suppression des données clients et remise à zéro des dossiers…';
    const result = await A().db.rpc('admin_reset_operational_data', { p_confirmation: CONFIRMATION });
    if (result.error) throw result.error;
    return { ...(result.data || {}), removed_files: removedFiles };
  }

  function openResetDialog() {
    document.getElementById('edmResetOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'edmResetOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#101828aa;display:grid;place-items:center;padding:18px;';
    overlay.innerHTML = `<section class="card" style="width:min(620px,100%);max-height:92vh;overflow:auto;border:2px solid var(--bad)">
      <h2 style="margin-top:0;color:var(--bad)">Réinitialisation totale des données</h2>
      <p><strong>Cette action est irréversible.</strong> Elle supprime toutes les données d’exploitation et tous les comptes clients.</p>
      <p class="muted">Seront supprimés : clients, véhicules, demandes, devis, rendez-vous, OR, interventions, contrôles, factures, paiements, messages, brouillons, documents, photos, signatures, mouvements et journaux associés. Les numéros de documents repartent de zéro.</p>
      <p><strong>Restent conservés :</strong> comptes administrateurs, configuration du garage, horaires, services/prix, modèles, automatisations et catalogue de stock.</p>
      <label style="display:grid;gap:7px;margin-top:16px"><strong>Pour confirmer, saisissez exactement :</strong><code>${CONFIRMATION}</code><input id="edmResetPhrase" autocomplete="off" spellcheck="false" style="padding:11px;border:1px solid #d0d5dd;border-radius:12px"></label>
      <div id="edmResetStatus" class="status hidden" aria-live="polite"></div>
      <div class="toolbar" style="justify-content:flex-end;margin-top:18px">
        <button type="button" class="btn ghost" id="edmResetCancel">Annuler</button>
        <button type="button" class="btn danger" id="edmResetConfirm" disabled>Supprimer et remettre à zéro</button>
      </div>
    </section>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#edmResetPhrase');
    const confirm = overlay.querySelector('#edmResetConfirm');
    const cancel = overlay.querySelector('#edmResetCancel');
    const status = overlay.querySelector('#edmResetStatus');
    input.addEventListener('input', () => { confirm.disabled = input.value.trim() !== CONFIRMATION; });
    cancel.onclick = () => overlay.remove();
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    input.focus();

    confirm.onclick = async () => {
      if (input.value.trim() !== CONFIRMATION) return;
      confirm.disabled = true;
      cancel.disabled = true;
      input.disabled = true;
      status.className = 'status';
      status.textContent = 'Réinitialisation en cours…';
      try {
        const summary = await executeReset(status);
        status.className = 'status ok';
        status.textContent = `Réinitialisation terminée. ${Number(summary.removed_files || 0)} fichier(s) supprimé(s), ${Number(summary.deleted_auth_users || 0)} compte(s) client supprimé(s).`;
        window.setTimeout(() => window.location.reload(), 900);
      } catch (error) {
        status.className = 'status error';
        status.textContent = error?.message || 'Réinitialisation impossible.';
        confirm.disabled = false;
        cancel.disabled = false;
        input.disabled = false;
      }
    };
  }

  function installButton() {
    const logout = document.getElementById('logoutBtn');
    if (!logout || document.getElementById('resetDataBtn')) return false;
    const button = document.createElement('button');
    button.id = 'resetDataBtn';
    button.type = 'button';
    button.className = 'btn danger';
    button.textContent = 'Réinitialiser';
    button.title = 'Supprimer toutes les données d’exploitation';
    logout.parentElement?.insertBefore(button, logout);
    button.addEventListener('click', openResetDialog);
    return true;
  }

  if (!installButton()) {
    const observer = new MutationObserver(() => { if (installButton()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();