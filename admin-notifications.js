(() => {
  const A = () => window.EDMAdmin;
  const esc = (v) => A().esc(v ?? '');
  const date = (v) => v ? new Date(v).toLocaleString('fr-FR') : '—';

  async function send(payload) {
    const { data: sessionData, error: sessionError } = await A().db.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session administrateur introuvable.');
    const response = await fetch('/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.error || 'Envoi impossible.');
    return result;
  }

  function actionCard(type, row, templateKey, title, details, attachmentPath, values = {}) {
    const profile = row.profiles || {};
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Client';
    return `<article class="card" style="margin:10px 0"><div class="top"><div><span class="pill">${esc(type)}</span><h3>${esc(title)}</h3><p class="muted">${esc(name)} · ${esc(profile.email || 'Email manquant')}</p></div><button class="btn primary" data-send-notification data-user="${row.user_id}" data-template="${templateKey}" data-related-type="${type}" data-related-id="${row.id}" data-attachment="${esc(attachmentPath || '')}" data-values="${encodeURIComponent(JSON.stringify(values))}" ${!profile.email ? 'disabled' : ''}>Envoyer</button></div><p>${esc(details)}</p>${attachmentPath ? '<p class="status ok">PDF joint à l’email.</p>' : '<p class="status error">Aucune pièce jointe.</p>'}</article>`;
  }

  async function load() {
    const host = A()?.$('notificationList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const [quotes, appointments, orders, invoices, history, settings] = await Promise.all([
      A().db.from('quotes').select('id,user_id,quote_number,total,valid_until,pdf_path,status,profiles(first_name,last_name,email)').in('status', ['sent','accepted']).order('updated_at', { ascending: false }).limit(30),
      A().db.from('appointments').select('id,user_id,starts_at,ends_at,status,notes,profiles(first_name,last_name,email),vehicles(plate,brand,model)').eq('status', 'confirmed').gte('starts_at', new Date().toISOString()).order('starts_at').limit(30),
      A().db.from('repair_orders').select('id,user_id,order_number,status,profiles(first_name,last_name,email),vehicles(plate,brand,model)').eq('status', 'completed').order('updated_at', { ascending: false }).limit(30),
      A().db.from('invoices').select('id,user_id,invoice_number,total,amount_paid,due_at,pdf_path,status,profiles(first_name,last_name,email)').in('status', ['issued','partially_paid','overdue']).order('updated_at', { ascending: false }).limit(40),
      A().db.from('outbound_notifications').select('id,template_key,recipient_email,subject,status,provider_message_id,error_message,sent_at,created_at').order('created_at', { ascending: false }).limit(100),
      A().db.from('automation_settings').select('*').eq('id', true).single()
    ]);
    const failure = [quotes,appointments,orders,invoices,history,settings].find((r) => r.error)?.error;
    if (failure) throw failure;
    const cards = [];
    (quotes.data || []).forEach((q) => cards.push(actionCard('quote', q, 'quote_sent', q.quote_number || 'Devis', `Montant : ${A().money(q.total)} · valable jusqu’au ${q.valid_until || '—'}`, q.pdf_path, { quote_number:q.quote_number, total:A().money(q.total), valid_until:q.valid_until || '' })));
    (appointments.data || []).forEach((r) => cards.push(actionCard('appointment', r, 'appointment_confirmed', `Rendez-vous du ${date(r.starts_at)}`, [r.vehicles?.brand,r.vehicles?.model,r.vehicles?.plate].filter(Boolean).join(' · '), null, { appointment_date:date(r.starts_at), vehicle:[r.vehicles?.brand,r.vehicles?.model,r.vehicles?.plate].filter(Boolean).join(' ') })));
    (orders.data || []).forEach((r) => cards.push(actionCard('repair_order', r, 'vehicle_ready', r.order_number || 'Véhicule prêt', [r.vehicles?.brand,r.vehicles?.model,r.vehicles?.plate].filter(Boolean).join(' · '), null, { order_number:r.order_number || '', vehicle:[r.vehicles?.brand,r.vehicles?.model,r.vehicles?.plate].filter(Boolean).join(' ') })));
    (invoices.data || []).forEach((i) => {
      const balance = Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0));
      const overdue = i.due_at && new Date(i.due_at) < new Date() && balance > 0;
      cards.push(actionCard('invoice', i, overdue ? 'payment_reminder' : 'invoice_sent', i.invoice_number || 'Facture', `${A().money(i.total)} · reste ${A().money(balance)} · échéance ${i.due_at ? new Date(i.due_at).toLocaleDateString('fr-FR') : '—'}`, i.pdf_path, { invoice_number:i.invoice_number || '', total:A().money(i.total), balance:A().money(balance), due_date:i.due_at ? new Date(i.due_at).toLocaleDateString('fr-FR') : '' }));
    });
    const cfg = settings.data || {};
    host.innerHTML = `<div class="card"><h3>État des envois</h3><p>Messages : <strong>${cfg.messages_enabled ? 'activés' : 'désactivés'}</strong> · Mode test : <strong>${cfg.test_mode ? 'oui' : 'non'}</strong>${cfg.test_mode ? ` · destinataire : ${esc(cfg.test_recipient || 'non renseigné')}` : ''}</p>${cfg.test_mode && !cfg.test_recipient ? '<div class="status error">Mode test actif sans destinataire : aucun email ne pourra partir.</div>' : ''}</div><h3 style="margin-top:14px">Envois disponibles</h3>${cards.join('') || '<p class="muted">Aucun envoi disponible.</p>'}<h3 style="margin-top:14px">Historique</h3><div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Modèle</th><th>Destinataire</th><th>Objet</th><th>Statut</th><th>Erreur</th></tr></thead><tbody>${(history.data || []).map((n) => `<tr><td>${date(n.sent_at || n.created_at)}</td><td>${esc(n.template_key)}</td><td>${esc(n.recipient_email)}</td><td>${esc(n.subject)}</td><td>${esc(n.status)}</td><td>${esc(n.error_message || '')}</td></tr>`).join('') || '<tr><td colspan="6">Aucun envoi enregistré.</td></tr>'}</tbody></table></div>`;
    host.querySelectorAll('[data-send-notification]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      const old = button.textContent;
      button.textContent = 'Envoi…';
      try {
        await send({ userId:button.dataset.user, templateKey:button.dataset.template, relatedType:button.dataset.relatedType, relatedId:button.dataset.relatedId, attachmentPath:button.dataset.attachment || null, attachmentName:button.dataset.relatedType === 'quote' ? 'devis-edm28.pdf' : button.dataset.relatedType === 'invoice' ? 'facture-edm28.pdf' : null, values:JSON.parse(decodeURIComponent(button.dataset.values || '%7B%7D')) });
        A().status('notificationStatus', 'Email envoyé et enregistré dans l’historique.');
        await load();
      } catch (error) { A().status('notificationStatus', error.message || 'Envoi impossible.', true); }
      finally { button.disabled = false; button.textContent = old; }
    });
  }

  function bind() {
    document.querySelector('[data-page="notifications"]')?.addEventListener('click', () => load().catch((e) => A().status('notificationStatus', e.message, true)));
    document.getElementById('notificationRefresh')?.addEventListener('click', () => load().catch((e) => A().status('notificationStatus', e.message, true)));
  }
  window.EDMAdminNotifications = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true }); else bind();
})();