(() => {
  if (window.__edmAccountCompatibility) return;
  window.__edmAccountCompatibility = true;

  function first() {
    for (const item of arguments) {
      const value = String(item || '').trim();
      if (value) return value;
    }
    return '';
  }

  function field(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  window.hydrateUserFromSupabase = async function (user) {
    if (!user || typeof state === 'undefined') return;
    let profile = null;
    try {
      const result = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!result.error) profile = result.data;
    } catch (_) {}
    const current = state.user || {};
    const meta = user.user_metadata || {};
    state.user = {
      id: first(user.id, current.id),
      firstName: first(field('firstName'), current.firstName, profile?.first_name, meta.first_name),
      lastName: first(field('lastName'), current.lastName, profile?.last_name, meta.last_name),
      phone: first(field('phone'), current.phone, profile?.phone, meta.phone),
      email: first(user.email, field('email'), current.email, profile?.email).toLowerCase()
    };
    if (typeof saveState === 'function') saveState();
  };

  const protectedPages = new Set(['account', 'garage', 'history', 'messages']);
  protectedPages.add('disbursements');
  const baseShowPage = window.showPage;
  if (typeof baseShowPage === 'function') {
    window.showPage = function (pageId) {
      if (protectedPages.has(pageId) && !state?.user?.id) {
        baseShowPage('appointment');
        document.getElementById('email')?.focus();
        return;
      }
      baseShowPage(pageId);
    };
  }

  window.renderSafeAccount = () => window.showPage?.('account');
})();