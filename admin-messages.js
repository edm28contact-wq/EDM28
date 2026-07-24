(() => {
  if (window.__edmAdminMessagesInstalled) return;
  window.__edmAdminMessagesInstalled = true;

  const REFRESH_INTERVAL_MS = 12000;

  function ensureUi() {
    const clientsButton = document.querySelector('button[data-page="clients"]');
    if (clientsButton && !document.querySelector('button[data-page="messages"]')) {
      clientsButton.insertAdjacentHTML('afterend', '<button class="btn ghost" data-page="messages">Messagerie <span id="adminMessageUnreadBadge" class="pill hidden">0</span></button>');
    }

    const clientsPage = document.getElementById('clients');
    if (clientsPage && !document.getElementById('messages')) {
      clientsPage.insertAdjacentHTML('afterend', `
        <section id="messages" class="page">
          <div class="grid2" style="grid-template-columns:minmax(260px,.7fr) minmax(0,1.3fr)">
            <div class="card">
              <div class="top">
                <div><h2>Conversations</h2><p class="muted">Messages clients et réponses EDM AUTO.</p></div>
                <button id="adminMessageRefresh" class="btn ghost" type="button">Actualiser</button>
              </div>
              <input id="adminMessageSearch" placeholder="Nom, email, téléphone" style="width:100%;margin:10px 0;padding:11px;border:1px solid #d0d5dd;border-radius:12px">
              <div id="adminMessageConversations"></div>
            </div>
            <div class="card">
              <div id="adminMessageEmpty" class="muted">Sélectionnez un client.</div>
              <div id="adminMessageConversation" class="hidden">
                <div class="top">
                  <div><h2 id="adminMessageClientName">Conversation</h2><p class="muted" id="adminMessageClientMeta"></p></div>
                  <span id="adminMessageAiState" class="pill">Validation humaine obligatoire</span>
                </div>
                <div id="adminMessageThread" style="min-height:280px;max-height:520px;overflow:auto;display:grid;gap:10px;padding:12px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:16px"></div>
                <div style="margin-top:14px">
                  <div class="grid2">
                    <div class="field"><label>Demande liée</label><select id="adminMessageRequest"><option value="">Conversation générale</option></select></div>
                    <div class="field"><label>Objet</label><input id="adminMessageSubject" maxlength="160" placeholder="Réponse EDM AUTO"></div>
                  </div>
                  <div class="field"><label>Consigne facultative pour le brouillon IA</label><input id="adminMessageGuidance" maxlength="1200" placeholder="Ex. demander une photo du témoin allumé"></div>
                  <div class="field"><label>Réponse</label><textarea id="adminMessageBody" maxlength="4000" style="min-height:150px" placeholder="Rédigez ou générez un brouillon, puis relisez avant l’envoi."></textarea></div>
                  <div class="toolbar">
                    <button id="adminMessageAiDraft" class="btn ghost" type="button">Proposer avec l’IA</button>
                    <button id="adminMessageSend" class="btn primary" type="button">Envoyer après validation</button>
                  </div>
                  <div id="adminMessageStatus" class="status hidden"></div>
                  <p class="muted">L’IA ne répond jamais automatiquement : elle produit uniquement un brouillon modifiable, envoyé après clic explicite de l’administrateur.</p>
                </div>
              </div>
            </div>
          </div>
        </section>`);
    }
  }

  ensureUi();

  window.EDMAdminMessages = {
    clients: [],
    messages: [],
    selectedUserId: null,
    selectedDraftId: null,
    timer: null,

    async load() {
      const app = window.EDMAdmin;
      if (!app?.db) return;

      const [{ data: clients, error: clientsError }, { data: messages, error: messagesError }] = await Promise.all([
        app.db.from('profiles').select('id,first_name,last_name,email,phone,role').eq('role', 'customer').order('created_at', { ascending: false }),
        app.db.from('client_messages').select('id,user_id,service_request_id,direction,subject,body,read_by_admin,read_by_client,created_at').order('created_at', { ascending: false }).limit(500)
      ]);
      if (clientsError) throw clientsError;
      if (messagesError) throw messagesError;

      this.clients = clients || [];
      this.messages = messages || [];
      this.renderConversationList();
      this.updateUnreadBadge();
      this.installHandlers();
      this.startLoop();

      if (this.selectedUserId && this.clients.some((client) => client.id === this.selectedUserId)) {
        await this.open(this.selectedUserId, false);
      } else {
        const first = this.sortedClients()[0];
        if (first) await this.open(first.id, false);
      }
    },

    installHandlers() {
      const app = window.EDMAdmin;
      if (app.$('adminMessageRefresh') && !app.$('adminMessageRefresh').dataset.bound) {
        app.$('adminMessageRefresh').dataset.bound = '1';
        app.$('adminMessageRefresh').onclick = () => this.load().catch((error) => app.status('adminMessageStatus', error.message, true));
      }
      if (app.$('adminMessageSearch') && !app.$('adminMessageSearch').dataset.bound) {
        app.$('adminMessageSearch').dataset.bound = '1';
        app.$('adminMessageSearch').oninput = () => this.renderConversationList();
      }
      if (app.$('adminMessageSend') && !app.$('adminMessageSend').dataset.bound) {
        app.$('adminMessageSend').dataset.bound = '1';
        app.$('adminMessageSend').onclick = () => this.send();
      }
      if (app.$('adminMessageAiDraft') && !app.$('adminMessageAiDraft').dataset.bound) {
        app.$('adminMessageAiDraft').dataset.bound = '1';
        app.$('adminMessageAiDraft').onclick = () => this.createAiDraft();
      }
    },

    sortedClients() {
      const term = String(window.EDMAdmin?.$('adminMessageSearch')?.value || '').trim().toLowerCase();
      const latest = new Map();
      for (const message of this.messages) {
        if (!latest.has(message.user_id)) latest.set(message.user_id, message);
      }
      return this.clients
        .filter((client) => !term || [client.first_name, client.last_name, client.email, client.phone]
          .some((value) => String(value || '').toLowerCase().includes(term)))
        .sort((a, b) => {
          const aDate = latest.get(a.id)?.created_at || '';
          const bDate = latest.get(b.id)?.created_at || '';
          return String(bDate).localeCompare(String(aDate));
        });
    },

    unreadFor(userId) {
      return this.messages.filter((message) => message.user_id === userId && message.direction === 'inbound' && !message.read_by_admin).length;
    },

    updateUnreadBadge() {
      const badge = window.EDMAdmin?.$('adminMessageUnreadBadge');
      if (!badge) return;
      const count = this.messages.filter((message) => message.direction === 'inbound' && !message.read_by_admin).length;
      badge.textContent = String(count);
      badge.classList.toggle('hidden', !count);
    },

    renderConversationList() {
      const app = window.EDMAdmin;
      const host = app.$('adminMessageConversations');
      if (!host) return;
      const rows = this.sortedClients();
      host.innerHTML = rows.map((client) => {
        const recent = this.messages.find((message) => message.user_id === client.id);
        const unread = this.unreadFor(client.id);
        const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Client';
        return `<button class="btn ghost" type="button" data-message-client="${app.esc(client.id)}" style="width:100%;display:block;text-align:left;margin:6px 0;${this.selectedUserId === client.id ? 'border-color:#155eef;background:#eff6ff' : ''}">
          <strong>${app.esc(name)}</strong>${unread ? `<span class="pill" style="float:right">${unread}</span>` : ''}<br>
          <span class="muted">${app.esc(recent?.body?.slice(0, 90) || 'Aucun message')}</span>
        </button>`;
      }).join('') || '<p class="muted">Aucun client.</p>';
      host.querySelectorAll('[data-message-client]').forEach((button) => {
        button.onclick = () => this.open(button.dataset.messageClient);
      });
    },

    async open(userId, reloadList = true) {
      const app = window.EDMAdmin;
      const client = this.clients.find((item) => item.id === userId);
      if (!client) return;
      this.selectedUserId = userId;
      this.selectedDraftId = null;
      app.$('adminMessageEmpty').classList.add('hidden');
      app.$('adminMessageConversation').classList.remove('hidden');
      app.$('adminMessageClientName').textContent = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
      app.$('adminMessageClientMeta').textContent = `${client.email || '-'} · ${client.phone || '-'}`;
      app.status('adminMessageStatus', 'Chargement de la conversation...');

      const [{ data: messages, error: messagesError }, { data: requests, error: requestsError }] = await Promise.all([
        app.db.from('client_messages').select('id,user_id,service_request_id,direction,subject,body,read_by_admin,read_by_client,created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(200),
        app.db.from('service_requests').select('id,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
      ]);
      if (messagesError) throw messagesError;
      if (requestsError) throw requestsError;

      this.renderThread(messages || []);
      this.renderRequests(requests || []);
      const { error: markError } = await app.db.rpc('admin_mark_conversation_read', { p_user_id: userId });
      if (markError) throw markError;

      this.messages = this.messages.map((message) => message.user_id === userId && message.direction === 'inbound'
        ? { ...message, read_by_admin: true }
        : message);
      this.updateUnreadBadge();
      if (reloadList) this.renderConversationList();
      app.status('adminMessageStatus', 'Conversation à jour.');
    },

    renderThread(messages) {
      const app = window.EDMAdmin;
      const host = app.$('adminMessageThread');
      if (!host) return;
      host.innerHTML = messages.map((message) => {
        const inbound = message.direction === 'inbound';
        const label = inbound ? 'Client' : message.direction === 'system' ? 'Système' : 'EDM AUTO';
        return `<article style="max-width:86%;${inbound ? 'margin-right:auto;background:white' : 'margin-left:auto;background:#eff6ff'};padding:12px;border:1px solid #e4e7ec;border-radius:14px;white-space:pre-wrap">
          <div class="top"><strong>${app.esc(label)}</strong><span class="muted">${new Date(message.created_at).toLocaleString('fr-FR')}</span></div>
          ${message.subject ? `<strong>${app.esc(message.subject)}</strong>` : ''}
          <div style="margin-top:6px">${app.esc(message.body)}</div>
        </article>`;
      }).join('') || '<p class="muted">Aucun message.</p>';
      host.scrollTop = host.scrollHeight;
    },

    renderRequests(requests) {
      const app = window.EDMAdmin;
      const select = app.$('adminMessageRequest');
      if (!select) return;
      const selected = select.value;
      select.innerHTML = '<option value="">Conversation générale</option>' + requests.map((request) => `<option value="${app.esc(request.id)}">Demande du ${new Date(request.created_at).toLocaleDateString('fr-FR')} · ${app.esc(request.status)}</option>`).join('');
      if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    },

    async send() {
      const app = window.EDMAdmin;
      if (!this.selectedUserId) return app.status('adminMessageStatus', 'Sélectionnez un client.', true);
      const body = app.$('adminMessageBody').value.trim();
      if (!body) return app.status('adminMessageStatus', 'Rédigez une réponse.', true);

      const button = app.$('adminMessageSend');
      button.disabled = true;
      try {
        const { error } = await app.db.rpc('admin_send_message', {
          p_user_id: this.selectedUserId,
          p_body: body,
          p_service_request_id: app.$('adminMessageRequest').value || null,
          p_subject: app.$('adminMessageSubject').value.trim() || null,
          p_ai_draft_id: this.selectedDraftId
        });
        if (error) throw error;
        app.$('adminMessageBody').value = '';
        app.$('adminMessageGuidance').value = '';
        this.selectedDraftId = null;
        app.$('adminMessageAiState').textContent = 'Validation humaine obligatoire';
        app.status('adminMessageStatus', 'Message envoyé au client.');
        await this.load();
        await this.open(this.selectedUserId);
      } catch (error) {
        app.status('adminMessageStatus', error.message || 'Envoi impossible.', true);
      } finally {
        button.disabled = false;
      }
    },

    async createAiDraft() {
      const app = window.EDMAdmin;
      if (!this.selectedUserId) return app.status('adminMessageStatus', 'Sélectionnez un client.', true);
      const button = app.$('adminMessageAiDraft');
      button.disabled = true;
      button.textContent = 'Génération...';
      app.status('adminMessageStatus', 'Création du brouillon IA...');
      try {
        const { data: sessionData, error: sessionError } = await app.db.auth.getSession();
        if (sessionError) throw sessionError;
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Session administrateur introuvable.');

        const response = await fetch('/api/ai-message-draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: this.selectedUserId,
            serviceRequestId: app.$('adminMessageRequest').value || null,
            guidance: app.$('adminMessageGuidance').value.trim()
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success !== true) throw new Error(result.error || 'Brouillon IA indisponible.');

        this.selectedDraftId = result.draftId || null;
        app.$('adminMessageSubject').value = result.draft?.subject || '';
        app.$('adminMessageBody').value = result.draft?.body || '';
        const warnings = Array.isArray(result.draft?.warnings) ? result.draft.warnings.filter(Boolean) : [];
        app.$('adminMessageAiState').textContent = `Brouillon IA · ${result.model || 'modèle configuré'}`;
        app.status('adminMessageStatus', warnings.length
          ? `Brouillon généré. Vérifications : ${warnings.join(' · ')}`
          : 'Brouillon généré. Relisez et modifiez avant envoi.');
      } catch (error) {
        app.status('adminMessageStatus', error.message || 'Génération impossible.', true);
      } finally {
        button.disabled = false;
        button.textContent = 'Proposer avec l’IA';
      }
    },

    startLoop() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (document.visibilityState === 'visible' && document.getElementById('messages')?.classList.contains('active')) {
          this.load().catch(() => {});
        }
      }, REFRESH_INTERVAL_MS);
    }
  };
})();
