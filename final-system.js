(() => {
  const stateFinal = {
    servicesLoaded: false,
    settings: {},
    serviceOptions: new Map()
  };

  const safe = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  const euro = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  async function getSessionUser() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function loadSiteSettings() {
    const { data, error } = await supabaseClient
      .from('site_settings')
      .select('key,value')
      .eq('is_public', true);
    if (error) throw error;
    stateFinal.settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
    applySiteSettings();
  }

  function settingValue(key, fallback = '') {
    const raw = stateFinal.settings[key];
    if (raw == null) return fallback;
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
    if (Object.prototype.hasOwnProperty.call(raw, 'value')) return raw.value;
    return fallback;
  }

  function applySiteSettings() {
    const businessName = settingValue('business_name', 'EDM AUTO');
    const subtitle = settingValue('business_subtitle', 'Mécano du Dimanche');
    const logoUrl = settingValue('logo_url', '');
    document.querySelectorAll('.brand-name, .topbar-title span:last-child').forEach((node) => { node.textContent = businessName; });
    const sub = document.querySelector('.brand-sub');
    if (sub) sub.innerHTML = `${safe(subtitle)}<br>Demande simple · estimation · validation manuelle`;
    if (logoUrl) {
      document.querySelectorAll('.brand-mark').forEach((node) => {
        node.innerHTML = `<img src="${safe(logoUrl)}" alt="${safe(businessName)}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`;
      });
    }
    const themeColor = settingValue('theme_color', '');
    if (themeColor) document.documentElement.style.setProperty('--brand', String(themeColor));
  }

  async function loadDynamicServices() {
    const [{ data: serviceRows, error: serviceError }, { data: optionRows, error: optionError }] = await Promise.all([
      supabaseClient.from('site_services').select('*').eq('active', true).not('published_at', 'is', null).order('display_order'),
      supabaseClient.from('service_options').select('*').eq('active', true).order('display_order')
    ]);
    if (serviceError) throw serviceError;
    if (optionError) throw optionError;
    if (!serviceRows?.length || typeof SERVICES === 'undefined') return;

    const previous = new Map(SERVICES.map((item) => [item.id, item]));
    const mapped = serviceRows.map((row) => {
      const id = row.external_service_id || row.slug || row.id;
      const old = previous.get(id) || {};
      return {
        id,
        category: row.category,
        name: row.name,
        labor: Number(row.labor_price || row.displayed_price || 0),
        parts: old.parts || { eco: [0, 0], standard: [0, 0], premium: [0, 0] },
        type: row.pricing_type === 'quote' ? 'Sur devis' : row.pricing_type === 'from' ? 'À partir de' : 'Montage',
        eligible: old.eligible ?? true,
        excluded: old.excluded ?? false,
        short: row.client_description || row.name,
        detail: row.technical_description || row.client_description || row.name,
        durationMinutes: Number(row.duration_minutes || 60),
        onlineBookingEnabled: Boolean(row.online_booking_enabled)
      };
    });

    SERVICES.splice(0, SERVICES.length, ...mapped);
    stateFinal.serviceOptions = new Map();
    (optionRows || []).forEach((option) => {
      if (!stateFinal.serviceOptions.has(option.service_id)) stateFinal.serviceOptions.set(option.service_id, []);
      stateFinal.serviceOptions.get(option.service_id).push(option);
    });
    stateFinal.servicesLoaded = true;
    if (typeof renderServices === 'function') renderServices();
    if (typeof renderBaskets === 'function') renderBaskets();
    if (typeof updateSummary === 'function') updateSummary();
  }

  function installPortalPanels() {
    const historyPage = document.getElementById('history');
    if (historyPage && !document.getElementById('finalPortalPanel')) {
      historyPage.querySelector('.panel')?.insertAdjacentHTML('beforeend', `
        <div id="finalPortalPanel" class="card" style="margin-top:18px">
          <div class="section-title"><div><h3>Documents et rendez-vous</h3><p>Devis, ordres de réparation, factures, paiements et rendez-vous liés à votre compte.</p></div></div>
          <div id="finalPortalContent"><div class="empty">Connectez-vous pour consulter vos éléments.</div></div>
        </div>`);
    }
  }

  async function renderPortalData() {
    const host = document.getElementById('finalPortalContent');
    if (!host) return;
    const user = await getSessionUser();
    if (!user) {
      host.innerHTML = '<div class="empty">Connectez-vous pour consulter vos éléments.</div>';
      return;
    }
    host.innerHTML = '<div class="notice">Chargement des informations...</div>';
    const [quotes, orders, invoices, payments, appointments, messages] = await Promise.all([
      supabaseClient.from('quotes').select('id,quote_number,status,title,total,valid_until,pdf_path,created_at').eq('user_id', user.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('repair_orders').select('id,order_number,status,signed_at,created_at').eq('user_id', user.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('invoices').select('id,invoice_number,status,title,total,amount_paid,pdf_path,issued_at,created_at').eq('user_id', user.id).eq('visible_to_client', true).order('created_at', { ascending: false }),
      supabaseClient.from('payments').select('id,invoice_id,amount,payment_method,paid_at').eq('user_id', user.id).order('paid_at', { ascending: false }),
      supabaseClient.from('appointments').select('id,starts_at,ends_at,status,notes').eq('user_id', user.id).eq('visible_to_client', true).order('starts_at', { ascending: false }),
      supabaseClient.from('client_messages').select('id,subject,body,channel,read_by_client,created_at').eq('user_id', user.id).eq('visible_to_client', true).order('created_at', { ascending: false }).limit(10)
    ]);
    const firstError = [quotes, orders, invoices, payments, appointments, messages].find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const cards = [];
    (quotes.data || []).forEach((q) => cards.push({ date: q.created_at, type: 'Devis', title: q.quote_number || q.title || 'Devis', status: q.status, amount: q.total, path: q.pdf_path }));
    (orders.data || []).forEach((o) => cards.push({ date: o.created_at, type: 'Ordre de réparation', title: o.order_number || 'OR', status: o.status }));
    (invoices.data || []).forEach((i) => cards.push({ date: i.issued_at || i.created_at, type: 'Facture', title: i.invoice_number || i.title || 'Facture', status: i.status, amount: i.total, extra: `Payé : ${euro(i.amount_paid)}`, path: i.pdf_path }));
    (appointments.data || []).forEach((a) => cards.push({ date: a.starts_at, type: 'Rendez-vous', title: new Date(a.starts_at).toLocaleString('fr-FR'), status: a.status, extra: a.notes || '' }));
    cards.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const timeline = cards.length ? cards.map((item) => `<article class="card" style="margin:10px 0">
      <div class="section-title"><div><span class="pill blue">${safe(item.type)}</span><h3 style="margin-top:10px">${safe(item.title)}</h3></div><span class="pill">${safe(item.status || '')}</span></div>
      <p>${item.amount != null ? `Montant : <strong>${euro(item.amount)}</strong>` : ''}${item.extra ? `<br>${safe(item.extra)}` : ''}</p>
      ${item.path ? `<button class="btn btn-ghost" data-final-doc="${safe(item.path)}" type="button">Ouvrir le document</button>` : ''}
    </article>`).join('') : '<div class="empty">Aucun document ou rendez-vous publié.</div>';

    const messageHtml = (messages.data || []).length ? `<h3 style="margin-top:20px">Messages récents</h3>${messages.data.map((m) => `<article class="card" style="margin:10px 0"><b>${safe(m.subject || 'Message EDM AUTO')}</b><p>${safe(m.body)}</p><span class="small">${new Date(m.created_at).toLocaleString('fr-FR')} · ${safe(m.channel)}</span></article>`).join('')}` : '';
    host.innerHTML = timeline + messageHtml;

    host.querySelectorAll('[data-final-doc]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(button.dataset.finalDoc, 120);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        if (typeof toast === 'function') toast(error.message || 'Document indisponible.');
      }
    }));
  }

  function installListeners() {
    document.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', () => {
      setTimeout(() => renderPortalData().catch((error) => {
        const host = document.getElementById('finalPortalContent');
        if (host) host.innerHTML = `<div class="errorbox">${safe(error.message)}</div>`;
      }), 0);
    }));
    supabaseClient.auth.onAuthStateChange(() => setTimeout(() => renderPortalData().catch(() => {}), 0));
  }

  async function bootstrapFinalSystem() {
    installPortalPanels();
    installListeners();
    await Promise.allSettled([loadSiteSettings(), loadDynamicServices()]);
    await renderPortalData().catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrapFinalSystem);
  else bootstrapFinalSystem();
})();