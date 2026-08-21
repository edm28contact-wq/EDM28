(() => {
  if (window.__edmClientFinalPatchInstalled) return;
  window.__edmClientFinalPatchInstalled = true;

  const BUCKET = 'repair-documents';
  const style = document.createElement('style');
  style.id = 'edm-client-final-patch-style';
  style.textContent = `
    .nav [data-page="home"],
    .nav [data-page="home"].active,
    .nav [data-page="home"] * { color:#050505 !important; }
    #home h1 [data-edm-votre-force],
    #home h1 .edm-votre-black { color:inherit !important; text-shadow:inherit !important; }
    .edm-mail-row-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
    .edm-mail-row-actions .btn{min-height:34px;padding:7px 10px;font-size:.84rem}
  `;
  document.head.appendChild(style);

  function notify(message) {
    try {
      if (typeof toast === 'function') toast(message);
      else console.warn(message);
    } catch (_) {
      console.warn(message);
    }
  }

  function keepHomeBlack() {
    document.querySelectorAll('.nav [data-page="home"]').forEach((node) => {
      node.style.setProperty('color', '#050505', 'important');
      node.querySelectorAll('*').forEach((child) => child.style.setProperty('color', '#050505', 'important'));
    });
  }

  function normalizeVotreColor() {
    const h1 = document.querySelector('#home h1');
    if (!h1) return;
    h1.querySelectorAll('[data-edm-votre-force], .edm-votre-black').forEach((word) => {
      word.style.setProperty('color', 'inherit', 'important');
      word.style.setProperty('text-shadow', 'inherit', 'important');
    });
  }

  async function currentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    const result = await supabaseClient.auth.getSession();
    if (result.error) throw result.error;
    return result.data && result.data.session ? result.data.session.user : null;
  }

  async function signedUrl(path, expires) {
    const result = await supabaseClient.storage.from(BUCKET).createSignedUrl(path, expires || 180);
    if (result.error || !result.data || !result.data.signedUrl) throw result.error || new Error('Fichier indisponible.');
    return result.data.signedUrl;
  }

  async function openPath(path) {
    const url = await signedUrl(path, 180);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function downloadPath(path, filename) {
    const url = await signedUrl(path, 300);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Téléchargement impossible.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || path.split('/').pop() || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function deleteMessage(messageId) {
    const result = await supabaseClient.rpc('client_delete_message', { p_message_id: messageId });
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Suppression impossible.');
    const row = document.querySelector('[data-mail-id="' + CSS.escape(messageId) + '"]');
    if (row) row.remove();
    const count = document.getElementById('edmMailCount');
    if (count) count.textContent = String(document.querySelectorAll('#edmMailList [data-mail-id]').length);
    const reader = document.getElementById('edmMailReader');
    if (reader) reader.innerHTML = '<div class="empty" style="margin:18px">Message supprimé de votre boîte.</div>';
  }

  async function deleteAllMessages() {
    const button = document.getElementById('edmDeleteAllMessages');
    const rows = [...document.querySelectorAll('#edmMailList [data-mail-id]')];
    if (!rows.length) {
      notify('Aucun message à supprimer.');
      return;
    }
    if (!window.confirm('Supprimer tous les messages de votre boîte ?')) return;

    const original = button ? button.textContent : 'Tout supprimer';
    if (button) {
      button.disabled = true;
      button.textContent = 'Suppression…';
    }

    let deleted = 0;
    let failed = 0;
    for (const row of rows) {
      const id = row.dataset.mailId;
      if (!id) continue;
      try {
        const result = await supabaseClient.rpc('client_delete_message', { p_message_id: id });
        if (result.error || !result.data) throw result.error || new Error('Suppression impossible.');
        row.remove();
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.warn('EDM bulk message delete:', error && error.message ? error.message : error);
      }
    }

    const remaining = document.querySelectorAll('#edmMailList [data-mail-id]').length;
    const count = document.getElementById('edmMailCount');
    if (count) count.textContent = String(remaining);
    const list = document.getElementById('edmMailList');
    if (list && remaining === 0) list.innerHTML = '<div class="empty">Aucun message.</div>';
    const reader = document.getElementById('edmMailReader');
    if (reader && deleted) reader.innerHTML = '<div class="empty" style="margin:18px">Messages supprimés de votre boîte.</div>';
    const status = document.getElementById('edmMailStatus');
    if (status) status.textContent = failed ? deleted + ' message(s) supprimé(s), ' + failed + ' échec(s).' : 'Boîte à jour.';

    if (button && button.isConnected) {
      button.disabled = false;
      button.textContent = original;
    }
    notify(failed ? deleted + ' message(s) supprimé(s). Certains messages n’ont pas pu être supprimés.' : 'Tous les messages ont été supprimés.');
  }

  function ensureDeleteAllButton() {
    const compose = document.getElementById('edmComposeMessage');
    if (!compose || document.getElementById('edmDeleteAllMessages')) return;
    const button = document.createElement('button');
    button.id = 'edmDeleteAllMessages';
    button.type = 'button';
    button.className = 'btn btn-danger';
    button.textContent = 'Tout supprimer';
    button.addEventListener('click', () => void deleteAllMessages());
    compose.insertAdjacentElement('afterend', button);
  }

  async function relatedDocuments(message, userId) {
    if (!message.service_request_id) return [];

    const quoteResult = await supabaseClient
      .from('quotes')
      .select('id,quote_number,pdf_path')
      .eq('user_id', userId)
      .eq('service_request_id', message.service_request_id)
      .eq('visible_to_client', true);
    if (quoteResult.error) throw quoteResult.error;

    const orderResult = await supabaseClient
      .from('repair_orders')
      .select('id,order_number,pdf_path')
      .eq('user_id', userId)
      .eq('service_request_id', message.service_request_id)
      .eq('visible_to_client', true);
    if (orderResult.error) throw orderResult.error;

    const quotes = quoteResult.data || [];
    const orders = orderResult.data || [];
    const orderIds = orders.map((row) => row.id);
    const quoteIds = quotes.map((row) => row.id);
    const inspections = [];
    const invoices = [];

    if (orderIds.length) {
      const inspectionResult = await supabaseClient
        .from('inspection_reports')
        .select('report_number,pdf_path,repair_order_id')
        .eq('user_id', userId)
        .eq('visible_to_client', true)
        .in('repair_order_id', orderIds);
      if (inspectionResult.error) throw inspectionResult.error;
      inspections.push(...(inspectionResult.data || []));

      const invoiceByOrder = await supabaseClient
        .from('invoices')
        .select('id,invoice_number,pdf_path,repair_order_id,quote_id')
        .eq('user_id', userId)
        .eq('visible_to_client', true)
        .in('repair_order_id', orderIds);
      if (invoiceByOrder.error) throw invoiceByOrder.error;
      invoices.push(...(invoiceByOrder.data || []));
    }

    if (quoteIds.length) {
      const invoiceByQuote = await supabaseClient
        .from('invoices')
        .select('id,invoice_number,pdf_path,repair_order_id,quote_id')
        .eq('user_id', userId)
        .eq('visible_to_client', true)
        .in('quote_id', quoteIds);
      if (invoiceByQuote.error) throw invoiceByQuote.error;
      const known = new Set(invoices.map((row) => row.id));
      (invoiceByQuote.data || []).forEach((row) => {
        if (!known.has(row.id)) invoices.push(row);
      });
    }

    return [
      ...quotes.filter((row) => row.pdf_path).map((row) => ({ label: row.quote_number || 'Devis', path: row.pdf_path })),
      ...orders.filter((row) => row.pdf_path).map((row) => ({ label: row.order_number || 'Ordre de réparation', path: row.pdf_path })),
      ...inspections.filter((row) => row.pdf_path).map((row) => ({ label: row.report_number || 'Fiche de contrôle', path: row.pdf_path })),
      ...invoices.filter((row) => row.pdf_path).map((row) => ({ label: row.invoice_number || 'Facture', path: row.pdf_path }))
    ];
  }

  async function openMessage(messageId) {
    const reader = document.getElementById('edmMailReader');
    if (!reader) return;
    reader.innerHTML = '<div class="notice" style="margin:18px">Ouverture du message…</div>';

    try {
      const user = await currentUser();
      if (!user) throw new Error('Connexion requise.');

      const messageResult = await supabaseClient
        .from('client_messages')
        .select('id,service_request_id,direction,subject,body,read_by_client,created_at')
        .eq('id', messageId)
        .eq('user_id', user.id)
        .eq('visible_to_client', true)
        .is('deleted_by_client_at', null)
        .maybeSingle();
      if (messageResult.error) throw messageResult.error;
      const message = messageResult.data;
      if (!message) throw new Error('Message introuvable.');

      const docs = await relatedDocuments(message, user.id);
      const from = message.direction === 'inbound' ? 'Vous → EDM28' : 'EDM28 → Vous';
      const when = new Date(message.created_at).toLocaleString('fr-FR');
      const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

      reader.innerHTML = '<div class="edm-mail-reader-head"><div><strong>' + esc(message.subject || 'Message EDM28') + '</strong><div class="small">' + esc(from + ' · ' + when) + '</div></div><button class="btn btn-danger" id="edmDeleteMessage" type="button">Supprimer</button></div>' +
        '<div class="edm-reader-body">' + esc(message.body || '') +
        (docs.length ? '<div style="margin-top:22px"><h3>Pièces jointes / documents liés</h3><div class="edm-job-tools">' + docs.map((doc) => '<button class="btn btn-ghost" type="button" data-patch-open="' + esc(doc.path) + '">Ouvrir ' + esc(doc.label) + '</button><button class="btn btn-secondary" type="button" data-patch-download="' + esc(doc.path) + '" data-patch-name="' + esc(doc.label) + '.pdf">Télécharger</button>').join('') + '</div></div>' : '') + '</div>';

      document.getElementById('edmDeleteMessage')?.addEventListener('click', async () => {
        if (!window.confirm('Supprimer ce message de votre boîte ?')) return;
        try {
          await deleteMessage(message.id);
          notify('Message supprimé.');
        } catch (error) {
          notify(error && error.message ? error.message : 'Suppression impossible.');
        }
      });

      reader.querySelectorAll('[data-patch-open]').forEach((button) => button.addEventListener('click', () => {
        openPath(button.dataset.patchOpen).catch((error) => notify(error.message || 'Fichier indisponible.'));
      }));
      reader.querySelectorAll('[data-patch-download]').forEach((button) => button.addEventListener('click', () => {
        downloadPath(button.dataset.patchDownload, button.dataset.patchName).catch((error) => notify(error.message || 'Téléchargement impossible.'));
      }));

      if (message.direction !== 'inbound' && !message.read_by_client) {
        const markResult = await supabaseClient.rpc('client_mark_messages_read', { p_message_ids: [message.id] });
        if (markResult.error) console.warn('EDM mark message read:', markResult.error.message);
      }
    } catch (error) {
      reader.innerHTML = '<div class="errorbox" style="margin:18px">' + String(error && error.message ? error.message : 'Message indisponible.') + '</div>';
    }
  }

  function enhanceRows() {
    document.querySelectorAll('#edmMailList [data-mail-id]').forEach((row) => {
      if (row.dataset.finalPatch === '1') return;
      row.dataset.finalPatch = '1';

      const actions = document.createElement('div');
      actions.className = 'edm-mail-row-actions';
      actions.innerHTML = '<button type="button" class="btn btn-danger">Supprimer</button>';
      actions.querySelector('button').addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!window.confirm('Supprimer ce message de votre boîte ?')) return;
        try {
          await deleteMessage(row.dataset.mailId);
          notify('Message supprimé.');
        } catch (error) {
          notify(error && error.message ? error.message : 'Suppression impossible.');
        }
      });
      row.appendChild(actions);
    });
  }

  function install() {
    keepHomeBlack();
    normalizeVotreColor();
    enhanceRows();
    ensureDeleteAllButton();

    window.addEventListener('load', () => window.setTimeout(normalizeVotreColor, 0), { once: true });

    document.addEventListener('click', (event) => {
      const row = event.target.closest('#edmMailList [data-mail-id]');
      if (row && !event.target.closest('.edm-mail-row-actions')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openMessage(row.dataset.mailId);
      }
    }, true);

    const observer = new MutationObserver(() => {
      keepHomeBlack();
      normalizeVotreColor();
      enhanceRows();
      ensureDeleteAllButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
