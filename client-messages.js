(() => {
  if (window.__edmClientMessagesInstalled) return;
  window.__edmClientMessagesInstalled = true;

  const $ = (id) => document.getElementById(id);
  const REFRESH_INTERVAL_MS = 15000;
  let refreshTimer = null;
  let loading = null;

  const safe = (value) => {
    try { if (typeof escapeHtml === 'function') return escapeHtml(value); } catch (_) {}
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  function ensureUi() {
    const historyButton = document.querySelector('[data-page="history"]');
    if (historyButton && !document.querySelector('[data-page="messages"]')) {
      historyButton.insertAdjacentHTML('afterend', '<button data-page="messages">✉️ Messagerie <span id="messageUnreadBadge" class="pill orange hidden" style="margin-left:auto">0</span></button>');
    }

    const aboutPage = $('about');
    if (aboutPage && !$('messages')) {
      aboutPage.insertAdjacentHTML('beforebegin', `
        <section id="messages" class="page">
          <div class="panel">
            <div class="section-title">
              <div><h2>Messagerie</h2><p>Consultez vos échanges avec EDM28 et envoyez un nouveau message.</p></div>
              <div class="btn-row" style="margin:0"><button id="clientMessageNew" class="btn btn-primary" type="button">Nouveau message</button><button id="clientMessageRefresh" class="btn btn-ghost" type="button">Actualiser</button></div>
            </div>
            <div id="clientMessageStatus" class="small" aria-live="polite"></div>
            <div id="clientMessageThread" class="card" aria-live="polite" style="min-height:300px;max-height:560px;overflow:auto;display:grid;gap:10px"></div>
            <div id="clientMessageComposer" class="card hidden" style="margin-top:14px">
              <div class="grid">
                <label>Demande liée<select id="clientMessageRequest"><option value="">Conversation générale</option></select></label>
                <label>Objet<input id="clientMessageSubject" maxlength="160" placeholder="Objet du message"></label>
              </div>
              <label style="margin-top:12px">Message<textarea id="clientMessageBody" maxlength="4000" rows="7" placeholder="Écrivez votre message à EDM28..."></textarea></label>
              <div class="btn-row"><button id="clientMessageSend" class="btn btn-primary" type="button">Envoyer</button><button id="clientMessageCancel" class="btn btn-ghost" type="button">Annuler</button></div>
            </div>
          </div>
        </section>`);
    }
  }

  async function currentUserId() {
    try { if (typeof state !== 'undefined' && state?.user?.id) return state.user.id; } catch (_) {}
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
    select.innerHTML = '<option value="">Conversation générale</option>' + (requests || []).map((request) => `<option value="${safe(request.id)}">Demande du ${safe(new Date(request.created_at).toLocaleDateString('fr-FR'))} · ${safe(request.status || 'enregistrée')}</option>`).join('');
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  }

  function renderMessages(messages) {
    const host = $('clientMessageThread');
    if (!host) return;
    if (!messages.length) {
      host.innerHTML = '<div class="empty">Aucun message pour le moment.</div>';
      return;
    }

    host.innerHTML = messages.map((message) => {
      const mine = message.direction === 'inbound';
      const label = mine ? 'Vous' : message.direction === 'system' ? 'Information EDM28' : 'EDM28';
      const background = mine ? 'var(--blue-soft)' : 'var(--surface-2)';
      const align = mine ? 'margin-left:auto' : 'margin-right:auto';
      const delivery = mine ? (message.read_by_admin ? 'Lu par EDM28' : 'Envoyé') : (!message.read_by_client ? 'Nouveau' : 'Lu');
      return `<article class="card" data-client-message-id="${safe(message.id)}" style="max-width:90%;${align};background:${background}">
        <button type="button" data-open-message="${safe(message.id)}" style="display:block;width:100%;text-align:left;background:transparent;color:inherit;padding:0">
          <div class="section-title" style="margin-bottom:8px"><strong>${safe(message.subject || label)}</strong><span class="small">${safe(formatDate(message.created_at))}</span></div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(message.body)}</div>
          <div class="small" style="margin-top:8px">${safe(delivery)}</div>
        </button>
        <div class="btn-row" style="margin-top:10px"><button class="btn btn-danger" type="button" data-delete-message="${safe(message.id)}">Supprimer</button></div>
      </article>`;
    }).join('');
  }

  function updateUnreadBadge(count) {
    const badge = $('messageUnreadBadge');
    if (!badge) return;
    badge.textContent = String(count || 0);
    badge.classList.toggle('hidden', !count);
  }

  function openComposer(show = true) {
    $('clientMessageComposer')?.classList.toggle('hidden', !show);
    if (show) $('clientMessageSubject')?.focus();
  }

  async function deleteMessage(id) {
    if (!window.confirm('Supprimer ce message de votre boîte ?')) return;
    const { data, error } = await supabaseClient.rpc('client_delete_message', { p_message_id: id });
    if (error) throw error;
    if (!data) throw new Error('Suppression impossible.');
    setStatus('Message supprimé.');
    await loadMessages(true);
  }

  async function openMessage(id, messages) {
    const message = messages.find((row) => row.id === id);
    if (!message) return;
    const host = $('clientMessageThread');
    host.innerHTML = `<article class="card" style="background:var(--surface-2)">
      <div class="section-title"><div><h3>${safe(message.subject || 'Message EDM28')}</h3><div class="small">${safe(message.direction === 'inbound' ? 'Vous → EDM28' : 'EDM28 → Vous')} · ${safe(formatDate(message.created_at))}</div></div><button class="btn btn-danger" type="button" data-delete-message="${safe(message.id)}">Supprimer</button></div>
      <div style="white-space:pre-wrap;line-height:1.65;margin-top:14px">${safe(message.body)}</div>
      <div class="btn-row"><button class="btn btn-ghost" type="button" id="clientMessageBack">Retour à la boîte</button></div>
    </article>`;
    $('clientMessageBack')?.addEventListener('click', () => renderMessages(messages));
    host.querySelector('[data-delete-message]')?.addEventListener('click', () => void deleteMessage(message.id).catch((error) => setStatus(error.message || 'Suppression impossible.', true)));

    if (message.direction !== 'inbound' && !message.read_by_client) {
      const { error } = await supabaseClient.rpc('client_mark_messages_read', { p_message_ids: [message.id] });
      if (!error) message.read_by_client = true;
    }
  }

  async function loadMessages(force = false) {
    ensureUi();
    if (loading) {
      if (!force) return loading;
      await loading;
    }

    loading = (async () => {
      const userId = await currentUserId();
      if (!userId) {
        renderMessages([]);
        updateUnreadBadge(0);
        setStatus('Connectez-vous pour utiliser la messagerie.');
        return;
      }

      setStatus('Actualisation de la boîte…');
      const [{ data: messages, error: messagesError }, { data: requests, error: requestsError }] = await Promise.all([
        supabaseClient.from('client_messages').select('id,service_request_id,direction,subject,body,channel,read_by_client,read_by_admin,created_at,deleted_by_client_at').eq('user_id', userId).eq('visible_to_client', true).is('deleted_by_client_at', null).order('created_at', { ascending: false }).limit(100),
        supabaseClient.from('service_requests').select('id,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
      ]);
      if (messagesError) throw messagesError;
      if (requestsError) throw requestsError;

      const rows = messages || [];
      renderRequests(requests || []);
      renderMessages(rows);
      const unreadIds = rows.filter((message) => message.direction !== 'inbound' && !message.read_by_client).map((message) => message.id);
      updateUnreadBadge(unreadIds.length);

      $('clientMessageThread')?.querySelectorAll('[data-open-message]').forEach((button) => button.addEventListener('click', () => void openMessage(button.dataset.openMessage, rows)));
      $('clientMessageThread')?.querySelectorAll('[data-delete-message]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        void deleteMessage(button.dataset.deleteMessage).catch((error) => setStatus(error.message || 'Suppression impossible.', true));
      }));
      setStatus('Boîte à jour.');
    })().catch((error) => setStatus(error.message || 'Messagerie momentanément indisponible.', true)).finally(() => { loading = null; });

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
    if (button) { button.disabled = true; button.textContent = 'Envoi…'; }
    try {
      const { error } = await supabaseClient.rpc('client_send_message', { p_body: body, p_service_request_id: requestId, p_subject: subject || null });
      if (error) throw error;
      $('clientMessageBody').value = '';
      $('clientMessageSubject').value = '';
      openComposer(false);
      setStatus('Message envoyé à EDM28.');
      await loadMessages(true);
    } catch (error) {
      setStatus(error.message || 'Envoi impossible.', true);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Envoyer'; }
    }
  }

  function install() {
    ensureUi();
    $('clientMessageRefresh')?.addEventListener('click', () => void loadMessages(true));
    $('clientMessageNew')?.addEventListener('click', () => openComposer(true));
    $('clientMessageCancel')?.addEventListener('click', () => openComposer(false));
    $('clientMessageSend')?.addEventListener('click', () => void sendMessage());
    $('clientMessageBody')?.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void sendMessage(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void loadMessages(true); });
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') void loadMessages(); }, REFRESH_INTERVAL_MS);
    void loadMessages();
    if (typeof supabaseClient !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void loadMessages(true);
        else { renderMessages([]); updateUnreadBadge(0); }
      });
    }
  }

  window.renderClientMessages = () => loadMessages(true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
