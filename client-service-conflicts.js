(() => {
  if (window.__edmServiceConflictsInstalled) return;
  window.__edmServiceConflictsInstalled = true;

  const COMPONENTS = {
    FR_PLAQ_AV: ['plaquettes_av'],
    FR_PLAQ_AR: ['plaquettes_ar'],
    FR_PLAQ_AV_AR: ['plaquettes_av', 'plaquettes_ar'],
    FR_DISC_PLAQ_AV: ['disques_av', 'plaquettes_av'],
    FR_DISC_PLAQ_AR: ['disques_ar', 'plaquettes_ar'],
    FR_DISC_PLAQ_AV_AR: ['disques_av', 'plaquettes_av', 'disques_ar', 'plaquettes_ar']
  };

  const labels = {
    FR_PLAQ_AV: 'Plaquettes de frein avant',
    FR_PLAQ_AR: 'Plaquettes de frein arrière',
    FR_PLAQ_AV_AR: 'Plaquettes de frein avant et arrière',
    FR_DISC_PLAQ_AV: 'Disques et plaquettes de frein avant',
    FR_DISC_PLAQ_AR: 'Disques et plaquettes de frein arrière',
    FR_DISC_PLAQ_AV_AR: 'Disques et plaquettes de frein avant et arrière'
  };

  const conflicts = (left, right) => {
    if (left === right) return false;
    const a = COMPONENTS[left];
    const b = COMPONENTS[right];
    if (!a || !b) return false;
    return a.some((component) => b.includes(component));
  };

  function ensureNotice() {
    const host = document.getElementById('serviceList');
    if (!host || document.getElementById('edmServiceConflictNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'edmServiceConflictNotice';
    notice.className = 'notice';
    notice.style.marginBottom = '14px';
    notice.innerHTML = '<strong>Prestations cohérentes :</strong> deux prestations qui couvrent la même opération sur le même essieu ne peuvent pas être sélectionnées ensemble. Si vous choisissez une prestation plus complète, elle remplace automatiquement la prestation déjà sélectionnée.';
    host.insertAdjacentElement('beforebegin', notice);
  }

  function refreshConflictHints() {
    const selected = typeof getSelectedServiceIds === 'function' ? getSelectedServiceIds() : [];
    document.querySelectorAll('.service-card').forEach((card) => {
      const input = card.querySelector('.service-check');
      if (!input) return;
      const blockers = selected.filter((id) => id !== input.value && conflicts(input.value, id));
      card.classList.toggle('edm-service-conflict', !input.checked && blockers.length > 0);
      card.title = blockers.length && !input.checked
        ? `Remplacera : ${blockers.map((id) => labels[id] || id).join(', ')}`
        : '';
    });
  }

  function installStyles() {
    if (document.getElementById('edm-service-conflicts-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-service-conflicts-style';
    style.textContent = `
      .service-card.edm-service-conflict { border-style:dashed; }
      .service-card.edm-service-conflict::after {
        content:'Remplace une prestation déjà sélectionnée';
        display:block;
        margin-top:10px;
        color:var(--muted);
        font-size:.82rem;
        font-weight:800;
      }
    `;
    document.head.appendChild(style);
  }

  function reconcile(chosenId) {
    if (!chosenId || !COMPONENTS[chosenId] || typeof getSelectedServiceIds !== 'function') return [];
    const selected = getSelectedServiceIds();
    const removed = selected.filter((id) => id !== chosenId && conflicts(chosenId, id));
    if (!removed.length) return [];

    document.querySelectorAll('.service-check').forEach((input) => {
      if (removed.includes(input.value)) input.checked = false;
    });

    // client-step3-fixes.js synchronise son Set interne depuis les cases visibles.
    getSelectedServiceIds();
    return removed;
  }

  document.addEventListener('change', (event) => {
    const input = event.target.closest?.('.service-check');
    if (!input || !input.checked) return;
    const chosenId = input.value;
    queueMicrotask(() => {
      const removed = reconcile(chosenId);
      if (removed.length) {
        const names = removed.map((id) => labels[id] || id).join(', ');
        if (typeof toast === 'function') toast(`${names} retiré${removed.length > 1 ? 'es' : ''} : la nouvelle prestation couvre déjà la même opération.`);
        if (typeof renderServices === 'function') renderServices();
        if (typeof renderBaskets === 'function') renderBaskets();
        if (typeof updateSummary === 'function') updateSummary();
      }
      ensureNotice();
      refreshConflictHints();
    });
  }, true);

  const observer = new MutationObserver(() => {
    ensureNotice();
    refreshConflictHints();
  });

  function install() {
    installStyles();
    ensureNotice();
    refreshConflictHints();
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
