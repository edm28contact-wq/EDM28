(() => {
  const STORAGE_KEY = 'edm28_pending_request_v2';

  const waitForApp = async () => {
    for (let i = 0; i < 120; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof calculateTotals === 'function' && typeof getVehicle === 'function' && document.getElementById('btnSubmit')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false