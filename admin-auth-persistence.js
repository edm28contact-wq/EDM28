(() => {
  if (window.__edmAdminAuthPersistenceInstalled) return;
  window.__edmAdminAuthPersistenceInstalled = true;

  const PREFERENCE_KEY = 'edm_admin_remember';
  const STORAGE_SCOPE = 'edm:admin';
  const originalCreateClient = window.supabase?.createClient?.bind(window.supabase);
  if (!originalCreateClient) return;

  const safeGet = (storage, key) => { try { return storage.getItem(key); } catch (_) { return null; } };
  const safeSet = (storage, key, value) => { try { storage.setItem(key, value); } catch (_) {} };
  const safeRemove = (storage, key) => { try { storage.removeItem(key); } catch (_) {} };
  const rememberEnabled = () => safeGet(localStorage, PREFERENCE_KEY) !== '0';
  const scopedKey = (key) => `${STORAGE_SCOPE}:${key}`;

  const authStorage = {
    getItem(key) {
      return safeGet(rememberEnabled() ? localStorage : sessionStorage, scopedKey(key));
    },
    setItem(key, value) {
      const persistent = rememberEnabled();
      const primary = persistent ? localStorage : sessionStorage;
      const secondary = persistent ? sessionStorage : localStorage;
      const targetKey = scopedKey(key);
      safeSet(primary, targetKey, value);
      safeRemove(secondary, targetKey);
    },
    removeItem(key) {
      const targetKey = scopedKey(key);
      safeRemove(localStorage, targetKey);
      safeRemove(sessionStorage, targetKey);
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
    window.__edmAdminSupabase = client;
    return client;
  };

  async function changePreference(enabled) {
    const client = window.__edmAdminSupabase;
    const currentPreference = rememberEnabled();
    if (!client?.auth) {
      safeSet(localStorage, PREFERENCE_KEY, enabled ? '1' : '0');
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    safeSet(localStorage, PREFERENCE_KEY, enabled ? '1' : '0');

    if (session?.access_token && session?.refresh_token) {
      const migrated = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      if (migrated.error) {
        safeSet(localStorage, PREFERENCE_KEY, currentPreference ? '1' : '0');
        throw migrated.error;
      }
    }
  }

  function installControl() {
    const panel = document.getElementById('loginPanel');
    if (!panel || document.getElementById('rememberAdmin')) return;
    const label = document.createElement('label');
    label.className = 'remember-session';
    label.innerHTML = '<input id="rememberAdmin" type="checkbox"> Rester connecté sur ce PC <span class="muted" style="font-weight:600">(à décocher sur un ordinateur partagé)</span>';
    const button = document.getElementById('loginBtn') || document.getElementById('adminOtpSend');
    panel.insertBefore(label, button || panel.querySelector('[data-install-status]') || null);
    const input = label.querySelector('input');
    input.checked = rememberEnabled();
    input.addEventListener('change', async () => {
      const requested = input.checked;
      input.disabled = true;
      try {
        await changePreference(requested);
      } catch (_) {
        input.checked = rememberEnabled();
      } finally {
        input.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControl, { once: true });
  else installControl();
})();