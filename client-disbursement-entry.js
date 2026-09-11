(() => {
  if (window.__edmDisbursementEntryInstalled) return;
  window.__edmDisbursementEntryInstalled = true;

  const BILLING_KEY = 'edm28_disbursement_billing';

  function navigate() {
    if (typeof window.__edmNavigate === 'function') return window.__edmNavigate('disbursements');
    const button = document.querySelector('[data-page="disbursements"]');
    if (button) button.click();
    else if (typeof showPage === 'function') showPage('disbursements');
  }

  function normalizeCopy() {
    const option = document.querySelector('.edm-parts-option input[value="edm_disbursement"]')?.closest('.edm-parts-option');
    const paragraph = option?.querySelector('p');
    if (paragraph) paragraph.textContent = 'Vous mandatez EDM28 pour acheter les pièces en votre nom et pour votre compte. Après validation du plafond, vous payez une provision en ligne avant toute commande. Le débours définitif correspond au justificatif fournisseur exact, sans marge ni commission ; tout trop-perçu est remboursé.';
    const notice = document.querySelector('#edmPartsPurchaseChoice .notice');
    if (notice) notice.innerHTML = '<strong>Débours :</strong> après ce choix, vous accédez à la page dédiée pour renseigner vos coordonnées. Le paiement n’est demandé qu’après validation du devis et du mandat.';
  }

  async function persistBillingAfterSubmission(requestId) {
    if (!requestId || typeof supabaseClient === 'undefined') return;
    let billing = null;
    try { billing = JSON.parse(localStorage.getItem(BILLING_KEY) || 'null'); } catch (_) {}
    if (!billing?.address || !billing?.postal_code || !billing?.city || !billing?.country) return;
    const result = await supabaseClient.rpc('client_save_disbursement_billing', { p_request_id: requestId, p_billing: billing });
    if (result.error) console.warn('EDM disbursement billing sync unavailable', result.error);
  }

  document.addEventListener('change', (event) => {
    const input = event.target.closest?.('input[name="partsPurchaseMode"]');
    if (!input || input.value !== 'edm_disbursement' || !input.checked) return;
    window.setTimeout(() => {
      normalizeCopy();
      navigate();
      window.EDMClientDisbursements?.load?.().catch(() => {});
    }, 0);
  }, true);

  window.addEventListener('edm:request-submitted', (event) => {
    void persistBillingAfterSubmission(event.detail?.requestId);
  });

  const observer = new MutationObserver(() => normalizeCopy());
  function install() {
    normalizeCopy();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
