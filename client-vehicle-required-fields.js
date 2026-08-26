(() => {
  if (window.__edmVehicleRequiredFieldsInstalled) return;
  window.__edmVehicleRequiredFieldsInstalled = true;

  const OPTIONAL_IDS = ['mileage', 'brand', 'model', 'year', 'energy'];

  function labelFor(input) {
    return input?.closest('label') || null;
  }

  function markOptional(input) {
    if (!input) return;
    input.required = false;
    input.removeAttribute('aria-required');
    const label = labelFor(input);
    if (!label || label.dataset.edmOptionalMarked === '1') return;
    label.dataset.edmOptionalMarked = '1';
    const firstText = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (firstText && !/facultatif/i.test(firstText.textContent)) firstText.textContent = `${firstText.textContent.trim()} (facultatif) `;
  }

  function install() {
    const plate = document.getElementById('plate');
    if (plate) {
      plate.required = true;
      plate.setAttribute('aria-required', 'true');
      const label = labelFor(plate);
      if (label && label.dataset.edmRequiredMarked !== '1') {
        label.dataset.edmRequiredMarked = '1';
        const firstText = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (firstText && !/obligatoire/i.test(firstText.textContent)) firstText.textContent = `${firstText.textContent.trim()} * `;
      }
    }

    OPTIONAL_IDS.forEach((id) => markOptional(document.getElementById(id)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();