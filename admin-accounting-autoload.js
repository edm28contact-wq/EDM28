(() => {
  let loaded = false;
  const timer = setInterval(async () => {
    const app = window.EDMAdmin;
    const mod = window.EDMAdminAccounting;
    if (loaded || !app?.profile || !mod || !document.getElementById('accountingTable')) return;
    loaded = true;
    clearInterval(timer);
    try { await mod.load(); }
    catch (error) { app.status('accountingStatus', error.message, true); }
  }, 150);
})();