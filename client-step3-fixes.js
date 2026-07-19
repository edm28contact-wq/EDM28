(() => {
  const selectedServiceIds = new Set();

  const waitForApp = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (typeof window.renderServices === 'function' && typeof window.getSelectedServices === 'function' && typeof window.money === 'function') return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const syncVisibleSelections