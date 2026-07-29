(() => {
  if (window.__edmClientAuthPersistenceInstalled) return;
  window.__edmClientAuthPersistenceInstalled = true;

  const PREFERENCE_KEY = 'edm_client_remember';
  const originalCreateClient = window.supabase?.createClient?.bind(window.supabase);
  if (!originalCreateClient) return;

  const safeGet = (storage, key) => { try { return storage.getItem(key); } catch (_) { return null; } };
  const safeSet = (storage, key, value) => { try { storage.setItem(key, value); } catch (_) {} };
  const safeRemove = (storage, key) => { try { storage.removeItem(key); } catch (_) {} };
  const rememberEnabled = () => safeGet(localStorage, PREFERENCE_KEY) !== '0';

  const authStorage = {
    getItem(key) {
      const primary = rememberEnabled() ? localStorage : sessionStorage;
      const secondary = rememberEnabled() ? sessionStorage : localStorage;
      return safeGet(primary, key) ?? safeGet(secondary, key);
    },
    setItem(key, value) {
      const primary = rememberEnabled() ? localStorage : sessionStorage;
      const secondary = rememberEnabled() ? sessionStorage : localStorage;
      safeSet(primary, key, value);
      safeRemove(secondary, key);
    },
    removeItem(key) {
      safeRemove(localStorage, key);
      safeRemove(sessionStorage, key);
    }
  };

  window.supabase.createClient = (url, key, options = {}) => {
    const client = originalCreateClient(url, key, {
      ...options,
      auth: {
        ...(options.auth || {}),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage
      }
    });
    window.__edmClientSupabase = client;
    return client;
  };

  async function migrateCurrentSession() {
    const client = window.__edmClientSupabase;
    if (!client?.auth) return;
    const { data } = await client.auth.getSession();
    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) return;
    await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  }

  function installControl() {
    const card = document.getElementById('clientCard');
    if (!card || document.getElementById('rememberClient')) return;
    const label = document.createElement('label');
    label.className = 'remember-session';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.marginTop = '12px';
    label.innerHTML = '<input id="rememberClient" type="checkbox"> Rester connecté sur cet appareil';
    const actions = card.querySelector('.btn-row');
    card.insertBefore(label, actions || document.getElementById('authStatus'));
    const input = label.querySelector('input');
    input.checked = rememberEnabled();
    input.addEventListener('change', () => {
      safeSet(localStorage, PREFERENCE_KEY, input.checked ? '1' : '0');
      migrateCurrentSession().catch(() => {});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControl, { once: true });
  else installControl();
})();