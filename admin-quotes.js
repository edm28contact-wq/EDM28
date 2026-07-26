(() => {
  const app = () => window.EDMAdmin;
  const currentDate = () => new Date().toISOString().slice(0, 10);

  async function save(id, publish) {
    const root = document.querySelector(`[data-quote-id="${id}"]`);
    let quoteNumber = root.querySelector('[data-field="number"]').value.trim();
    const total = Number(root.querySelector('[data-field="total"]').value || 0);
    const validUntil = root.querySelector('[data-field="validUntil"]').value || null;
    if (!quoteNumber) {
      const next = await app().db.rpc('next_document_number', { p_type: 'quote' });
      if (next.error) throw next.error;
      quoteNumber = next.data;
    }
    if (!Number.isFinite(total) || total <= 0) throw new Error('Montant positif obligatoire.');
    if (publish && (!validUntil || validUntil < currentDate())) throw new Error('Une date de validité future est obligatoire.');
    const patch = { quote_number: quoteNumber, total, valid_until: validUntil };
    if (publish) Object.assign(patch, { status: 'sent', visible_to_client: true });
    const { data, error } = await app().db.from('quotes').update(patch).eq('id', id).eq('status', 'draft').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Seul un brouillon peut être modifié ou publié.');
  }

  function render(rows) {
    const host = app().$('quoteList');
    host.innerHTML = rows.length ? rows.map((q) => {
      const draft = q.status === 'draft';
      const locked = draft ? '' : ' disabled';
      const actions = draft ? `<div class="toolbar"><button class="btn ghost" data-save="${q.id}">Enregistrer</button><button class="btn primary" data-publish="${q.id}">Publier au client</button></div>` : '<p class="muted">Devis verrouillé après publication.</p>';
      return `<article class="card" data-quote-id="${q.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${app().esc(q.status)}</span><h3>${app().esc(q.title || 'Devis EDM28')}</h3></div><strong>${app().money(q.total)}</strong></div><p>${app().esc(q.profiles?.email || 'Client')} · ${app().esc(q.vehicles?.plate || 'Véhicule')}</p><label>Numéro<input data-field="number" placeholder="Généré automatiquement" value="${app().esc(q.quote_number || '')}"${locked}></label><label>Montant TTC<input data-field="total" type="number" min="0" step="0.01" value="${Number(q.total || 0)}"${locked}></label><label>Valable jusqu’au<input data-field="validUntil" type="date" value="${app().esc(q.valid_until || '')}"${locked}></label>${actions}</article>`;
    }).join('') : '<p class="muted">Aucun devis.</p>';
    host.querySelectorAll('[data-save],[data-publish]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      try { await save(button.dataset.save || button.dataset.publish, Boolean(button.dataset.publish)); app().status('quoteStatus', button.dataset.publish ? 'Devis publié au client.' : 'Devis enregistré.'); await load(); await app().overview(); }
      catch (error) { app().status('quoteStatus', error.message || 'Opération impossible.', true); }
      finally { button.disabled = false; }
    });
  }

  async function load() {
    const host = app()?.$('quoteList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await app().db.from('quotes').select('id,status,title,quote_number,total,valid_until,visible_to_client,created_at,profiles(email),vehicles(plate)').in('status', ['draft','sent','accepted','refused']).order('created_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function appendScripts(sources) {
    return sources.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src^="${src.split('?')[0]}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src; script.async = false; script.onload = resolve; script.onerror = reject;
      document.body.appendChild(script);
    })), Promise.resolve());
  }

  function addModule({ id, label, title, description, refreshId, statusId, listId, scripts, before }) {
    const nav = document.querySelector('.nav');
    const dashboard = document.getElementById('dashboard');
    if (!nav || !dashboard || document.getElementById(id)) return;
    const button = document.createElement('button');
    button.className = 'btn ghost'; button.dataset.page = id; button.textContent = label;
    nav.insertBefore(button, nav.querySelector(`[data-page="${before}"]`));
    const section = document.createElement('section');
    section.id = id; section.className = 'page';
    section.innerHTML = `<div class="card"><div class="top"><div><h2>${title}</h2><p class="muted">${description}</p></div><button id="${refreshId}" class="btn ghost">Actualiser</button></div><div id="${statusId}" class="status hidden"></div><div id="${listId}"></div></div>`;
    dashboard.appendChild(section);
    button.addEventListener('click', () => app().page(id));
    appendScripts(scripts).catch((e) => app().status(statusId, e.message || 'Module indisponible.', true));
  }

  function bootstrapModules() {
    addModule({ id: 'operations', label: 'Atelier', title: 'Préparation atelier', description: 'Planifier les devis acceptés et préparer l’ordre de réparation associé.', refreshId: 'operationRefresh', statusId: 'operationStatus', listId: 'operationList', scripts: ['/admin-operations.js?v=3'], before: 'clients' });
    addModule({ id: 'interventions', label: 'Interventions', title: 'Dossiers intervention', description: 'Dossier unique, fiche de contrôle mobile, photos et avancement atelier.', refreshId: 'interventionRefresh', statusId: 'interventionStatus', listId: 'interventionList', scripts: ['/admin-interventions.js?v=2'], before: 'clients' });
    addModule({ id: 'finalization', label: 'Clôture', title: 'Clôture et facturation', description: 'Clôturer les interventions terminées et générer une facture brouillon contrôlée.', refreshId: 'finalizationRefresh', statusId: 'finalizationStatus', listId: 'finalizationList', scripts: ['/admin-finalization.js?v=2'], before: 'clients' });
    addModule({ id: 'invoice-actions', label: 'Encaissement', title: 'Émission et règlements', description: 'Émettre les factures brouillon puis enregistrer les paiements reçus.', refreshId: 'invoiceActionRefresh', statusId: 'invoiceActionStatus', listId: 'invoiceActionList', scripts: ['/admin-invoice-actions.js?v=1'], before: 'clients' });
    addModule({ id: 'message-templates', label: 'Messages', title: 'Modèles de messages', description: 'Modifier les messages de confirmation, devis, rendez-vous, véhicule prêt, facture et relance.', refreshId: 'messageTemplateRefresh', statusId: 'messageTemplateStatus', listId: 'messageTemplateList', scripts: ['/admin-message-templates.js?v=1'], before: 'clients' });
    addModule({ id: 'document-pdf', label: 'PDF', title: 'Documents PDF', description: 'Générer et stocker les devis, ordres de réparation, contrôles et factures dans le coffre privé.', refreshId: 'documentPdfRefresh', statusId: 'documentPdfStatus', listId: 'documentPdfList', scripts: ['/pdf-lite.js?v=1', '/admin-document-pdf.js?v=2'], before: 'clients' });
    addModule({ id: 'audit-log', label: 'Journal', title: 'Journal des opérations', description: 'Consulter les changements métier enregistrés automatiquement.', refreshId: 'auditLogRefresh', statusId: 'auditLogStatus', listId: 'auditLogList', scripts: ['/admin-audit-log.js?v=1'], before: 'clients' });
  }

  function bind() {
    bootstrapModules();
    document.querySelector('[data-page="quotes"]')?.addEventListener('click', () => load().catch((error) => app().status('quoteStatus', error.message || 'Devis indisponibles.', true)));
    document.getElementById('quoteRefresh')?.addEventListener('click', () => load().catch((error) => app().status('quoteStatus', error.message || 'Actualisation impossible.', true)));
  }
  window.EDMAdminQuotes = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();