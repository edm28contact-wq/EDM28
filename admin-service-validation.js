(() => {
  const timer = setInterval(() => {
    const app = window.EDMAdmin;
    const mod = window.EDMAdminServices;
    if (!app || !mod) return;
    clearInterval(timer);
    const original = mod.save.bind(mod);
    mod.save = async (old) => {
      const name = app.$('svcName')?.value.trim() || '';
      const category = app.$('svcCategory')?.value.trim() || '';
      const price = Number(app.$('svcPrice')?.value || 0);
      const duration = Number(app.$('svcDuration')?.value || 0);
      app.markRequired(app.$('svcName'), !name);
      app.markRequired(app.$('svcCategory'), !category);
      app.markRequired(app.$('svcPrice'), price < 0);
      app.markRequired(app.$('svcDuration'), duration <= 0);
      if (!name || !category || price < 0 || duration <= 0) {
        alert('Nom, catégorie et durée valides obligatoires. Le prix ne peut pas être négatif.');
        return;
      }
      return original(old);
    };
  }, 100);

  let accountingLoaded = false;
  const accountingTimer = setInterval(async () => {
    const app = window.EDMAdmin;
    const accounting = window.EDMAdminAccounting;
    if (accountingLoaded || !app?.profile || !accounting) return;
    accountingLoaded = true;
    clearInterval(accountingTimer);
    try { await accounting.load(); }
    catch (error) { app.status('accountingStatus', error.message, true); }
  }, 150);
})();