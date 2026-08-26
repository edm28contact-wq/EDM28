(() => {
  if (window.__edmDisbursementInvoiceLockInstalled) return;
  window.__edmDisbursementInvoiceLockInstalled = true;

  function lockLine(line) {
    if (!line || line.dataset.disbursementLocked === '1') return;
    const description = line.querySelector('[data-line="description"]');
    if (!/^Débours client\s*[—-]/i.test(String(description?.value || '').trim())) return;
    line.dataset.disbursementLocked = '1';
    const type = line.querySelector('[data-line="type"]');
    if (type) {
      let option = [...type.options].find((item) => item.value === 'disbursement');
      if (!option) {
        option = document.createElement('option');
        option.value = 'disbursement';
        option.textContent = 'Débours client';
        type.appendChild(option);
      }
      type.value = 'disbursement';
    }
    line.querySelectorAll('[data-line]').forEach((field) => { field.disabled = true; });
    line.querySelector('[data-remove-line]')?.remove();
    const note = document.createElement('div');
    note.className = 'status ok';
    note.style.marginTop = '10px';
    note.textContent = 'Ligne de débours verrouillée : montant exact du justificatif, TVA 0 %, coût d’achat identique et marge 0 €.';
    line.appendChild(note);
  }

  function scan(root = document) {
    root.querySelectorAll?.('[data-invoice-line]').forEach(lockLine);
  }

  function install() {
    scan();
    const host = document.getElementById('invoiceActionList');
    if (!host) return;
    new MutationObserver(() => scan(host)).observe(host, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();