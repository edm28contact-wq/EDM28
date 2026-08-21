(() => {
  if (window.__edmClientFinalHotfixInstalled) return;
  window.__edmClientFinalHotfixInstalled = true;

  const style = document.createElement('style');
  style.id = 'edm-client-final-hotfix-style';
  style.textContent = `
    .nav [data-page="home"],
    .nav [data-page="home"].active,
    .nav [data-page="home"] * {
      color:#050505 !important;
    }
    .edm-mail-row-actions {
      display:flex;
      justify-content:flex-end;
      gap:8px;
      margin-top:9px;
    }
    .edm-mail-delete-row {
      min-height:34px !important;
      padding:7px 10px !important;
      font-size:.84rem !important;
    }
  `;
  document.head.appendChild(style);

  const safeToast = (message) => {
    try {
      if (typeof toast === 'function') toast(message);
      else console.warn(message);
    } catch (_) {
      console.warn(message);
    }
  };

  async function deleteMessage(messageId, button) {
    if (!messageId || typeof supabaseClient === 'undefined') return;
    if (!window.confirm('Supprimer ce message de votre boîte ?')) return;
    if (button) button.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc('client_delete_message', { p_message_id: messageId });
      if (error) throw error;
      if (!data) throw new Error('Suppression impossible.');
      document.querySelector(`[data-mail-id="${CSS.escape(messageId)}"]`)?.remove();
      const reader = document.getElementById('edmMailReader');
      if (reader) reader.innerHTML = '<div class="empty" style="margin:18px">Message supprimé de votre boîte.</div>';
      const count = document.getElementById('edmMailCount');
      if (count) {
        const remaining = document.querySelectorAll('#edmMailList [data-mail-id]').length;
        count.textContent = String(remaining);
      }
      safeToast('Message supprimé de votre boîte.');
    } catch (error) {
      safeToast(error?.message || 'Suppression impossible.');
      if (button) button.disabled = false;
    }
  }

  function enhanceMailRows(root = document) {
    root.querySelectorAll?.('#edmMailList [data-mail-id]').forEach((row) => {
      if (row.dataset.deleteEnhanced === '1') return;
      row.dataset.deleteEnhanced = '1';
      const actions = document.createElement('div');
      actions.className = 'edm-mail-row-actions';
      actions.innerHTML = '<button type="button" class="btn btn-danger edm-mail-delete-row">Supprimer</button>';
      const button = actions.querySelector('button');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void deleteMessage(row.dataset.mailId, button);
      });
      row.appendChild(actions);
    });
  }

  function keepHomeBlack() {
    document.querySelectorAll('.nav [data-page="home"]').forEach((node) => {
      node.style.setProperty('color', '#050505', 'important');
      node.querySelectorAll('*').forEach((child) => child.style.setProperty('color', '#050505', 'important'));
    });
  }

  function install() {
    keepHomeBlack();
    enhanceMailRows();
    const observer = new MutationObserver((mutations) => {
      keepHomeBlack();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          enhanceMailRows(node.matches?.('#edmMailList') ? node : document);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-page="messages"]')) {
        window.setTimeout(() => enhanceMailRows(), 100);
        window.setTimeout(() => enhanceMailRows(), 600);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
