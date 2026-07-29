(() => {
  if (window.__edmClientNoteGuidanceInstalled) return;
  window.__edmClientNoteGuidanceInstalled = true;

  function install() {
    const textarea = document.getElementById('clientNotes');
    if (!textarea) return false;

    textarea.placeholder = 'Exemple : symptômes constatés, marque ou gamme de pièces souhaitée, usage du véhicule, contraintes particulières...';

    const label = textarea.closest('label');
    if (!label || document.getElementById('clientNoteGuidance')) return true;

    const guidance = document.createElement('span');
    guidance.id = 'clientNoteGuidance';
    guidance.className = 'field-hint';
    guidance.textContent = 'N’hésitez pas à renseigner plus précisément la gamme de pièces souhaitée dans l’espace notes client.';
    textarea.insertAdjacentElement('beforebegin', guidance);
    textarea.setAttribute('aria-describedby', 'clientNoteGuidance');
    return true;
  }

  if (install()) return;

  const observer = new MutationObserver(() => {
    if (!install()) return;
    observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
})();
