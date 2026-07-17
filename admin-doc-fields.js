(() => {
  const timer = setInterval(() => {
    const desc = document.getElementById('docDescription');
    if (!desc || document.getElementById('docSubtotal')) return;
    clearInterval(timer);
    const host = desc.closest('.card');
    const block = document.createElement('div');
    block.className = 'grid2';
    block.innerHTML = '<label class="field"><span>Sous-total HT *</span><input id="docSubtotal" type="number" min="0" step="0.01" value="0"></label><label class="field"><span>Remise</span><input id="docDiscount" type="number" min="0" step="0.01" value="0"></label><label class="field"><span>Validité / échéance</span><input id="docDueDate" type="date"></label><label class="field"><span>Kilométrage</span><input id="docMileage" type="number" min="0" step="1"></label>';
    host.insertBefore(block, document.getElementById('createDraftBtn'));
  }, 100);
})();