(() => {
  const $ = (id) => document.getElementById(id);
  const waitForApp = async () => {
    for (let i = 0; i < 100; i += 1) {
      if (typeof supabaseClient !== 'undefined' && typeof hydrateUserFromSupabase === 'function' && $('clientCard')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const friendly = (error) => {
    const text = String