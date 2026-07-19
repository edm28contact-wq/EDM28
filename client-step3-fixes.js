(() => {
  const selectedServiceIds = new Set();

  const waitForApp = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (
        typeof renderServices === 'function' &&
        typeof getSelectedServices === 'function' &&
        typeof calculateTotals === 'function' &&
        typeof money === 'function'
      ) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const syncVisibleSelections = () => {
    document.querySelectorAll('.service-check').forEach((input) => {
      if (input.checked) selectedServiceIds.add(input.value);
      else selectedServiceIds.delete(input.value);
    });
  };
