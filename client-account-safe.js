(() => {
  if (window.__edmAccountCompatibility) return;
  window.__edmAccountCompatibility = true;

  function value(id) {
    const node = document.getElementById(id);
    return node && node.value ? node.value.trim() : '';
  }

  function firstValue() {
    for (let i = 0; i < arguments.length; i += 1) {
      const candidate = String(arguments[i] || '').trim();
      if (candidate) return candidate;
    }
    return '';
  }

  function mergeProfile(user, profile) {
    if (typeof state === 'undefined' || !state) return;
    const current = state.user || {};
    const meta = user && user.user_metadata ? user.user_metadata : {};
    state.user = {
      id: firstValue(user && user.id, current.id),
      firstName: firstValue(value('firstName'), current.firstName, profile && profile.first_name, meta.first_name),
      lastName: firstValue(value('lastName'), current.lastName, profile && profile.last_name, meta.last_name),
      phone: firstValue(value('phone'), current.phone, profile && profile.phone, meta.phone),
      email: firstValue(user && user.email, value('email'), current.email, profile && profile.email).toLowerCase()
    };

    ['firstName', 'lastName', 'phone', 'email'].forEach((id) => {
      const node = document.getElementById(id);
      if (node && state.user[id]) node.value = state.user[id];
    });

    if (typeof saveState === 'function') saveState();
  }

  window.hydrateUserFromSupabase = async function safeHydrateUser(user) {
    if (!user) return;
    let profile = null;
    try {
      if (typeof supabaseClient !== 'undefined') {
        const result = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (!result.error) profile = result.data;
      }
    } catch (_) {
      profile = null;
    }
    mergeProfile(user, profile);
  };

  window.renderSafeAccount = function renderSafeAccount() {
    if (typeof showPage === 'function') showPage('account');
  };
})();
