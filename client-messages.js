(() => {
  if (window.__edmClientMessagesInstalled) return;
  window.__edmClientMessagesInstalled = true;

  const $ = (id) => document.getElementById(id);
  const REFRESH_INTERVAL_MS = 12000;
  let refreshTimer = null;
  let loading = null;

  const safe = (value) => {
    try {
      if (typeof escapeHtml === 'function') return escapeHtml(value);
    } catch (_) {}
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  function ensureUi() {
    const historyButton = document.querySelector('[data-page="history"]');
    if (historyButton && !document.querySelector('[data-page="messages"]')) {
      historyButton.insertAdjacentHTML('afterend', '<button data-page="messages">💬 Messagerie <span id="messageUnreadBadge" class="pill orange hidden" style="margin-left:auto">0</span></button>');
    }

    const aboutPage = $('about');
    if (aboutPage && !$('messages')) {
      aboutPage.insertAdjacentHTML('beforebegin', `
        <section id="messages" class="page">
          <div class="panel">
            <div class="section-title">
              <div>
                <h2>Messagerie</h2>
                <p>Échangez avec EDM AUTO au sujet de votre demande. Les réponses sont rédigées ou validées par l’équipe avant envoi.</p>
              </div>
              <button id="clientMessageRefresh" class="btn btn-ghost" type="button">Actualiser</button>
            </div>
            <div id="clientMessageStatus" class="small"></div>
            <div id="clientMessageThread" class="card" style="min-height:260px;max-height:560px;overflow:auto;display:grid;gap:10px"></div>
            <div class="card" style="margin-top:14px">
              <div class="grid">
                <label>Demande liée
                  <select id="clientMessageRequest"><option value="">Conversation générale</option></select>
                </label>
                <label>Objet
                  <input id="clientMessageSubject" maxlength="160" placeholder="Question sur ma demande">
                </label>
              </div>
              <label style="margin-top:12px">Message
                <textarea id="clientMessageBody" maxlength="4000" placeholder="Écrivez votre message à EDM AUTO..."></textarea>
              </label>
              <div class="btn-row">
                <button id="clientMessageSend" class="btn btn-primary" type="button">Envoyer le message</button>
                <span class="small">Réponse non instantanée. Aucun diagnostic ou tarif définitif n’est validé automatiquement.</span>
              </div>
            </div>
          </div>
        </section>`);
    }
  }

  async function currentUserId() {
    try {
      if (typeof state !== 'undefined' && state?.user?.id) return state.user.id;
    } catch (_) {}
    if (typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user?.id || null;
  }

  function setStatus(message, error = false) {
    const node = $('clientMessageStatus');
    if (!node) return;
    node.textContent = message || '';
    node.style.color = error ? 'var(--red)' : 'var(--muted)';
  }

  function renderRequests(requests) {
    const select = $('clientMessageRequest');
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">Conversation générale</option>' + (requests || []).map((request) => {
      const label = `Demande du ${new Date(request.created_at).toLocaleDateString('fr-FR')} · ${request.status || 'enregistrée'}`;
      return `<option value="${safe(request.id)}">${safe(label)}</option>`;
    }).join('');
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  }

  function renderMessages(messages) {
    const host = $('clientMessageThread');
    if (!host) return;
    if (!messages.length) {
      host.innerHTML = '<div class="empty">Aucun message. Vous pouvez démarrer la conversation ci-dessous.</div>';
      return;
    }

    host.innerHTML = messages.map((message) => {
      const mine = message.direction === 'inbound';
      const label = mine ? 'Vous' : message.direction === 'system' ? 'Information EDM AUTO' : 'EDM AUTO';
      const background = mine ? 'var(--blue-soft)' : 'var(--surface-2)';
      const align = mine ? 'margin-left:auto' : 'margin-right:auto';
      return `<article class="card" data-client-message-id="${safe(message.id)}" style="max-width:86%;${align};background:${background};white-space:pre-wrap">
        <div class="section-title" style="margin-bottom:8px">
          <strong>${safe(label)}</strong>
          <span class="small">${safe(formatDate(message.created_at))}</span>
        </div>
        ${message.subject ? `<strong>${safe(message.subject)}</strong>` : ''}
        <div style="margin-top:6px">${safe(message.body)}</div>
      </article>`;
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  function updateUnreadBadge(count) {
    const badge = $('messageUnreadBadge');
    if (!badge) return;
    badge.textContent = String(count || 0);
    badge.classList.toggle('hidden', !count);
  }

  async function loadMessages() {
    ensureUi();
    if (loading) return loading;

    loading = (async () => {
      const userId = await currentUserId();
      if (!userId) {
        renderMessages([]);
        updateUnreadBadge(0);
        setStatus('Connectez-vous pour utiliser la messagerie.');
        return;
      }

      setStatus('Actualisation de la conversation...');
      const [{ data: messages, error: messagesError }, { data: requests, error: requestsError }] = await Promise.all([
        supabaseClient
          .from('client_messages')
          .select('id,service_request_id,direction,subject,body,channel,read_by_client,created_at')
          .eq('user_id', userId)
          .eq('visible_to_client', true)
          .order('created_at', { ascending: true })
          .limit(100),
        supabaseClient
          .from('service_requests')
          .select('id,status,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30)
      ]);

      if (messagesError) throw messagesError;
      if (requestsError) throw requestsError;

      const rows = messages || [];
      renderRequests(requests || []);
      renderMessages(rows);

      const unreadIds = rows
        .filter((message) => message.direction !== 'inbound' && !message.read_by_client)
        .map((message) => message.id);
      updateUnreadBadge(unreadIds.length);

      if ($('messages')?.classList.contains('active') && unreadIds.length) {
        const { error: markError } = await supabaseClient.rpc('client_mark_messages_read', { p_message_ids: unreadIds });
        if (markError) throw markError;
        updateUnreadBadge(0);
      }

      setStatus('Conversation à jour.');
    })().catch((error) => {
      console.warn('EDM client messaging unavailable', error);
      setStatus(error.message || 'Messagerie momentanément indisponible.', true);
    }).finally(() => {
      loading = null;
    });

    return loading;
  }

  async function sendMessage() {
    const userId = await currentUserId();
    if (!userId) return setStatus('Connexion requise.', true);

    const body = $('clientMessageBody')?.value.trim() || '';
    const subject = $('clientMessageSubject')?.value.trim() || '';
    const requestId = $('clientMessageRequest')?.value || null;
    if (!body) return setStatus('Écrivez un message avant l’envoi.', true);

    const button = $('clientMessageSend');
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi...';
    }
    try {
      const { error } = await supabaseClient.rpc('client_send_message', {
        p_body: body,
        p_service_request_id: requestId,
        p_subject: subject || null
      });
      if (error) throw error;
      $('clientMessageBody').value = '';
      setStatus('Message envoyé à EDM AUTO.');
      await loadMessages();
    } catch (error) {
      setStatus(error.message || 'Envoi impossible.', true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Envoyer le message';
      }
    }
  }

  function startRefreshLoop() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && $('messages')?.classList.contains('active')) void loadMessages();
    }, REFRESH_INTERVAL_MS);
  }

  function install() {
    ensureUi();
    $('clientMessageRefresh')?.addEventListener('click', () => void loadMessages());
    $('clientMessageSend')?.addEventListener('click', () => void sendMessage());
    $('clientMessageBody')?.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void sendMessage();
    });
    startRefreshLoop();
    void loadMessages();

    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void loadMessages();
        else {
          renderMessages([]);
          updateUnreadBadge(0);
        }
      });
    }
  }

  window.renderClientMessages = loadMessages;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
